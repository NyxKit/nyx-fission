/* global Event, HTMLCanvasElement, ImageData, document, setTimeout, AbortSignal, process */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NyxError } from '../errors'
import { LumaKeyMode, MediaType, NyxErrorStage, NyxEvent, ThemeName, type ResolvedLumaKeyConfig } from '../types'

const mocks = vi.hoisted(() => ({
  loadMediaSource: vi.fn(),
  frameSampler: vi.fn(),
  sample: vi.fn(),
  createParticleField: vi.fn(),
  updateParticleField: vi.fn(),
  resolveTheme: vi.fn(() => [[1, 1, 1]]),
  resolveMediaType: vi.fn((type: string | undefined) => type ?? 'image'),
  runtimeInstances: [] as Array<{ setField: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; depth: number; lumaKey: ResolvedLumaKeyConfig; errorCallback?: (_error: unknown) => void }>,
}))

const FLOAT32_SAFE_DEPTH = 1_000_000

vi.mock('../media/source', () => ({ loadMediaSource: mocks.loadMediaSource }))
vi.mock('../media/type', () => ({ resolveMediaType: mocks.resolveMediaType }))
vi.mock('../themes', () => ({ resolveTheme: mocks.resolveTheme }))
vi.mock('../particles', () => ({
  createParticleField: mocks.createParticleField,
  updateParticleField: mocks.updateParticleField,
}))
vi.mock('../frame-sampler', () => ({
  FrameSampler: class {
    sample = mocks.sample
    dispose = vi.fn()

    constructor(source: unknown, mirror: boolean) {
      mocks.frameSampler(source, mirror)
    }
  },
}))
vi.mock('../runtime', () => ({
  ThreeRuntime: class {
    setField = vi.fn()
    start = vi.fn()
    dispose = vi.fn()
    errorCallback: ((_error: unknown) => void) | undefined

    depth: number

    lumaKey: ResolvedLumaKeyConfig

    constructor(_canvas: HTMLCanvasElement, _field: unknown, depth: number, lumaKey: ResolvedLumaKeyConfig, errorCallback?: (_error: unknown) => void) {
      this.depth = typeof depth === 'number' ? depth : 0
      this.lumaKey = lumaKey
      this.errorCallback = errorCallback
      mocks.runtimeInstances.push(this)
    }
  },
}))

import { NyxFission } from '../index'

function imageData(width = 2, height = 2): ImageData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) } as ImageData
}

function canvas(): HTMLCanvasElement {
  return document.createElement('canvas')
}

