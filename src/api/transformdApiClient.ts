/**
 * Copyright (c) 2021 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

import { TransformdApiAuthTokenResponse } from './transformdApiAuthTokenResponse'
import { TransformdApiProfileSearchResponse } from './transformdApiSearchProfileResponse'

export class TransformdApiClient {
  private readonly connector: string
  private token: string

  /**
   * Instantiates a TransformdApiClient using the URL represented by the
   * connector provided.
   * @param {string} connector The name of the connector to use
   */
  constructor(connector: string, token = '') {
    this.connector = connector
    this.token = token
  }

  /**
   * Generates a new API token for the user and stores it in the client for
   * use in subsequent requests. The entire response body is returned as a
   * convenience.
   * @returns {Promise<TransformdApiAuthTokenResponse>} Parsed object
   */
  async getAuthToken(): Promise<TransformdApiAuthTokenResponse> {
    const headers = new Headers()
    headers.append('Accept', 'application/json')
    headers.append('Content-Type', 'application/x-www-form-urlencoded')

    const urlencoded = new URLSearchParams()
    urlencoded.append('timestamp', Date.now().toString())
    urlencoded.append('nonce', createGuid())

    const response = await fetch(`${this.connector}/v2/auth/token`, {
      method: 'POST',
      headers: headers,
      body: urlencoded.toString(),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}-${response.text()}`)
    }

    return response.json()
  }

  /**
   * Search the Profile Records (Dataset Legacy) using the criteria provided
   * to find the URL for the Form Session initiated by the Webhook.
   * @param {string} profileId The Profile ID to use
   * @param {string} searchKey Key value to use in the fields collection
   * @param {string} searchValue A unique identifier to use as the search value.
   * @returns {Promise<TransformdApiProfileSearchResponse>} Parsed object
   */
  async searchProfile(
    profileId: string,
    searchKey: string,
    searchValue: string
  ): Promise<TransformdApiProfileSearchResponse> {
    const headers = new Headers()
    headers.append('Accept', 'application/json')
    headers.append('Content-Type', 'application/json')
    headers.append('Token', this.token)

    const body = JSON.parse(`{fields:{${searchKey}:${searchValue}}}`)

    const response = await fetch(
      `${this.connector}/v2/profile/search?id=${profileId}&scope=1`,
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}-${response.text()}`)
    }

    return response.json()
  }
}
