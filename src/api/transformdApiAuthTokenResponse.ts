/**
 * Copyright (c) 2021 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

export interface TransformdApiAuthTokenResponse {
  success: boolean
  data: AuthTokenResponseData
}

export interface AuthTokenResponseData {
  token: string
  expires: number
}
