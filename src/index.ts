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
        displayName: 'Input data file',
        description: 'Data file to read input from (JSON format).',
        type: 'InputResource',
        required: true,
      },
      {
        id: 'outputDataFile',
        displayName: 'Output data file',
        description:
          'Output file to write the URL-enhanced data to (will be JSON format).',
        type: 'OutputResource',
        required: true,
      },
      {
        id: 'outputDataPath',
        displayName: 'URL data JSONPath expression',
        description:
          'A JSONPath expression indicating the data element(s) to update with the form session URL. If the path provided does not exist, it will be created. If the path provided cannot be resolved or the expression is invalid, the job will fail.',
        defaultValue: '$.Clients[*].variableName',
        type: 'String',
        required: true,
      },
      {
        id: 'webhookConnector',
        displayName: 'Transformd webhook connector',
        description:
          'The web endpoint connector configured with the URL for the Transformd webhook.',
        type: 'Connector',
        required: true,
      },
      {
        id: 'apiConnector',
        displayName: 'Transformd API connector',
        description:
          'The web endpoint connector configured with the base URL for the Transformd API.',
        type: 'Connector',
        required: true,
      },
      {
        id: 'profileId',
        displayName: 'Profile (dataset) ID',
        description:
          'The Transformd profile (dataset) ID associated with the form to be used.',
        type: 'String',
        defaultValue: '303',
        required: true,
      },
      {
        id: 'sessionSearchKey',
        displayName: 'Form session search key name',
        description:
          'The Transformd fields object key name to search for the unique session identifier.',
        defaultValue: 'claimNumber',
        type: 'String',
        required: true,
      },
      {
        id: 'sessionSearchValuesFile',
        displayName: 'Form session search values file',
        description:
          'A JSON-formatted input file created by by the Transformd Demo Processor. These values represent the unique identifier for the form session to be created/retrieved.',
        type: 'InputResource',
        required: true,
      },
      {
        id: 'sessionUrlKey',
        displayName: 'Form session URL key name',
        description:
          'The key name associated with the form session URL key-value pair in the Transformd API response.',
        defaultValue: '64a54c3631e6326de51ca7a2',
        type: 'String',
        required: true,
      },
    ],
    output: [],
  }
}

export async function execute(context: Context): Promise<void> {
  // Delete the output data file (if it exists)
  //
  try {
    await context.getFile(context.parameters.outputDataFile as string).delete()
  } catch (err) {
    // Ignore error (i.e. file does not exist)
  }

  // Read input data
  console.log(`Reading input file: ${context.parameters.inputDataFile}`)
  const inputData = await context.read(
    context.parameters.inputDataFile as string
  )

  let inputJson = {}
  try {
    inputJson = JSON.parse(inputData)
  } catch (err) {
    throw new Error('Failed to parse input data as JSON.')
  }

  // Retrieve the saved search values from the file provided via the
  // 'sessionSearchValuesFile' input param.
  //
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

  // Transformd API processing (performed for each record in the input file)
  //
  const formSessionUrls: string[] = []
  for (let i = 0; i < searchValues.length; i++) {
    const searchValue = searchValues[i]
    console.log(`Unique search value: ${searchValue}`)

    // Call webhook to initiate a form session with the input data record as
    // the payload of the request.
    //
    const webhookConnector = new TransformdDemoWebhookClient(
      context.parameters.webhookConnector as string
    )
    const webhookResponse = await webhookConnector.send(inputJson)
    if (webhookResponse.status !== 'created') {
      // TODO: Check to see if status !== 'created' is an error
      // throw new Error(`Webhook response status: ${webhookResponse.status}`)
      console.log(`Webhook response status: ${webhookResponse.status}`)
    }

    // Call profile search API with the record's unique search value to get
    // back a URL for the form session that was initiated.
    //
    const apiConnector = new TransformdApiClient(
      context.parameters.apiConnector as string
    )
    await apiConnector.getAuthToken()
    const profileResponse = await apiConnector.searchProfile(
      context.parameters.profileId as string,
      context.parameters.sessionSearchKey as string,
      searchValue
    )

    // Check the search response
    //
    if (profileResponse.success) {
      switch (profileResponse.data.count) {
        case 0:
          throw new Error(
            `No profile found with search params: id=${context.parameters.profileId}, ${context.parameters.sessionSearchKey}=${searchValue}`
          )
        case 1:
          break // Match found, save URL and continue
        default:
          throw new Error(
            `Multiple profiles found with search params: id=${context.parameters.profileId}, ${context.parameters.sessionSearchKey}=${searchValue}`
          )
      }
    } else {
      throw new Error(`Profile response error: ${profileResponse}`)
    }

    formSessionUrls.push(profileResponse.data.records[0].values.url)
  }

  // Using the input data file, upsert the element specified by the JSONPath
  // expression in the param 'outputDataPath' with the form session URL
  // returned by the API. Write the modified JSON content to the output file
  // provided by the 'outputDataFile' param.
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

  // Open the input and output files for streaming
  //
  const inputStream = await context.openReadText(
    context.parameters.inputDataFile as string
  )
  const outputStream = await context.openWriteText(
    context.parameters.outputDataFile as string
  )

  // Apply the update transform to the input data and write the enriched
  // data to the output file.
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
 * usually created in a previous step by the Transformd Demo Processor.
 * @param {string} input contents of the JSON file read for the stored search values
 * @returns {string[]} array of resolved search value(s)
 */
function getSearchValues(input: string): string[] {
  const searchValues = JSON.parse(input).values
  if (searchValues) {
    console.log(
      `Read ${
        searchValues.length
      } search values from the values file: ${searchValues.join(', ')}`
    )
  }
  return searchValues
}
