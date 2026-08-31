/* global document, URL */

import { NyxError } from '../errors'
import { MediaType, NyxErrorStage } from '../types'

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'])
const videoExtensions = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v'])

export function inferMediaType(url: string): MediaType.Image | MediaType.Video {
  try {
    const pathname = new URL(url, document.baseURI).pathname
    const extension = pathname.split('.').pop()?.toLowerCase()

    if (extension && imageExtensions.has(extension)) {
      return MediaType.Image
    }

    if (extension && videoExtensions.has(extension)) {
      return MediaType.Video
    }
  } catch (cause) {
    throw new NyxError(
      'Media source type cannot be inferred from the URL',
      'MEDIA_TYPE_UNKNOWN',
       NyxErrorStage.Source,
      cause,
    )
  }

  throw new NyxError(
    'Media source type cannot be inferred from the URL',
    'MEDIA_TYPE_UNKNOWN',
     NyxErrorStage.Source,
  )
}

export function resolveMediaType(
  type: MediaType | undefined,
  sourceUrl: string,
): MediaType {
  if (type !== undefined) {
    return type
  }

  return inferMediaType(sourceUrl)
}
