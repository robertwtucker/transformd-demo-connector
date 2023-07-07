/**
 * Copyright (c) 2021 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

import { TransformdDemoWebhookResponse } from './transformdDemoWebhookResponse'

export class TransformdDemoWebhookClient {
  private readonly url: string
  private readonly username: string
  private readonly password: string

  constructor(url: string, username = '', password = '') {
    this.url = url
    this.username = username
    this.password = password
  }

  /**
   * Calls the Transformd Demo Webhook with an object as the body of the
   * request.
   * to initiate a Form Session.
   * @param payload {object} An object (JSON) to send as the body
   * @returns Parsed object representing the response
   */
  async send(payload: object): Promise<TransformdDemoWebhookResponse> {
    const headers = new Headers()
    headers.append('Content-Type', 'application/json')
    headers.append('Accept', 'application/json')

    if (
      this.username.trim().length === 0 &&
      this.password.trim().length === 0
    ) {
      headers.append(
        'Authorization',
        `Basic ${btoa(`${this.username}:${this.password}`)}`
      )
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    })

    return response.json()
  }
}
