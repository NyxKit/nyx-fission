/* global document, URL */

import { NyxError } from '../errors'
import type { MediaType } from '../types'

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'])
const videoExtensions = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v'])

export function inferMediaType(url: string): Exclude<MediaType, 'usermedia'> {
  try {
    const pathname = new URL(url, document.baseURI).pathname
    const extension = pathname.split('.').pop()?.toLowerCase()

    if (extension && imageExtensions.has(extension)) {
      return 'image'
    }

    if (extension && videoExtensions.has(extension)) {
      return 'video'
    }
  } catch (cause) {
    throw new NyxError(
      'Media source type cannot be inferred from the URL',
      'MEDIA_TYPE_UNKNOWN',
      'source',
      cause,
    )
  }

  throw new NyxError(
    'Media source type cannot be inferred from the URL',
    'MEDIA_TYPE_UNKNOWN',
    'source',
  )
}
