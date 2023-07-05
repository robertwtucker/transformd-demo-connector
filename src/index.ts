//
// Copyright (c) 2023 Quadient Group AG
// SPDX-License-Identifier: MIT
//

export function getDescription(): ScriptDescription {
  return {
    description: 'Transformd Demo Connector',
  }
}

export async function execute(context: Context): Promise<void> {
  console.log('Hello world.')
}
