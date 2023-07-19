/**
 * Copyright (c) 2021 Quadient Group AG
 * SPDX-License-Identifier: MIT
 */

export interface TransformdApiProfileSearchResponse {
  success: boolean
  data: ProfileSearchResponseData
}

export interface ProfileSearchResponseData {
  records: ProfileSearchResponseRecord[]
  count: number
}

export interface ProfileSearchResponseRecord {
  values: ProfileSearchResponseValues
  groupID: number
  lastUpdated: number
  created: number
  id: string
}

export interface ProfileSearchResponseValues {
  [key: string]: string
}
