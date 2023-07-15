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
  '649d05946e46b619dd2916a2': string
  '649d05ad98ad2b366f360962': string
  '649d05cc95422e559574f8f2': string
  '64a54c3631e6326de51ca7a2': string
}
