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

export function getDescription(): ScriptDescription {
  return {
    description:
      'Demo connector script for integration with Transformd. Initiates a Form Session and writes the session URL to the designated location in the data file.',
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
        id: 'sessionSearchKey',
        displayName: 'Form Session Search Key Name',
        description:
          'The Transformd fields key name to search for the unique Session ID.',
        defaultValue: 'claimNumber',
        type: 'String',
        required: true,
      },
      {
        id: 'sessionSearchValuesFile',
        displayName: 'Form Session Search Values File',
        description:
          'A JSON-formatted input file created by by the Transformd Demo Processor. These values represent the unique identifier for the Form Session to be created/retrieved.',
        type: 'InputResource',
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

  // Process input data file using the saved search values file provided via
  // the 'sessionSearchValuesFile' input param.
  //
  let inputJson = {}
  try {
    inputJson = JSON.parse(inputData)
  } catch (err) {
    throw new Error('Failed to parse input data as JSON.')
  }

  // Read search value input data
  console.log(
    `Reading search value input file: ${context.parameters.sessionSearchValuesFile}`
  )
  const searchValueInputData = await context.read(
    context.parameters.sessionSearchValuesFile as string
  )
  const searchValues = getSearchValues(searchValueInputData)
  if (searchValues.length === 0) {
    throw new Error('Failed to retrieve any search values from the data file.')
  }

  // TODO: Comment/Uncomment to skip/perform API testing
  /**/

  let formSessionUrls: string[] = []
  for (let i=0; i<searchValues.length; i++) {
    const searchValue = searchValues[i]
    console.log(`Unique search value: ${searchValue}`)

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
      context.parameters.sessionSearchKey as string,
      searchValue
    )

    // Check search response
    //
    if (profileResponse.success) {
      switch (profileResponse.data.count) {
        case 0:
          throw new Error(
            `No profile found with search params: id=${context.parameters.profileId}, ${context.parameters.sessionSearchKey}=${searchValue}`
          )
        case 1:
          break // Match found, Continue
        default:
          throw new Error(
            `Multiple profiles found with search params: id=${context.parameters.profileId}, ${context.parameters.sessionSearchKey}=${searchValue}`
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

  /**/

  // TODO: Remove after testing
  // let formSessionUrls: string[] = []
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
  console.log(
    `Writing Form Session URL values (${formSessionUrls.length}) to file: ${context.parameters.outputDataFile}`
  )
  await inputStream
    .pipeThrough(new StringToJsonTransformStream())
    .pipeThrough(new JsonMaterializingTransformStream({ materializedPaths }))
    .pipeThrough(updateTransformer)
    .pipeThrough(new JsonToStringTransformStream())
    .pipeTo(outputStream)

  console.log('Done.')
}

/**
 * Retrieves the search (data) value(s) by reading a JSON-formatted input file
 * as specified by the 'sessionSearchValuesFile' input param. This file is
 * created in a previous step by the Transformd Demo Processor.
 * @param {string} input contents of the JSON file read for the stored search values
 * @returns {string[]} array of resolved search value(s)
 */
function getSearchValues(input: string): string[] {
  const searchValues = JSON.parse(input).values
  console.log(`Read ${searchValues.length} search values from the values file: ${searchValues.join(', ')}`)
  return searchValues
}
