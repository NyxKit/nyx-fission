/* global document, navigator, queueMicrotask, HTMLElement, MediaStream, DOMException */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NyxError } from '../errors'
import { loadMediaSource } from '../media/source'

function mediaElement(overrides: Record<string, unknown> = {}) {
  const listeners = new Map<string, () => void>()
  const element = {
    addEventListener: vi.fn((event: string, listener: () => void) => {
      listeners.set(event, listener)
    }),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    emit(event: string) {
      listeners.get(event)?.()
    },
  }
  Object.defineProperties(element, Object.getOwnPropertyDescriptors(overrides))

  return element
}

describe('loadMediaSource', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets anonymous CORS before assigning an image URL and waits for load', async () => {
    const assignments: string[] = []
    const image = mediaElement({
      naturalWidth: 320,
      naturalHeight: 180,
      set crossOrigin(value: string) {
        assignments.push(`crossOrigin:${value}`)
      },
      set src(value: string) {
        assignments.push(`src:${value}`)
        queueMicrotask(() => image.emit('load'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      image as unknown as HTMLElement,
    )

    const loaded = await loadMediaSource('./photo.jpg', 'image')

    expect(assignments).toEqual([
      'crossOrigin:anonymous',
      'src:http://localhost:3000/photo.jpg',
    ])
    expect(loaded).toMatchObject({ kind: 'image', width: 320, height: 180 })
    expect(loaded.getFrameSource()).toBe(image)
  })

  it('waits for video loadeddata and maps load errors', async () => {
    const video = mediaElement({
      videoWidth: 640,
      videoHeight: 360,
      set crossOrigin(_value: string) {},
      set src(_value: string) {
        queueMicrotask(() => video.emit('error'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      video as unknown as HTMLElement,
    )

    await expect(loadMediaSource('clip.mp4', 'video')).rejects.toMatchObject({
      code: 'MEDIA_LOAD_FAILED',
      stage: 'source',
    })

    const readyVideo = mediaElement({
      videoWidth: 640,
      videoHeight: 360,
      set crossOrigin(_value: string) {},
      set src(_value: string) {
        queueMicrotask(() => readyVideo.emit('loadeddata'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      readyVideo as unknown as HTMLElement,
    )
    await expect(loadMediaSource('clip.mp4', 'video')).resolves.toMatchObject({
      kind: 'video',
      width: 640,
      height: 360,
    })
  })

  it('requests webcam video without audio and disposes the stream and element', async () => {
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValueOnce(stream)
    const video = mediaElement({
      videoWidth: 800,
      videoHeight: 600,
      set srcObject(_value: MediaStream | null) {
        queueMicrotask(() => video.emit('loadedmetadata'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      video as unknown as HTMLElement,
    )

    const loaded = await loadMediaSource(undefined, 'usermedia')
    loaded.dispose()

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: true,
      audio: false,
    })
    expect(loaded).toMatchObject({ kind: 'usermedia', width: 800, height: 600 })
    expect(stop).toHaveBeenCalledOnce()
    expect(video.remove).toHaveBeenCalledOnce()
  })

  it('maps webcam permission rejection to a typed error', async () => {
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValueOnce(
      new DOMException('denied', 'NotAllowedError'),
    )

    const error = await loadMediaSource(undefined, 'usermedia').catch(
      (value: unknown) => value,
    )

    expect(error).toBeInstanceOf(NyxError)
    expect(error).toMatchObject({
      code: 'WEBCAM_PERMISSION_DENIED',
      stage: 'source',
    })
  })
})
