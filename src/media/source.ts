/* global document, navigator, HTMLImageElement, HTMLVideoElement, MediaStream, Event */

import { NyxError } from '../errors'
import type { MediaType } from '../types'
import { resolveMediaUrl } from './url'

type ImageSource = {
  kind: 'image'
  element: HTMLImageElement
  width: number
  height: number
  getFrameSource: () => HTMLImageElement
  dispose: () => void
}

type VideoSource = {
  kind: 'video' | 'usermedia'
  element: HTMLVideoElement
  width: number
  height: number
  getFrameSource: () => HTMLVideoElement
  dispose: () => void
}

export type LoadedSource = ImageSource | VideoSource

function mediaLoadError(cause: unknown): NyxError {
  return new NyxError('Media source failed to load', 'MEDIA_LOAD_FAILED', 'source', cause)
}

function removeElement(element: { remove: () => void }): void {
  element.remove()
}

function loadUrlImage(url: string): Promise<ImageSource> {
  const element = document.createElement('img')
  element.crossOrigin = 'anonymous'

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      element.removeEventListener('load', handleLoad)
      element.removeEventListener('error', handleError)
    }
    const handleLoad = () => {
      cleanup()
      resolve({
        kind: 'image',
        element,
        width: element.naturalWidth,
        height: element.naturalHeight,
        getFrameSource: () => element,
        dispose: () => removeElement(element),
      })
    }
    const handleError = (cause: Event) => {
      cleanup()
      removeElement(element)
      reject(mediaLoadError(cause))
    }

    element.addEventListener('load', handleLoad)
    element.addEventListener('error', handleError)
    element.src = url
  })
}

function loadUrlVideo(url: string): Promise<VideoSource> {
  const element = document.createElement('video')
  element.crossOrigin = 'anonymous'
  element.preload = 'auto'

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      element.removeEventListener('loadeddata', handleLoad)
      element.removeEventListener('error', handleError)
    }
    const handleLoad = () => {
      cleanup()
      resolve({
        kind: 'video',
        element,
        width: element.videoWidth,
        height: element.videoHeight,
        getFrameSource: () => element,
        dispose: () => removeElement(element),
      })
    }
    const handleError = (cause: Event) => {
      cleanup()
      removeElement(element)
      reject(mediaLoadError(cause))
    }

    element.addEventListener('loadeddata', handleLoad)
    element.addEventListener('error', handleError)
    element.src = url
  })
}

async function loadUserMedia(): Promise<VideoSource> {
  const element = document.createElement('video')
  element.autoplay = true
  element.muted = true
  element.playsInline = true

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  } catch (cause) {
    removeElement(element)
    throw new NyxError(
      'Webcam permission was denied',
      'WEBCAM_PERMISSION_DENIED',
      'source',
      cause,
    )
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const handleMetadata = () => {
        cleanup()
        resolve()
      }
      const handleError = (cause: Event) => {
        cleanup()
        reject(mediaLoadError(cause))
      }
      const cleanup = () => {
        element.removeEventListener('loadedmetadata', handleMetadata)
        element.removeEventListener('error', handleError)
      }

      element.addEventListener('loadedmetadata', handleMetadata)
      element.addEventListener('error', handleError)
      element.srcObject = stream
    })
  } catch (cause) {
    stream.getTracks().forEach((track) => track.stop())
    removeElement(element)
    throw cause
  }

  return {
    kind: 'usermedia',
    element,
    width: element.videoWidth,
    height: element.videoHeight,
    getFrameSource: () => element,
    dispose: () => {
      stream.getTracks().forEach((track) => track.stop())
      element.srcObject = null
      removeElement(element)
    },
  }
}

export function loadMediaSource(
  source: string | undefined,
  type: MediaType,
): Promise<LoadedSource> {
  if (type === 'usermedia') {
    return loadUserMedia()
  }

  const url = resolveMediaUrl(source ?? '')
  return type === 'image' ? loadUrlImage(url) : loadUrlVideo(url)
}
