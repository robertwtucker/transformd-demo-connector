/**
 * Copyright (c) 2023 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

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
        id: 'apiKey',
        displayName: 'Transformd API Key',
        description:
          'The key to use when authenticating with the Transformd API.',
        type: 'Secret',
        required: true,
      },
      {
        id: 'profileId',
        displayName: 'Profile (Dataset) ID',
        description:
          'The Transformd Profile (Dataset) ID associated with the Form to be used.',
        type: 'String',
        required: true,
      },
      {
        id: 'sessionIdSearchKey',
        displayName: 'Form Session Search Key Name',
        description: 'The fields key name to search for the unique Session ID.',
        defaultValue: 'claimNumber',
        type: 'String',
        required: true,
      },
      {
        id: 'sessionIdSearchValue',
        displayName: 'Form Session Search Value Path',
        description:
          'A JSONPath expression for the input data element(s) to use to match the unique Session ID.',
        defaultValue: 'concat($.Clients[*].ClientID,"-",$.Clients[*].ClaimID)',
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
  // Open input data fiie
  console.log(`Reading from ${context.parameters.inputDataFile}`)
  const inputFile = await context.openReadText(
    context.parameters.inputDataFile as string
  )

  // Delete output data file, if it exists
  try {
    console.log(`Deleting ${context.parameters.outputDataFile}`)
    await context.getFile(context.parameters.outputDataFile as string).delete()
  } catch (err) {
    // Ignore error if file does not exist
  }

  // Get the rest of the input parameters
  const outputDataPath = context.parameters.outputDataPath
  const webhookUrl = context.parameters.webhookUrl
  const webhookUsername = context.parameters.webhookUsername
  const webhookPassword = context.parameters.webhookPassword
  const apiKey = context.parameters.apiKey
  const profileId = context.parameters.profileId
  const sessionIdSearchKey = context.parameters.sessionIdSearchKey
  const sessionIdSearchValue = context.parameters.sessionIdSearchValue

  // Process input data File

  // Call webhook and process response

  // Call profile lookup api with search params and process response

  // Update input data file content with URL

  // Open output data file
  const outputFile = await context.openWriteText(
    context.parameters.target as string
  )

  // Write output stream to data file
}
