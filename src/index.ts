/**
 * Copyright (c) 2023 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

import {
  JsonEvent,
  JsonEventType,
  JsonMaterializingTransformStream,
  JsonToStringTransformStream,
  StringToJsonTransformStream,
} from '@quadient/evolve-data-transformations'
import { TransformdApiClient } from './api/transformdApiClient'
import { TransformdDemoWebhookClient } from './webhook/transformdDemoWebhookClient'
import * as jp from 'jsonpath'

export function getDescription(): ScriptDescription {
  return {
    description:
      'Demo script for integration with Transformd. Initiates a Form Session and writes the session URL to the designated location in the data file.',
    icon: 'create_template',
    input: [
      {
        id: 'inputDataFile',
        displayName: 'Input Data File',
        description: 'JSON-formatted input data file to read from.',
        type: 'InputResource',
        required: true,
      },
      {
        id: 'outputDataFile',
        displayName: 'Output Data File',
        description:
          'Output data file to write the URL-enhanced data to (will be JSON format).',
        type: 'OutputResource',
        required: true,
      },
      {
        id: 'outputDataPath',
        displayName: 'URL Data JSONPath Expression',
        description:
          'A JSONPath expression indicating the data element(s) to update with the Form Session URL. If the path provided does not exist, it will be created. If the path provided cannot be resolved or the expression is invalid, the job will fail.',
        defaultValue: '$.Clients[*].variableName',
        type: 'String',
        required: true,
      },
      {
        id: 'webhookUrl',
        displayName: 'Webhook URL',
        description:
          'The URL of the Transformd webhook that initiates the Form Session.',
        defaultValue: 'https://api.transformd.com/hooks/',
        type: 'String',
        required: true,
      },
      {
        id: 'webhookUsername',
        displayName: 'Webhook Username',
        description:
          'The username to use when initiating the Form Session via the Transformd webhook. If blank, no authentication header (HTTP Basic) will be sent.',
        type: 'String',
        required: false,
      },
      {
        id: 'webhookPassword',
        displayName: 'Webhook Password',
        description:
          'The password to use when initiating the Form Session via the Transformd webhook. If blank, no authentication header (HTTP Basic) will be sent.',
        type: 'Secret',
        required: false,
      },
      {
        id: 'apiUrl',
        displayName: 'Transformd API URL',
        description: 'The base URL for the Transformd API.',
        defaultValue: 'https://api.transformd.com',
        type: 'String',
        required: true,
      },
      {
        id: 'profileId',
        displayName: 'Profile (Dataset) ID',
        description:
          'The Transformd Profile (Dataset) ID associated with the Form to be used.',
        type: 'String',
        defaultValue: '303',
        required: true,
      },
      {
        id: 'sessionIdSearchKey',
        displayName: 'Form Session Search Key Name',
        description:
          'The Transformd fields key name to search for the unique Session ID.',
        defaultValue: 'claimNumber',
        type: 'String',
        required: true,
      },
      {
        id: 'sessionIdSearchValue',
        displayName: 'Form Session Search Value Path',
        description:
          'A JSONPath expression for the input data element(s) to use to match the unique Session ID.',
        defaultValue:
          'concat("-", $.Clients[*].ClientID, $.Clients[*].ClaimID)',
        type: 'String',
        required: true,
      },
      {
        id: 'sessionUrlKey',
        displayName: 'Form Session URL Key Name',
        description: 'The key name associated with the Form Session URL.',
        defaultValue: '64a54c3631e6326de51ca7a2',
        type: 'String',
        required: true,
      },
    ],
    output: [],
  }
}

export async function execute(context: Context): Promise<void> {
  // Delete output data file (if it exists)
  //
  try {
    await context.getFile(context.parameters.outputDataFile as string).delete()
  } catch (err) {
    // Ignore error if file does not exist
  }

  // Read input data
  console.log(`Reading input file: ${context.parameters.inputDataFile}`)
  const inputData = await context.read(
    context.parameters.inputDataFile as string
  )

  // Process input data file using JSONPath expression provided via
  // 'sessionIdSearchValue' input param.
  //
  let inputJson = {}
  try {
    inputJson = JSON.parse(inputData)
  } catch (err) {
    throw new Error('Failed to parse input data as JSON.')
  }

  const searchValues = getSearchValues(
    inputJson,
    context.parameters.sessionIdSearchValue as string
  )
  let formSessionUrls: string[] = []
  for (let i = 0; i < searchValues.length; i++) {
    const searchValue = searchValues[i]
    console.log(`Matching search value: ${searchValue}`)

    // Call webhook to initiate a form session
    //
    const webhookClient = new TransformdDemoWebhookClient(
      context.parameters.webhookUrl as string,
      context.parameters.webhookUsername as string,
      context.parameters.webhookPassword as string
    )
    const webhookResponse = await webhookClient.send(inputJson)
    if (webhookResponse.status !== 'created') {
      // TODO: Check to see if status !== 'created' is an error
      // throw new Error(`Webhook response status: ${webhookResponse.status}`)
      console.log(`Webhook response status: ${webhookResponse.status}`)
    }

    // Call profile search API with search params
    //
    const apiClient = new TransformdApiClient(
      context.parameters.apiUrl as string,
      context.parameters.apiKey as string
    )
    await apiClient.getAuthToken()
    const profileResponse = await apiClient.searchProfile(
      context.parameters.profileId as string,
      context.parameters.sessionIdSearchKey as string,
      searchValue
    )

    // Check search response
    //
    if (profileResponse.success) {
      switch (profileResponse.data.count) {
        case 0:
          throw new Error(
            `No profile found with search params: id=${context.parameters.profileId}, ${context.parameters.sessionIdSearchKey}=${searchValue}`
          )
        case 1:
          break // Match found, Continue
        default:
          throw new Error(
            `Multiple profiles found with search params: id=${context.parameters.profileId}, ${context.parameters.sessionIdSearchKey}=${searchValue}`
          )
      }
    } else {
      throw new Error(`Profile response error: ${profileResponse}`)
    }

    // Update the input data file with the Form Session URL. Upsert the
    // element specified by the JSONPath expression in the param 'outputDataPath'.
    // Write the modified JSON content to the output file provided by the param
    // 'outputDataFile'.
    //
    formSessionUrls.push(profileResponse.data.records[0].values.url)
    console.log(`Form Session URL: ${formSessionUrls[i]}`)
  }
  // TODO: Remove after testing
  // for (let i = 0; i < searchValues.length; i++) {
  //   formSessionUrls.push(
  //     'https://demo.transformd.com/quadient/?id=e1fe3d016684bdb908ad839558a2736ce7281ae0&brand=Emerald%20Travel'
  //   )
  // }

  // Parse the JSONPath output expression into parent and child elements
  //
  const outputDataPath = context.parameters.outputDataPath as string
  const pathElements = outputDataPath.split('.')
  const updateKey = pathElements.pop()
  let urlIndex = 0

  // Create a materializing transformer to perform the update
  //
  const materializedPaths = [pathElements.join('.')]
  const updateTransformer = new TransformStream<JsonEvent, JsonEvent>({
    transform(event, controller) {
      if (event.type === JsonEventType.ANY_VALUE) {
        event.data[`${updateKey}`] = formSessionUrls[urlIndex++]
      }
      controller.enqueue(event)
    },
  })

  // Open input and output files for text streaming
  //
  const inputStream = await context.openReadText(
    context.parameters.inputDataFile as string
  )
  const outputStream = await context.openWriteText(
    context.parameters.outputDataFile as string
  )

  // Apply the update transform and write the output file
  //
  await inputStream
    .pipeThrough(new StringToJsonTransformStream())
    .pipeThrough(new JsonMaterializingTransformStream({ materializedPaths }))
    .pipeThrough(updateTransformer)
    .pipeThrough(new JsonToStringTransformStream())
    .pipeTo(outputStream)

  console.log('Done.')
}

/**
 * Retrieves the search (node) value(s) from a JSON object as specified by the
 * JSONPath expression(s) provided. To support derived key fields, a synthetic
 * 'concat()' function is made available. Usage:
 *     concat(<delimiter>, <JSONPath expr 1>, <JSONPath expr 2, ...)
 * @param {object} json JSON object to interrogate for values
 * @param {string} searchPath JSONPath expression(s) for the search value
 * @returns {string[]} An array of resolved search value(s)
 */
