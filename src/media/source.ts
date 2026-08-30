/* global document, navigator, HTMLImageElement, HTMLVideoElement, MediaStream, Event, AbortSignal */

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
  return new NyxError(
    'Media source failed to load. Check the source and browser media support.',
    'MEDIA_LOAD_FAILED',
    'source',
    cause,
  )
}

function mediaAbortError(): NyxError {
  return new NyxError('Media source loading was cancelled', 'DESTROYED', 'source')
}

function removeElement(element: { remove: () => void }): void {
  element.remove()
}

function disposeUrlImage(element: HTMLImageElement): () => void {
  let disposed = false
  return () => {
    if (!disposed) {
      disposed = true
      element.src = ''
      removeElement(element)
    }
  }
}

function disposeUrlVideo(element: HTMLVideoElement): () => void {
  let disposed = false
  return () => {
    if (!disposed) {
      disposed = true
      element.pause()
      element.removeAttribute('src')
      element.load()
      removeElement(element)
    }
  }
}

function loadUrlImage(url: string, signal?: AbortSignal): Promise<ImageSource> {
  const element = document.createElement('img')

  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      element.removeEventListener('load', handleLoad)
      element.removeEventListener('error', handleError)
      signal?.removeEventListener('abort', handleAbort)
    }
    const handleAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      element.src = ''
      removeElement(element)
      reject(mediaAbortError())
    }
    const handleLoad = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve({
        kind: 'image',
        element,
        width: element.naturalWidth,
        height: element.naturalHeight,
        getFrameSource: () => element,
        dispose: disposeUrlImage(element),
      })
    }
    const handleError = (cause: Event) => {
      if (settled) return
      settled = true
      cleanup()
      removeElement(element)
      reject(mediaLoadError(cause))
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
    if (signal?.aborted) {
      handleAbort()
      return
    }
    element.addEventListener('load', handleLoad)
    element.addEventListener('error', handleError)
    try {
      element.crossOrigin = 'anonymous'
      element.src = url
    } catch (cause) {
      handleError(cause as Event)
    }
  })
}

function loadUrlVideo(url: string, signal?: AbortSignal): Promise<VideoSource> {
  const element = document.createElement('video')
  const dispose = disposeUrlVideo(element)

  return new Promise((resolve, reject) => {
    let settled = false
    let startingPlayback = false
    const cleanup = () => {
      element.removeEventListener('loadeddata', handleLoad)
      element.removeEventListener('error', handleError)
      signal?.removeEventListener('abort', handleAbort)
    }
    const handleAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      dispose()
      reject(mediaAbortError())
    }
    const handleLoad = async () => {
      if (settled || startingPlayback) return
      startingPlayback = true
      try {
        await element.play()
        if (settled) return
        settled = true
        cleanup()
        resolve({
          kind: 'video',
          element,
          width: element.videoWidth,
          height: element.videoHeight,
          getFrameSource: () => element,
          dispose,
        })
      } catch (cause) {
        if (settled) return
        settled = true
        cleanup()
        dispose()
        reject(mediaLoadError(cause))
      }
    }
    const handleError = (cause: Event) => {
      if (settled) return
      settled = true
      cleanup()
      dispose()
      reject(mediaLoadError(cause))
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
    if (signal?.aborted) {
      handleAbort()
      return
    }
    element.addEventListener('loadeddata', handleLoad)
    element.addEventListener('error', handleError)
    try {
      element.crossOrigin = 'anonymous'
      element.muted = true
      element.autoplay = true
      element.playsInline = true
      element.preload = 'auto'
      element.src = url
    } catch (cause) {
      handleError(cause as Event)
    }
  })
}

async function loadUserMedia(signal?: AbortSignal): Promise<VideoSource> {
  const element = document.createElement('video')
  element.autoplay = true
  element.muted = true
  element.playsInline = true

  let disposed = false
  let aborted = false
  let stream: MediaStream | undefined
  let rejectAbort!: (_error: NyxError) => void
  let cleanupMetadata = () => {}
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject
  })
  const stopStream = (value: MediaStream | undefined) => {
    value?.getTracks().forEach((track) => track.stop())
  }
  const dispose = (value = stream) => {
    if (disposed) return
    disposed = true
    if (value) element.pause()
    if (value) stopStream(value)
    element.srcObject = null
    removeElement(element)
  }
  const handleAbort = () => {
    if (aborted) return
    aborted = true
    cleanupMetadata()
    dispose()
    rejectAbort(mediaAbortError())
  }

  signal?.addEventListener('abort', handleAbort, { once: true })
  if (signal?.aborted) {
    handleAbort()
    throw mediaAbortError()
  }

  let acquisition: Promise<MediaStream>
  try {
    const getUserMedia = navigator.mediaDevices?.getUserMedia
    if (!getUserMedia) {
      throw new Error('Webcam access is unavailable in this browser or context')
    }
    acquisition = getUserMedia.call(navigator.mediaDevices, {
      video: true,
      audio: false,
    })
    acquisition.then((lateStream) => {
      if (aborted || disposed) stopStream(lateStream)
    }, () => {})
    stream = await Promise.race([acquisition, abortPromise])
  } catch (cause) {
    signal?.removeEventListener('abort', handleAbort)
    if (aborted || signal?.aborted) {
      throw cause instanceof NyxError ? cause : mediaAbortError()
    }
    dispose()
    const name =
      typeof cause === 'object' && cause !== null && 'name' in cause
        ? cause.name
        : undefined
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new NyxError(
        'Webcam permission was denied or the page is not allowed to use the camera',
        'WEBCAM_PERMISSION_DENIED',
        'source',
        cause,
      )
    }
    throw mediaLoadError(cause)
  }

  try {
    await Promise.race([new Promise<void>((resolve, reject) => {
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
      cleanupMetadata = cleanup

      element.addEventListener('loadedmetadata', handleMetadata)
      element.addEventListener('error', handleError)
      element.srcObject = stream
    }), abortPromise])
    await Promise.race([element.play(), abortPromise])
  } catch (cause) {
    signal?.removeEventListener('abort', handleAbort)
    dispose()
    if (aborted || signal?.aborted) {
      throw cause instanceof NyxError ? cause : mediaAbortError()
    }
    throw cause instanceof NyxError ? cause : mediaLoadError(cause)
  }

  signal?.removeEventListener('abort', handleAbort)

  return {
    kind: 'usermedia',
    element,
    width: element.videoWidth,
    height: element.videoHeight,
    getFrameSource: () => element,
    dispose: (() => {
      return () => {
        dispose()
      }
    })(),
  }
}

export function loadMediaSource(
  source: string | undefined,
  type: MediaType,
  signal?: AbortSignal,
): Promise<LoadedSource> {
  if (type === 'usermedia') {
    return loadUserMedia(signal)
  }

  const url = resolveMediaUrl(source ?? '')
  return type === 'image' ? loadUrlImage(url, signal) : loadUrlVideo(url, signal)
}
