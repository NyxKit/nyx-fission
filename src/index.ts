import type { NyxFissionConfig } from './types'

export class NyxFission {
  constructor(_config: NyxFissionConfig = {}) {}
}

export type {
  MediaType,
  NyxErrorEvent,
  NyxEventMap,
  NyxEventName,
  NyxFissionConfig,
  ThemeName,
} from './types'
