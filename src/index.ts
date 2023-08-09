/**
 * Copyright (c) 2023 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

import {
  JsonEvent,
  JsonEventType,
  JsonMaterializingParser,
  JsonMaterializingTransformStream,
  JsonToStringTransformStream,
  StringReadableStream,
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
        defaultValue: '$.Clients[*].TransformdURL',
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
        defaultValue: 'guid',
        type: 'String',
        required: true,
      },
      {
        id: 'sessionSearchPath',
        displayName: 'Form session search value path',
        description:
          'A JSONPath expression for the input data element to use as a unique form session identifier.',
        defaultValue: '$.Clients[*].guid',
        type: 'String',
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
      {
        id: 'sequenceDelayMs',
        displayName: 'Sequence delay (ms)',
        description:
          'The number of milliseconds to wait after the webhook has initiated the form session in order to allow the trigger sequence to complete.',
        defaultValue: 2000,
        type: 'Number',
        required: true,
      },
    ],
    output: [],
  }
}

export async function execute(context: Context): Promise<void> {
  // Delete the output data file (if it exists).
  //
  try {
    await context.getFile(context.parameters.outputDataFile as string).delete()
  } catch (err) {
    // Ignore error (i.e. file does not exist)
  }

  // Validate the JSONPath expression that serves as the path to the unique
  // form session identifier (becomes the search value).
  //
  const searchPathExpression = getJsonPathExpression(
    context.parameters.sessionSearchPath as string
  )
  const searchParts = searchPathExpression.split('.')
  const searchKey = searchParts?.pop() ?? ''
  if (searchKey.length === 0) {
    throw new Error(
      `Invalid JSONPath expression for search path: '${searchPathExpression}'.`
    )
  }
  const searchPath = searchParts!.join('.')

  // Create the callback function that will be used to parse the input
  // data file and store our search value(s).
  //
  const searchValues: string[] = []
  const inputJson: object[] = []
  const parserCallback = async (event: JsonEvent) => {
    if (event.type === JsonEventType.ANY_VALUE) {
      searchValues.push(event.data[searchKey])
      inputJson.push(event.data)
    }
  }

  // Read the input data file.
  //
  console.log(`Reading input file: ${context.parameters.inputDataFile}`)
  const inputData = await context.read(
    context.parameters.inputDataFile as string
  )

  // Parse the input data to resolve the search value JSONPath expression(s)
  // to the JSON element's actual data value.
  //
  const materializedSearchPaths = [searchPath]
  const parser = new JsonMaterializingParser(parserCallback, {
    materializedPaths: materializedSearchPaths,
  })
  await parser.parse(inputData)
  await parser.flush()

  // Check the results of the parsing operation.
  //
  if (searchValues.length === 0) {
    throw new Error(
      `No search values found for JSONPath expression: '${searchPathExpression}'.`
    )
  } else if (searchValues.length !== inputJson.length) {
    throw new Error(
      `The number of search values does not match the number of input JSON objects: ${searchValues.length} != ${inputJson.length}`
    )
  }

  // Transformd API processing section.
  //
  const webhookConnector = new TransformdDemoWebhookClient(
    context.parameters.webhookConnector as string
  )
  const apiConnector = new TransformdApiClient(
    context.parameters.apiConnector as string
  )

  // Call webhook to initiate a form session with the complete input data file
  // as the payload of the request.
  //
  console.log(`Initiating form sessions (${searchValues.length})...`)
  const webhookResponse = await webhookConnector.send(JSON.parse(inputData))
  if (webhookResponse.status === 'created') {
    console.log(`Event '${webhookResponse.event_id}' created.`)
  } else {
    // TODO: Check to see if status !== 'created' is an error
    console.warn(`Webhook response status: ${webhookResponse.status}`)
  }

  // Insert a delay between calls to the webhook and the profile search
  // API. This provides time for the sequence of tasks initiated by the
  // webhook to finish.
  //
  await new Promise((resolve) =>
    setTimeout(resolve, context.parameters.sequenceDelayMs as number)
  )

  // Repeat process for each element in the search values array.
  //
  const formSessionUrls: string[] = []
  for (let i = 0; i < searchValues.length; i++) {
    const searchValue = searchValues[i]

    // Call the profile search API with the record's unique search value to
    // get back a URL for the form session that was initiated.
    //
    if (!apiConnector.isAuthenticated()) {
      console.log('Getting authentication token for the API...')
      const authResponse = await apiConnector.getAuthToken()
      if (authResponse.success) {
        console.log('Successfully authenticated with the Transformd API')
      } else {
        throw new Error('Failed to authenticate with the Transformd API')
      }
    }

    console.log('Calling the profile search API to get the form session URL...')
    const profileResponse = await apiConnector.searchProfile(
      context.parameters.profileId as string,
      context.parameters.sessionSearchKey as string,
      searchValue
    )

    // Check the search response.
    //
    if (profileResponse.success) {
      switch (profileResponse.data.count) {
        case 0:
          throw new Error(
            `No profile found with search params: id=${context.parameters.profileId}, ${context.parameters.sessionSearchKey}=${searchValue}`
          )
          return
        case 1:
          break // Match found, continue to save form session URL
        default:
          throw new Error(
            `Multiple profiles found with search params: id=${context.parameters.profileId}, ${context.parameters.sessionSearchKey}=${searchValue}`
          )
          return
      }
    } else {
      throw new Error(
        `Profile response error: ${JSON.stringify(profileResponse)}`
      )
      return
    }

    let formSessionUrl = ''
    const sessionUrlKey = context.parameters.sessionUrlKey as string
    formSessionUrl = profileResponse.data.records[0].values[`${sessionUrlKey}`]
    formSessionUrls.push(formSessionUrl)
  }

  // Using the input data file, upsert the element specified by the JSONPath
  // expression in the param 'outputDataPath' with the form session URL
  // returned by the API. Write the modified JSON content to the output file
  // provided by the 'outputDataFile' param.
  //
  const updatePathExpression = getJsonPathExpression(
    context.parameters.outputDataPath as string
  )
  const updateParts = updatePathExpression.split('.')
  const updateKey = updateParts?.pop() ?? ''
  if (updateKey.length === 0) {
    throw new Error(
      `Invalid JSONPath expression for update path: '${updatePathExpression}'.`
    )
  }
  const updatePath = updateParts!.join('.')
  let urlIndex = 0

  // Create a materializing transformer to perform the update
  //
  const materializedPaths = [updatePath]
  const updateTransformer = new TransformStream<JsonEvent, JsonEvent>({
    transform(event, controller) {
      if (event.type === JsonEventType.ANY_VALUE) {
        event.data[`${updateKey}`] = formSessionUrls[urlIndex++]
      }
      controller.enqueue(event)
    },
  })

  // Open the input data and output files for streaming
  //
  const inputStream = new StringReadableStream(inputData)
  const outputStream = await context.openWriteText(
    context.parameters.outputDataFile as string
  )

  // Apply the update transform to the input data and write the enriched
  // data to the output file.
  //
  console.log(
    `Writing form session URL values (${formSessionUrls.length}) to file: ${context.parameters.outputDataFile}`
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
 * Helper function to strip the root symbol ('$') from the JSONPath
 * expression provided (as required for materialization in the
 * evolve-data-transformations package).
 * @param path JSONPath expression for the search value
 * @returns The expression sans root symbol
 */
function getJsonPathExpression(path: string): string {
  return path.startsWith('$') ? path.substring(1) : path
}