describe('NyxFission orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtimeInstances.length = 0
    mocks.sample.mockReturnValue(imageData())
    mocks.createParticleField.mockImplementation((_frame: ImageData) => ({
      positions: new Float32Array(_frame.width * _frame.height * 3),
      colors: new Float32Array(_frame.width * _frame.height * 3),
    }))
    mocks.updateParticleField.mockImplementation(() => undefined)
    mocks.loadMediaSource.mockResolvedValue({
      kind: 'image',
      width: 2,
      height: 2,
      getFrameSource: vi.fn(),
      dispose: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('rejects an invalid media type before starting work', () => {
    expect(() => new NyxFission({ source: './portrait.jpg', type: 'audio' as MediaType })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'source' }),
    )
    expect(mocks.resolveMediaType).not.toHaveBeenCalled()
    expect(mocks.loadMediaSource).not.toHaveBeenCalled()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('rejects non-finite depth %s', (depth) => {
    expect(() => new NyxFission({ source: './portrait.jpg', depth })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG' }),
    )
  })

  it.each([Number.MAX_VALUE, -Number.MAX_VALUE, FLOAT32_SAFE_DEPTH * 1.1, -FLOAT32_SAFE_DEPTH * 1.1])('rejects depth beyond the finite framing bound %s', (depth) => {
    expect(() => new NyxFission({ source: './portrait.jpg', depth })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'sampling' }),
    )
  })

  it.each([0, 0.5, -0.5, FLOAT32_SAFE_DEPTH, -FLOAT32_SAFE_DEPTH])('accepts finite depth %s', (depth) => {
    expect(Number.isFinite(Math.fround(depth))).toBe(true)
    expect(() => new NyxFission({ source: './portrait.jpg', depth })).not.toThrow()
  })

  it('passes the default depth to the runtime constructor', async () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    particles.mount(canvas())
    await particles.ready

    expect(mocks.runtimeInstances[0].depth).toBe(0.35)
    particles.destroy()
  })

  it.each([0.5, 0, -0.5])('passes explicit depth %s to the runtime constructor', async (depth) => {
    const particles = new NyxFission({ source: './portrait.jpg', depth })
    particles.mount(canvas())
    await particles.ready

    expect(mocks.runtimeInstances[0].depth).toBe(depth)
    particles.destroy()
  })

  it('passes default luma-key settings to the field and runtime constructors', async () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    particles.mount(canvas())
    await particles.ready

    expect(mocks.runtimeInstances[0].lumaKey).toEqual({ mode: LumaKeyMode.None, threshold: 0.1, coherence: 0 })
    expect(mocks.createParticleField).toHaveBeenCalledWith(expect.anything(), expect.anything(), { mode: LumaKeyMode.None, threshold: 0.1, coherence: 0 })
    particles.destroy()
  })

  it.each([LumaKeyMode.None, LumaKeyMode.Dark, LumaKeyMode.Light])('passes luma-key mode %s and threshold to the runtime constructor', async (mode) => {
    const particles = new NyxFission({ source: './portrait.jpg', lumaKey: { mode, threshold: 0.5, coherence: 0.4 } })
    particles.mount(canvas())
    await particles.ready

    expect(mocks.runtimeInstances[0].lumaKey).toEqual({ mode, threshold: 0.5, coherence: 0.4 })
    expect(mocks.createParticleField).toHaveBeenCalledWith(expect.anything(), expect.anything(), { mode, threshold: 0.5, coherence: 0.4 })
    particles.destroy()
  })

  it('passes the resolved luma-key filter when a dynamic frame changes dimensions', async () => {
    mocks.loadMediaSource.mockResolvedValueOnce({ kind: 'video', width: 2, height: 2, getFrameSource: vi.fn(), dispose: vi.fn() })
    mocks.sample.mockReset().mockReturnValueOnce(imageData(2, 2)).mockReturnValueOnce(imageData(3, 2))
    const filter = { mode: LumaKeyMode.Dark, threshold: 0.25, coherence: 0.75 }
    const particles = new NyxFission({ source: './portrait.jpg', lumaKey: filter })
    particles.mount(canvas())
    await particles.ready

    const runtime = mocks.runtimeInstances[0]
    ;(runtime.start.mock.calls[0][0] as (_time: number) => void)(1000)

    expect(mocks.createParticleField).toHaveBeenNthCalledWith(2, expect.anything(), expect.anything(), filter)
    particles.destroy()
  })

  it.each([0, 0.1, 1])('accepts luma-key threshold %s', (threshold) => {
    expect(() => new NyxFission({ source: './portrait.jpg', lumaKey: { mode: LumaKeyMode.Dark, threshold } })).not.toThrow()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01, 1.01, null as unknown as number])('rejects invalid luma-key threshold %s', (threshold) => {
    expect(() => new NyxFission({ source: './portrait.jpg', lumaKey: { mode: LumaKeyMode.Dark, threshold } })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'sampling' }),
    )
  })

  it.each([0, 0.1, 1])('accepts luma-key coherence %s', (coherence) => {
    expect(() => new NyxFission({ source: './portrait.jpg', lumaKey: { mode: LumaKeyMode.Dark, coherence } })).not.toThrow()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01, 1.01, null as unknown as number])('rejects invalid luma-key coherence %s', (coherence) => {
    expect(() => new NyxFission({ source: './portrait.jpg', lumaKey: { mode: LumaKeyMode.Dark, coherence } })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'sampling' }),
    )
  })

  it.each([null, {}, { threshold: 0.2 }])('rejects missing luma-key modes in %j', (lumaKey) => {
    expect(() => new NyxFission({ source: './portrait.jpg', lumaKey: lumaKey as any })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'sampling' }),
    )
  })

  it('defaults omitted luma values while preserving an explicit zero', async () => {
    const particles = new NyxFission({ source: './portrait.jpg', lumaKey: { mode: LumaKeyMode.Dark, threshold: 0, coherence: undefined } })
    particles.mount(canvas())
    await particles.ready
    expect(mocks.runtimeInstances[0].lumaKey).toEqual({ mode: LumaKeyMode.Dark, threshold: 0, coherence: 0 })
    particles.destroy()
  })

  it('rejects an unsupported nested luma-key mode before starting work', () => {
    expect(() => new NyxFission({ source: './portrait.jpg', lumaKey: { mode: 'mid' as LumaKeyMode } })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'sampling' }),
    )
  })

  it('rejects the removed flat luma-key configuration', () => {
    expect(() => new NyxFission({ source: './portrait.jpg', lumaKey: LumaKeyMode.Dark as unknown as { mode: LumaKeyMode } })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'sampling' }),
    )
  })

  it('rejects the removed top-level luma-key threshold from runtime configuration', () => {
    expect(() => new NyxFission({ source: './portrait.jpg', lumaKeyThreshold: 0.25 } as any)).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'sampling' }),
    )
  })

  it('rejects an invalid theme before starting work', () => {
    expect(() => new NyxFission({ source: './portrait.jpg', theme: 'electric' as ThemeName })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'sampling' }),
    )
    expect(mocks.resolveMediaType).not.toHaveBeenCalled()
    expect(mocks.loadMediaSource).not.toHaveBeenCalled()
  })

  it('resolves ready after explicit image mounting', async () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    const canvas = document.createElement('canvas')
    document.body.append(canvas)
    particles.mount(canvas)
    await expect(particles.ready).resolves.toBeUndefined()
    particles.destroy()
  })

  it('mounts automatically from querySelector and starts resolving immediately', async () => {
    const target = canvas()
    target.id = 'particles'
    document.body.append(target)

    const particles = new NyxFission({ source: './portrait.jpg', querySelector: '#particles' })

    await expect(particles.ready).resolves.toBeUndefined()
    expect(mocks.loadMediaSource).toHaveBeenCalledWith('./portrait.jpg', 'image', expect.any(AbortSignal))
    particles.destroy()
  })

  it('emits loading through a microtask before a delayed automatic target exists', async () => {
    const originalReadyState = document.readyState
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' })
    const particles = new NyxFission({ source: './portrait.jpg', querySelector: '#late-particles' })
    const loading = vi.fn()
    particles.on(NyxEvent.Loading, loading)

    expect(loading).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(loading).toHaveBeenCalledOnce()

    const target = canvas()
    target.id = 'late-particles'
    document.body.append(target)
    document.dispatchEvent(new Event('DOMContentLoaded'))
    await particles.ready

    expect(loading).toHaveBeenCalledOnce()
    particles.destroy()
    Object.defineProperty(document, 'readyState', { configurable: true, value: originalReadyState })
  })

  it('emits loading once before automatic target failure', async () => {
    const particles = new NyxFission({ source: './portrait.jpg', querySelector: '[' })
    const loading = vi.fn()
    particles.on(NyxEvent.Loading, loading)

    expect(loading).not.toHaveBeenCalled()
    await expect(particles.ready).rejects.toMatchObject({ code: 'INVALID_TARGET' })
    expect(loading).toHaveBeenCalledOnce()
    particles.destroy()
  })

  it('defers automatic target lookup until after loading', async () => {
    const lookup = vi.spyOn(document, 'querySelector')
    const particles = new NyxFission({ source: './portrait.jpg', querySelector: '#missing' })
    const loading = vi.fn()
    particles.on(NyxEvent.Loading, loading)

    expect(lookup).not.toHaveBeenCalled()
    expect(loading).not.toHaveBeenCalled()
    await expect(particles.ready).rejects.toMatchObject({ code: 'TARGET_NOT_FOUND' })

    expect(loading).toHaveBeenCalledOnce()
    expect(lookup).toHaveBeenCalled()
    particles.destroy()
  })

  it('delivers one loading event to listeners for an explicit mount', async () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    const loading = vi.fn()
    particles.on(NyxEvent.Loading, loading)

    particles.mount(canvas())
    expect(loading).not.toHaveBeenCalled()
    await particles.ready

    expect(loading).toHaveBeenCalledOnce()
    particles.destroy()
  })

  it('defers explicit target validation and source work until after loading', async () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    const loading = vi.fn()
    particles.on(NyxEvent.Loading, loading)

    particles.mount(document.createElement('div') as unknown as HTMLCanvasElement)

    expect(loading).not.toHaveBeenCalled()
    expect(mocks.loadMediaSource).not.toHaveBeenCalled()
    await expect(particles.ready).rejects.toMatchObject({ code: 'INVALID_TARGET' })
    expect(loading).toHaveBeenCalledOnce()
    particles.destroy()
  })

  it('ignores a queued selector failure after same-stack explicit mounting', async () => {
    const errors: unknown[] = []
    const particles = new NyxFission({ source: './portrait.jpg', querySelector: '[' })
    particles.on(NyxEvent.Error, (event) => errors.push(event))

    particles.mount(canvas())
    await expect(particles.ready).resolves.toBeUndefined()
    await Promise.resolve()

    expect(errors).toEqual([])
    expect(mocks.loadMediaSource).toHaveBeenCalledOnce()
    particles.destroy()
  })

  it('waits for target, source, and the first sampled field before ready', async () => {
    let resolveSource!: (_source: unknown) => void
    mocks.loadMediaSource.mockReturnValueOnce(new Promise((resolve) => { resolveSource = resolve }))
    const particles = new NyxFission({ source: './portrait.jpg' })
    const ready = particles.ready
    const target = canvas()

    particles.mount(target)
    await Promise.resolve()
    expect(await Promise.race([ready.then(() => 'ready'), Promise.resolve('pending')])).toBe('pending')
    expect(mocks.sample).not.toHaveBeenCalled()

    resolveSource({ kind: 'image', width: 2, height: 2, getFrameSource: vi.fn(), dispose: vi.fn() })
    await expect(ready).resolves.toBeUndefined()
    expect(mocks.sample).toHaveBeenCalledOnce()
    particles.destroy()
  })

  it('emits loading, ready, and destroy in lifecycle order', async () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    const events: string[] = []
    particles.on(NyxEvent.Loading, () => events.push('loading'))
    particles.on(NyxEvent.Ready, () => events.push('ready'))
    particles.on(NyxEvent.Destroy, () => events.push('destroy'))

    particles.mount(canvas())
    await particles.ready
    particles.destroy()
    particles.destroy()

    expect(events).toEqual(['loading', 'ready', 'destroy'])
  })

  it('emits one structured error and rejects ready with the original NyxError', async () => {
    const failure = new NyxError('bad media', 'MEDIA_LOAD_FAILED', NyxErrorStage.Source)
    mocks.loadMediaSource.mockRejectedValueOnce(failure)
    const particles = new NyxFission({ source: './portrait.jpg' })
    const errors: unknown[] = []
    particles.on(NyxEvent.Error, (event) => errors.push(event))

    particles.mount(canvas())
    await expect(particles.ready).rejects.toBe(failure)
    expect(errors).toEqual([{ error: failure, stage: 'source' }])
    expect((particles as unknown as { target?: unknown }).target).toBeUndefined()
    particles.destroy()
  })

  it('rejects later mounts with the original terminal failure', async () => {
    const failure = new NyxError('bad media', 'MEDIA_LOAD_FAILED', NyxErrorStage.Source)
    mocks.loadMediaSource.mockRejectedValueOnce(failure)
    const particles = new NyxFission({ source: './portrait.jpg' })
    const loading = vi.fn()
    const ready = vi.fn()
    particles.on(NyxEvent.Loading, loading)
    particles.on(NyxEvent.Ready, ready)

    particles.mount(canvas())
    await expect(particles.ready).rejects.toBe(failure)

    expect(() => particles.mount(canvas())).toThrowError(failure)
    expect(loading).toHaveBeenCalledOnce()
    expect(ready).not.toHaveBeenCalled()
    particles.destroy()
  })

  it('infers image type and honors an explicit type override', async () => {
    const inferred = new NyxFission({ source: './portrait.jpg' })
    inferred.mount(canvas())
    await inferred.ready
    expect(mocks.resolveMediaType).toHaveBeenCalledWith(undefined, 'http://localhost:3000/portrait.jpg')
    inferred.destroy()

    const explicit = new NyxFission({ source: './portrait.jpg', type: MediaType.Video })
    explicit.mount(canvas())
    await explicit.ready
    expect(mocks.resolveMediaType).toHaveBeenCalledWith('video', 'http://localhost:3000/portrait.jpg')
    expect(mocks.loadMediaSource).toHaveBeenLastCalledWith('./portrait.jpg', 'video', expect.any(AbortSignal))
    explicit.destroy()
  })

  it('mirrors only usermedia sources when constructing the sampler', async () => {
    mocks.loadMediaSource
      .mockResolvedValueOnce({ kind: 'image', width: 2, height: 2, getFrameSource: vi.fn(), dispose: vi.fn() })
      .mockResolvedValueOnce({ kind: 'video', width: 2, height: 2, getFrameSource: vi.fn(), dispose: vi.fn() })
      .mockResolvedValueOnce({ kind: 'usermedia', width: 2, height: 2, getFrameSource: vi.fn(), dispose: vi.fn() })

    const image = new NyxFission({ source: './portrait.jpg', type: MediaType.Image })
    image.mount(canvas())
    await image.ready
    image.destroy()

    const video = new NyxFission({ source: './portrait.mp4', type: MediaType.Video })
    video.mount(canvas())
    await video.ready
    video.destroy()

    const usermedia = new NyxFission({ type: MediaType.Usermedia })
    usermedia.mount(canvas())
    await usermedia.ready

    expect(mocks.frameSampler).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'image' }), false)
    expect(mocks.frameSampler).toHaveBeenNthCalledWith(2, expect.objectContaining({ kind: 'video' }), false)
    expect(mocks.frameSampler).toHaveBeenNthCalledWith(3, expect.objectContaining({ kind: 'usermedia' }), true)
    usermedia.destroy()
  })

  it('rejects duplicate mounts', () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    void particles.ready.catch(() => undefined)
    particles.mount(canvas())

    expect(() => particles.mount(canvas())).toThrowError(
      expect.objectContaining({ code: 'INVALID_TARGET', stage: 'lifecycle' }),
    )
    particles.destroy()
  })

  it('destroys partially-created resources and rejects future mounts as DESTROYED', async () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    particles.mount(canvas())
    await particles.ready
    const runtime = mocks.runtimeInstances[0]
    const source = await mocks.loadMediaSource.mock.results[0].value as { dispose: ReturnType<typeof vi.fn> }

    particles.destroy()
    expect(source.dispose).toHaveBeenCalledOnce()
    expect(runtime.dispose).toHaveBeenCalledOnce()
    expect(() => particles.mount(canvas())).toThrowError(
      expect.objectContaining({ code: 'DESTROYED' }),
    )
  })

  it.each(['video', 'usermedia'] as const)('updates luminance on later %s frames without replacing the field or runtime', async (kind) => {
    mocks.loadMediaSource.mockResolvedValueOnce({ kind, width: 2, height: 2, getFrameSource: vi.fn(), dispose: vi.fn() })
    const firstFrame = imageData()
    firstFrame.data[0] = 32
    const laterFrame = imageData()
    laterFrame.data[0] = 224
    mocks.sample.mockReset()
    mocks.sample.mockReturnValueOnce(firstFrame).mockReturnValueOnce(laterFrame)
    mocks.createParticleField.mockImplementation((_frame: ImageData) => ({
      positions: new Float32Array([1, 2, 3]),
      colors: new Float32Array(3),
      luminance: new Float32Array([_frame.data[0] / 255]),
    }))
    mocks.updateParticleField.mockImplementation((field: { luminance: Float32Array }, frame: ImageData) => {
      field.luminance[0] = frame.data[0] / 255
    })
    const particles = new NyxFission({ source: './portrait.jpg' })
    particles.mount(canvas())
    await particles.ready
    const runtime = mocks.runtimeInstances[0]
    const field = mocks.createParticleField.mock.results[0].value as { positions: Float32Array; luminance: Float32Array }
    const initialPositions = field.positions.slice()

    const frameCallback = runtime.start.mock.calls[0][0] as () => void
    frameCallback()

    expect(field.luminance[0]).toBeCloseTo(224 / 255)
    expect(field.positions).toEqual(initialPositions)
    expect(mocks.createParticleField).toHaveBeenCalledOnce()
    expect(mocks.runtimeInstances).toHaveLength(1)
    expect(runtime.setField).toHaveBeenCalledWith(field)
    particles.destroy()
  })

  it('paces dynamic sampling to the internal maximum frame rate', async () => {
    mocks.loadMediaSource.mockResolvedValueOnce({
      kind: 'video',
      width: 2,
      height: 2,
      getFrameSource: vi.fn(),
      dispose: vi.fn(),
    })
    const particles = new NyxFission({ source: './portrait.jpg' })
    particles.mount(canvas())
    await particles.ready
    const runtime = mocks.runtimeInstances[0]
    const initialCalls = mocks.sample.mock.calls.length
    const frameCallback = runtime.start.mock.calls[0][0] as (_time: number) => void

    frameCallback(1000)
    frameCallback(1010)
    frameCallback(1033)
    frameCallback(1033 + 1000 / 30 + 1)

    expect(mocks.sample).toHaveBeenCalledTimes(initialCalls + 2)
    expect(mocks.updateParticleField).toHaveBeenCalledTimes(2)
    particles.destroy()
  })

  it('does not resample a static image on runtime frames', async () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    particles.mount(canvas())
    await particles.ready
    const runtime = mocks.runtimeInstances[0]
    const initialCalls = mocks.sample.mock.calls.length

    const frameCallback = runtime.start.mock.calls[0][0] as () => void
    frameCallback()

    expect(mocks.sample).toHaveBeenCalledTimes(initialCalls)
    expect(mocks.updateParticleField).not.toHaveBeenCalled()
    particles.destroy()
  })

  it('reports asynchronous runtime failures after ready without throwing', async () => {
    const failure = new NyxError('Renderer resize failed', 'RENDERER_UNAVAILABLE', NyxErrorStage.Rendering)
    const particles = new NyxFission({ source: './portrait.jpg' })
    const errors: unknown[] = []
    const destroys = vi.fn()
    particles.on(NyxEvent.Error, (event) => errors.push(event))
    particles.on(NyxEvent.Destroy, destroys)

    particles.mount(canvas())
    await particles.ready
    const runtime = mocks.runtimeInstances[0]

    expect(() => runtime.errorCallback?.(failure)).not.toThrow()
    expect(errors).toEqual([{ error: failure, stage: 'rendering' }])
    expect(runtime.dispose).toHaveBeenCalledOnce()
    expect(await particles.ready.catch((error: unknown) => error)).toBeUndefined()
    expect(() => particles.mount(canvas())).toThrowError(failure)
    expect((particles as unknown as { target?: unknown; field?: unknown; source?: unknown; sampler?: unknown; runtime?: unknown })).toMatchObject({
      target: undefined,
      field: undefined,
      source: undefined,
      sampler: undefined,
      runtime: undefined,
    })
    particles.destroy()
    particles.destroy()
    expect(destroys).toHaveBeenCalledOnce()
  })

  it('disposes a source that resolves after orchestration is destroyed', async () => {
    let resolveSource!: (_source: unknown) => void
    mocks.loadMediaSource.mockReturnValueOnce(new Promise((resolve) => { resolveSource = resolve }))
    const source = { kind: 'image', width: 2, height: 2, getFrameSource: vi.fn(), dispose: vi.fn() }
    const particles = new NyxFission({ source: './portrait.jpg' })
    void particles.ready.catch(() => undefined)
    particles.mount(canvas())
    await vi.waitFor(() => expect(mocks.loadMediaSource).toHaveBeenCalledOnce())

    particles.destroy()
    resolveSource(source)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(source.dispose).toHaveBeenCalledOnce()
    expect(mocks.runtimeInstances).toHaveLength(0)
  })

  it('does not report an unhandled ready rejection when destroyed during loading', async () => {
    let resolveSource!: (_source: unknown) => void
    mocks.loadMediaSource.mockReturnValueOnce(new Promise((resolve) => { resolveSource = resolve }))
    const particles = new NyxFission({ source: './portrait.jpg' })
    particles.mount(canvas())
    await vi.waitFor(() => expect(mocks.loadMediaSource).toHaveBeenCalledOnce())
    const unhandled: unknown[] = []
    const handleUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', handleUnhandled)

    particles.destroy()
    resolveSource({ dispose: vi.fn() })
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off('unhandledRejection', handleUnhandled)

    expect(unhandled).toEqual([])
  })
})
