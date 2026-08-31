/* global document, URL */

import { NyxError } from '../errors'
import { NyxErrorStage } from '../types'

export function resolveMediaUrl(
  source: string,
  base = document.baseURI,
): string {
  try {
    return new URL(source, base).href
  } catch (cause) {
    throw new NyxError(
      'Media source URL is invalid',
      'INVALID_CONFIG',
       NyxErrorStage.Source,
      cause,
    )
  }
}
