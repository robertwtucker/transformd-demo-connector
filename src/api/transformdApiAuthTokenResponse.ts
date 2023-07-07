/**
 * Copyright (c) 2021 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

export interface TransformdApiAuthTokenResponse {
  success: boolean
  data: Data
}

export interface Data {
  token: string
  expires: number
}
