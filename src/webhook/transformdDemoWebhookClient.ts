/**
 * Copyright (c) 2021 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

import { TransformdDemoWebhookResponse } from './transformdDemoWebhookResponse'

/**
 * Calls the Transformd Demo Webhook to initiate a Form Session. Constructed
 * with an Evolve web request connector to abstract the base URL and
 * other sensitive auth info.
 */
export class TransformdDemoWebhookClient {
  /**
   * Instantiates a TransformdDemoWebhookClient using the URL represented
   * by the connector provided.
   * @param connector The name of the connector to use
   */
  constructor(private readonly connector: string) {}

  /**
   * POSTS a JSON object to the Transformd Demo Webhook to initiate the
   * Form Session and returns the response.
   * @param payload An object (JSON) to send as the body
   * @returns Parsed object
   */
  async send(payload: object): Promise<TransformdDemoWebhookResponse> {
    const headers = new Headers()
    headers.append('Content-Type', 'application/json')
    headers.append('Accept', 'application/json')

    const response = await fetch(this.connector, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    })

    const json = await response.json()
    if (!response.ok) {
      throw new Error(
        `Non-OK webhook response: ${response.status} ${
          response.statusText
        }:${JSON.stringify(json)}`
      )
    }

    return json
  }
}