function getSearchValues(json: object, searchPath: string): string[] {
  const concatStartToken = 'concat('
  const concatEndToken = ')'
  let searchValues: string[] = []

  // Handle concat()'d' JSONPath expressions
  //
  if (searchPath.startsWith(concatStartToken)) {
    const concatArgs = searchPath.substring(
      concatStartToken.length,
      searchPath.endsWith(concatEndToken)
        ? searchPath.length - 1
        : searchPath.length
    )
    // Validate concat() arguments
    //
    const pathArgs = concatArgs.split(',')
    if (pathArgs && pathArgs.length < 3) {
      throw new Error('Invalid number or arguments to concat().')
    }
    const concatString = pathArgs!.shift()!.trim()
    // Concatenate the individually resolved JSONPath expressions
    //
    for (let i = 0; i < pathArgs.length; i++) {
      const pathArg = pathArgs[i].trim() ?? ''
      if (pathArg.startsWith('$')) {
        const nodeValues = getJsonPathNodeValues(json, pathArg)
        if (nodeValues.length > 0) {
          if (searchValues.length > 0) {
            searchValues = searchValues.map((element, index) =>
              element.concat(nodeValues[index])
            )
          } else {
            searchValues = nodeValues
          }
          // Add the delimiter if more search values to resolve
          //
          if (i < pathArgs.length - 1) {
            for (let j = 0; j < searchValues.length; j++) {
              searchValues[j] = searchValues[j].concat(concatString)
            }
          }
        } else {
          throw new Error(
            `No values found using the JSONPath expression '${pathArg}'`
          )
        }
      } else {
        throw new Error(
          `Invalid JSONPath argument to concat(): '${pathArg}' (missing root symbol).`
        )
      }
    }
  } else {
    // Single JSONPath expression to resolve
    //
    searchValues = getJsonPathNodeValues(json, searchPath)
  }

  console.log(`searchValues: ${searchValues}`)
  return searchValues
}

/**
 * Helper function to parse the actual node values from the JSON object.
 * @param {object} json JSON object
 * @param {path} path JSONPath expression to the required node(s)
 * @returns {string[]} A string array containing the node value(s)
 */
function getJsonPathNodeValues(json: object, path: string): string[] {
  try {
    const nodes = jp.nodes(json, path)
    return nodes.flatMap((node) => node.value)
  } catch (err) {
    console.log(`Error getting value (${path}) from JSON: ${err}`)
    return []
  }
}
