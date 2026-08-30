/* global Event, HTMLCanvasElement, ImageData, document, setTimeout, AbortSignal, process */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NyxError } from '../errors'

const mocks = vi.hoisted(() => ({
  loadMediaSource: vi.fn(),
  sample: vi.fn(),
  createParticleField: vi.fn(),
  updateParticleField: vi.fn(),
  resolveTheme: vi.fn(() => [[1, 1, 1]]),
  resolveMediaType: vi.fn((type: string | undefined) => type ?? 'image'),
  runtimeInstances: [] as Array<{ setField: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; errorCallback?: (_error: unknown) => void }>,
}))

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
  },
}))
vi.mock('../runtime', () => ({
  ThreeRuntime: class {
    setField = vi.fn()
    start = vi.fn()
    dispose = vi.fn()
    errorCallback: ((_error: unknown) => void) | undefined

    constructor(_canvas: HTMLCanvasElement, _field: unknown, errorCallback?: (_error: unknown) => void) {
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
    expect(() => new NyxFission({ source: './portrait.jpg', type: 'audio' as 'image' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'source' }),
    )
    expect(mocks.resolveMediaType).not.toHaveBeenCalled()
    expect(mocks.loadMediaSource).not.toHaveBeenCalled()
  })

  it('rejects an invalid theme before starting work', () => {
    expect(() => new NyxFission({ source: './portrait.jpg', theme: 'electric' as 'nyx' })).toThrowError(
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
    particles.on('loading', loading)

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
    particles.on('loading', loading)

    expect(loading).not.toHaveBeenCalled()
    await expect(particles.ready).rejects.toMatchObject({ code: 'INVALID_TARGET' })
    expect(loading).toHaveBeenCalledOnce()
    particles.destroy()
  })

  it('defers automatic target lookup until after loading', async () => {
    const lookup = vi.spyOn(document, 'querySelector')
    const particles = new NyxFission({ source: './portrait.jpg', querySelector: '#missing' })
    const loading = vi.fn()
    particles.on('loading', loading)

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
    particles.on('loading', loading)

    particles.mount(canvas())
    expect(loading).not.toHaveBeenCalled()
    await particles.ready

    expect(loading).toHaveBeenCalledOnce()
    particles.destroy()
  })

  it('defers explicit target validation and source work until after loading', async () => {
    const particles = new NyxFission({ source: './portrait.jpg' })
    const loading = vi.fn()
    particles.on('loading', loading)

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
    particles.on('error', (event) => errors.push(event))

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
    particles.on('loading', () => events.push('loading'))
    particles.on('ready', () => events.push('ready'))
    particles.on('destroy', () => events.push('destroy'))

    particles.mount(canvas())
    await particles.ready
    particles.destroy()
    particles.destroy()

    expect(events).toEqual(['loading', 'ready', 'destroy'])
  })

  it('emits one structured error and rejects ready with the original NyxError', async () => {
    const failure = new NyxError('bad media', 'MEDIA_LOAD_FAILED', 'source')
    mocks.loadMediaSource.mockRejectedValueOnce(failure)
    const particles = new NyxFission({ source: './portrait.jpg' })
    const errors: unknown[] = []
    particles.on('error', (event) => errors.push(event))

    particles.mount(canvas())
    await expect(particles.ready).rejects.toBe(failure)
    expect(errors).toEqual([{ error: failure, stage: 'source' }])
    expect((particles as unknown as { target?: unknown }).target).toBeUndefined()
    particles.destroy()
  })

  it('rejects later mounts with the original terminal failure', async () => {
    const failure = new NyxError('bad media', 'MEDIA_LOAD_FAILED', 'source')
    mocks.loadMediaSource.mockRejectedValueOnce(failure)
    const particles = new NyxFission({ source: './portrait.jpg' })
    const loading = vi.fn()
    const ready = vi.fn()
    particles.on('loading', loading)
    particles.on('ready', ready)

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

    const explicit = new NyxFission({ source: './portrait.jpg', type: 'video' })
    explicit.mount(canvas())
    await explicit.ready
    expect(mocks.resolveMediaType).toHaveBeenCalledWith('video', 'http://localhost:3000/portrait.jpg')
    expect(mocks.loadMediaSource).toHaveBeenLastCalledWith('./portrait.jpg', 'video', expect.any(AbortSignal))
    explicit.destroy()
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

  it('updates the existing field from each runtime frame', async () => {
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

    const frameCallback = runtime.start.mock.calls[0][0] as () => void
    frameCallback()

    expect(mocks.sample).toHaveBeenCalledTimes(initialCalls + 1)
    expect(mocks.updateParticleField).toHaveBeenCalled()
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
    const failure = new NyxError('Renderer resize failed', 'RENDERER_UNAVAILABLE', 'rendering')
    const particles = new NyxFission({ source: './portrait.jpg' })
    const errors: unknown[] = []
    const destroys = vi.fn()
    particles.on('error', (event) => errors.push(event))
    particles.on('destroy', destroys)

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
