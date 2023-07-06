//
// Copyright (c) 2023 Quadient Group AG
// SPDX-License-Identifier: MIT
//

export function getDescription(): ScriptDescription {
  return {
    description:
      'Demo script for integration with Transformd. \
      Initiates a Form Session and writes the session URL to the \
      designated location in the data file.',
    icon: 'create_template',
    input: [
      {
        id: 'inputDataFile',
        displayName: 'Input Data File',
        description: 'Input data file to read from.',
        type: 'InputResource',
        required: true,
      },
      {
        id: 'outputDataFile',
        displayName: 'Output Data File',
        description: 'Output data file to write the URL-enhanced data to.',
        type: 'OutputResource',
        required: true,
      },
      {
        id: 'outputDataPath',
        displayName: 'URL Data JSONPath Expression',
        description:
          'A JSONPath expression for the data element to update \
          with the URL of the Form Session. If the path provided does not \
          exist, it will be created. If the path provided cannot be resolved \
          or the expression is invalid, the job will fail.',
        defaultValue: '$.Clients[*].variableName',
        type: 'OutputResource',
        required: true,
      },
      {
        id: 'webhookUrl',
        displayName: 'Webhook URL',
        description: 'The URL of the webhook to initiate the Form Session.',
        defaultValue: 'https://api.transformd.com/hooks/',
        type: 'String',
        required: true,
      },
      {
        id: 'webhookUsername',
        displayName: 'Webhook Username',
        description:
          'The username to use when initiating the Form Session via \
          the webhook. If blank, no authentication will be performed.',
        type: 'String',
        required: false,
      },
      {
        id: 'webhookPassword',
        displayName: 'Webhook Password',
        description:
          'The password to use when initiating the Form Session via \
          the webhook. If blank, no authentication will be performed.',
        type: 'Secret',
        required: false,
      },
      {
        id: 'apiKey',
        displayName: 'Transformd API Key',
        description:
          'The key to use for authenticating with the Transformd API.',
        type: 'Secret',
        required: true,
      },
      {
        id: 'profileId',
        displayName: 'Profile (Dataset) ID',
        description:
          'The Transformd Profile (Dataset) ID associated with \
          the Form to be used.',
        type: 'Number',
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
          'A JSONPath expression for the input data element(s) \
          to use to match the unique Session ID.',
        defaultValue: 'concat($.Clients[*].ClientID,"-",$.Clients[*].ClaimID)',
        type: 'String',
        required: true,
      },
    ],
    output: [],
  }
}

export async function execute(context: Context): Promise<void> {
  console.log('Hello world.')
}
