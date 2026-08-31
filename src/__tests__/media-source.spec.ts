/* global document, navigator, queueMicrotask, HTMLElement, MediaStream, DOMException, AbortController */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NyxError } from '../errors'
import { loadMediaSource } from '../media/source'
import { MediaType } from '../types'

type MediaElementMethods = {
  remove: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  emit: (_event: string) => void
}

function mediaElement<T extends Record<string, unknown>>(
  overrides: T,
): T & MediaElementMethods {
  const listeners = new Map<string, () => void>()
  const element = {
    addEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.set(_event, listener)
    }),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    emit(event: string) {
      listeners.get(event)?.()
    },
  }
  Object.defineProperties(element, Object.getOwnPropertyDescriptors(overrides))

  return element as unknown as T & MediaElementMethods
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

    const loaded = await loadMediaSource('./photo.jpg', MediaType.Image)

    expect(assignments).toEqual([
      'crossOrigin:anonymous',
      'src:http://localhost:3000/photo.jpg',
    ])
    expect(loaded).toMatchObject({ kind: 'image', width: 320, height: 180 })
    expect(loaded.getFrameSource()).toBe(image)
  })

  it('resets a successfully loaded image source before idempotent removal', async () => {
    const sources: string[] = []
    const image = mediaElement({
      naturalWidth: 320,
      naturalHeight: 180,
      set crossOrigin(_value: string) {},
      set src(value: string) {
        sources.push(value)
        queueMicrotask(() => image.emit('load'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      image as unknown as HTMLElement,
    )

    const loaded = await loadMediaSource('./photo.jpg', MediaType.Image)
    loaded.dispose()
    loaded.dispose()

    expect(sources).toEqual(['http://localhost:3000/photo.jpg', ''])
    expect(image.remove).toHaveBeenCalledOnce()
  })

  it('waits for video loadeddata and maps load errors', async () => {
    const video = mediaElement({
      videoWidth: 640,
      videoHeight: 360,
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      set crossOrigin(_value: string) {},
      set src(_value: string) {
        queueMicrotask(() => video.emit('error'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      video as unknown as HTMLElement,
    )

    await expect(loadMediaSource('clip.mp4', MediaType.Video)).rejects.toMatchObject({
      code: 'MEDIA_LOAD_FAILED',
      stage: 'source',
    })
    expect(video.pause).toHaveBeenCalledOnce()
    expect(video.removeAttribute).toHaveBeenCalledWith('src')
    expect(video.load).toHaveBeenCalledOnce()
    expect(video.remove).toHaveBeenCalledOnce()

    const readyVideo = mediaElement({
      videoWidth: 640,
      videoHeight: 360,
      play: vi.fn().mockResolvedValue(undefined),
      set crossOrigin(_value: string) {},
      set src(_value: string) {
        queueMicrotask(() => readyVideo.emit('loadeddata'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      readyVideo as unknown as HTMLElement,
    )
    await expect(loadMediaSource('clip.mp4', MediaType.Video)).resolves.toMatchObject({
      kind: 'video',
      width: 640,
      height: 360,
    })
  })

  it('starts URL video playback after readiness and maps play rejection', async () => {
    const assignments: string[] = []
    let ready = false
    let currentTime = 12
    let loop = false
    let autoplay = false
    let muted = false
    let playsInline = false
    const video = mediaElement({
      videoWidth: 640,
      videoHeight: 360,
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      play: vi.fn(() => {
        expect(ready).toBe(true)
        expect(loop).toBe(true)
        expect(autoplay).toBe(true)
        expect(muted).toBe(true)
        expect(playsInline).toBe(true)
        expect(currentTime).toBe(0)
        return Promise.reject(new Error('autoplay blocked'))
      }),
      get currentTime() {
        return currentTime
      },
      set currentTime(value: number) {
        currentTime = value
      },
      get loop() {
        return loop
      },
      set loop(value: boolean) {
        loop = value
      },
      get autoplay() {
        return autoplay
      },
      set autoplay(value: boolean) {
        autoplay = value
      },
      get muted() {
        return muted
      },
      set muted(value: boolean) {
        muted = value
      },
      get playsInline() {
        return playsInline
      },
      set playsInline(value: boolean) {
        playsInline = value
      },
      set crossOrigin(value: string) {
        assignments.push(`crossOrigin:${value}`)
      },
      set src(_value: string) {
        assignments.push('src')
        queueMicrotask(() => {
          ready = true
          video.emit('loadeddata')
        })
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      video as unknown as HTMLElement,
    )

    const error = await loadMediaSource('clip.mp4', MediaType.Video).catch(
      (value: unknown) => value,
    )

    expect(assignments).toEqual(['crossOrigin:anonymous', 'src'])
    expect(loop).toBe(true)
    expect(autoplay).toBe(true)
    expect(muted).toBe(true)
    expect(playsInline).toBe(true)
    expect(currentTime).toBe(0)
    expect(video.play).toHaveBeenCalledOnce()
    expect(error).toBeInstanceOf(NyxError)
    expect(error).toMatchObject({ code: 'MEDIA_LOAD_FAILED', stage: 'source' })
    expect(video.pause).toHaveBeenCalledOnce()
    expect(video.removeAttribute).toHaveBeenCalledWith('src')
    expect(video.load).toHaveBeenCalledOnce()
    expect(video.remove).toHaveBeenCalledOnce()
  })

  it('requests webcam video without audio and disposes the stream and element', async () => {
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValueOnce(stream)
    const video = mediaElement({
      videoWidth: 800,
      videoHeight: 600,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      set srcObject(_value: MediaStream | null) {
        queueMicrotask(() => video.emit('loadedmetadata'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      video as unknown as HTMLElement,
    )

    const loaded = await loadMediaSource(undefined, MediaType.Usermedia)
    loaded.dispose()
    loaded.dispose()

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: true,
      audio: false,
    })
    expect(loaded).toMatchObject({ kind: 'usermedia', width: 800, height: 600 })
    expect(stop).toHaveBeenCalledOnce()
    expect(video.pause).toHaveBeenCalledOnce()
    expect(video.remove).toHaveBeenCalledOnce()
  })

  it('maps webcam permission rejection to a typed error', async () => {
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValueOnce(
      new DOMException('denied', 'NotAllowedError'),
    )

    const error = await loadMediaSource(undefined, MediaType.Usermedia).catch(
      (value: unknown) => value,
    )

    expect(error).toBeInstanceOf(NyxError)
    expect(error).toMatchObject({
      code: 'WEBCAM_PERMISSION_DENIED',
      stage: 'source',
    })
  })

  it('maps missing media APIs to a typed media load error', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    })

    const error = await loadMediaSource(undefined, MediaType.Usermedia).catch(
      (value: unknown) => value,
    )

    expect(error).toBeInstanceOf(NyxError)
    expect(error).toMatchObject({ code: 'MEDIA_LOAD_FAILED', stage: 'source' })
  })

  it('maps non-permission webcam failures to MEDIA_LOAD_FAILED', async () => {
    const cause = new DOMException('No camera', 'NotFoundError')
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValueOnce(cause)

    const error = await loadMediaSource(undefined, MediaType.Usermedia).catch(
      (value: unknown) => value,
    )

    expect(error).toMatchObject({
      code: 'MEDIA_LOAD_FAILED',
      stage: 'source',
      cause,
    })
  })

  it('starts webcam playback after metadata and cleans up when playback fails', async () => {
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValueOnce(stream)
    const video = mediaElement({
      videoWidth: 800,
      videoHeight: 600,
      pause: vi.fn(),
      play: vi.fn().mockRejectedValue(new Error('autoplay blocked')),
      set srcObject(_value: MediaStream | null) {
        queueMicrotask(() => video.emit('loadedmetadata'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      video as unknown as HTMLElement,
    )

    const error = await loadMediaSource(undefined, MediaType.Usermedia).catch(
      (value: unknown) => value,
    )

    expect(video.play).toHaveBeenCalledOnce()
    expect(error).toMatchObject({ code: 'MEDIA_LOAD_FAILED', stage: 'source' })
    expect(stop).toHaveBeenCalledOnce()
    expect(video.remove).toHaveBeenCalledOnce()
  })

  it('pauses and clears URL video resources idempotently', async () => {
    const video = mediaElement({
      videoWidth: 640,
      videoHeight: 360,
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      set crossOrigin(_value: string) {},
      set src(_value: string) {
        queueMicrotask(() => video.emit('loadeddata'))
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      video as unknown as HTMLElement,
    )

    const loaded = await loadMediaSource('clip.mp4', MediaType.Video)
    loaded.dispose()
    loaded.dispose()

    expect(video.pause).toHaveBeenCalledOnce()
    expect(video.removeAttribute).toHaveBeenCalledWith('src')
    expect(video.load).toHaveBeenCalledOnce()
    expect(video.remove).toHaveBeenCalledOnce()
  })

  it('maps synchronous URL assignment failures and removes the element', async () => {
    const image = mediaElement({
      set crossOrigin(_value: string) {},
      set src(_value: string) {
        throw new Error('blocked assignment')
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      image as unknown as HTMLElement,
    )

    const error = await loadMediaSource('photo.jpg', MediaType.Image).catch(
      (value: unknown) => value,
    )

    expect(error).toMatchObject({ code: 'MEDIA_LOAD_FAILED', stage: 'source' })
    expect(image.remove).toHaveBeenCalledOnce()
  })

  it('aborts a pending image load and removes its listeners and element', async () => {
    const assignments: string[] = []
    const image = mediaElement({
      set crossOrigin(_value: string) {},
      set src(value: string) { assignments.push(value) },
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(image as unknown as HTMLElement)
    const controller = new AbortController()
    const loading = loadMediaSource('photo.jpg', MediaType.Image, controller.signal)

    controller.abort()

    await expect(loading).rejects.toMatchObject({ code: 'DESTROYED', stage: 'source' })
    expect(image.removeEventListener).toHaveBeenCalledWith('load', expect.any(Function))
    expect(image.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    expect(assignments).toEqual(['http://localhost:3000/photo.jpg', ''])
    expect(image.remove).toHaveBeenCalledOnce()
  })

  it('aborts a pending video load and clears its media element', async () => {
    const video = mediaElement({
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      set crossOrigin(_value: string) {},
      set src(_value: string) {},
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(video as unknown as HTMLElement)
    const controller = new AbortController()
    const loading = loadMediaSource('clip.mp4', MediaType.Video, controller.signal)

    controller.abort()

    await expect(loading).rejects.toMatchObject({ code: 'DESTROYED', stage: 'source' })
    expect(video.pause).toHaveBeenCalledOnce()
    expect(video.removeAttribute).toHaveBeenCalledWith('src')
    expect(video.load).toHaveBeenCalledOnce()
    expect(video.remove).toHaveBeenCalledOnce()
  })

  it('cleans a webcam stream that resolves after acquisition is aborted', async () => {
    let resolveStream!: (_stream: MediaStream) => void
    const getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockReturnValueOnce(
      new Promise((resolve) => { resolveStream = resolve }) as Promise<MediaStream>,
    )
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    const video = mediaElement({
      pause: vi.fn(),
      set srcObject(_value: MediaStream | null) {},
    })
    vi.spyOn(document, 'createElement').mockReturnValueOnce(video as unknown as HTMLElement)
    const controller = new AbortController()
    const loading = loadMediaSource(undefined, MediaType.Usermedia, controller.signal)

    controller.abort()
    await expect(loading).rejects.toMatchObject({ code: 'DESTROYED', stage: 'source' })
    resolveStream(stream)
    await Promise.resolve()
    await Promise.resolve()

    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
    expect(video.remove).toHaveBeenCalledOnce()
  })
})
