/**
 * Copyright (c) 2021 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

export interface TransformdApiProfileSearchResponse {
  success: boolean
  data: Data
}

export interface Data {
  records: Record[]
  count: number
}

export interface Record {
  values: Values
  groupID: number
  lastUpdated: number
  created: number
  id: string
}

export interface Values {
  formSessionId: string
  claimIdentifier: string
  formStatus: string
  url: string
}
