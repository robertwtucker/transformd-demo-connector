/**
 * Copyright (c) 2021 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

import { TransformdApiAuthTokenResponse } from './transformdApiAuthTokenResponse'
import { TransformdApiProfileSearchResponse } from './transformdApiSearchProfileResponse'

export class TransformdApiClient {
  private readonly connector: string
  private token: string
  private tokenExpires: number

  /**
   * Instantiates a TransformdApiClient using the URL represented by the
   * connector provided.
   * @param {string} connector The name of the connector to use
   */
  constructor(connector: string) {
    this.connector = connector
    this.token = ''
    this.tokenExpires = 0
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
    urlencoded.append(
      'timestamp',
      Math.floor(new Date().getTime() / 1000).toString()
    )
    urlencoded.append('nonce', createGuid())

    const response = await fetch(`${this.connector}/v2/auth/token`, {
      method: 'POST',
      headers: headers,
      body: urlencoded.toString(),
    })

    const json = await response.json()
    if (!response.ok) {
      throw new Error(
        `Non-OK API response: ${response.status} ${
          response.statusText
        }:${JSON.stringify(json)}`
      )
    }

    console.debug(`API:/auth/token response: ${JSON.stringify(json)}`)

    if (json && json.success) {
      this.token = json.data.token
      this.tokenExpires = json.data.expires
    } else {
      throw new Error(
        `Invalid API response body (JSON): ${JSON.stringify(json)}`
      )
    }

    console.debug(`API token: '${this.token}`)
    console.debug(`API token expires: '${this.tokenExpires}`)

    return json
  }

  /**
   * Search the Profile Records (Dataset Legacy) using the criteria provided
   * to find the URL for the Form Session initiated by the Webhook.
   * @param {string} profileId The Profile ID to use
   * @param {string} searchKey Key value to use in the fields collection
   * @param {string} searchValue Unique identifier to use as the search value
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

    const body = `{"fields":{"${searchKey}":"${searchValue}"}}`
    console.debug(`API request body: ${body}`)
    const response = await fetch(
      `${this.connector}/v2/profile/search?id=${profileId}&scope=1`,
      {
        method: 'POST',
        headers: headers,
        body: '{"fields":{"claimNumber":"*"}}', // TODO: Replace with actual body when fixed
      }
    )

    const json = await response.json()
    if (!response.ok) {
      throw new Error(
        `Non-OK API response: ${response.status} ${
          response.statusText
        }:${JSON.stringify(json)}`
      )
    }

    console.debug(`API:/v2/profile/search returned ${json.data.count} records`)

    if (json && json.success) {
      // WORKAROUND: Transformd API currently returning everything _but_ the
      // desired record. For now, find it and adjust the response manually.
      let url = ''
      json.data.records = [json.data.records[json.data.count - 1]]
      json.data.count = 1
      url = json.data.records[0].values['64a54c3631e6326de51ca7a2']
      console.debug(`API:/v2/profile/search response: ${JSON.stringify(json)}`)
      console.debug(`Form session URL: ${url.length > 0 ? url : 'not found!'}`)
    } else {
      throw new Error(
        `Invalid API response body (JSON): ${JSON.stringify(json)}`
      )
    }

    return json
  }

  /**
   * Checks if the client has a valid authentication token.
   * @returns {boolean} True if the client has a valid token
   */
  isAuthenticated(): boolean {
    return this.token.length > 0 && this.tokenExpires > new Date().getTime()
  }
}
