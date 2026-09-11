/* global HTMLCanvasElement, ResizeObserver, ResizeObserverCallback, ResizeObserverEntry, FrameRequestCallback, document, MouseEvent, performance, DOMRect */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NyxError } from '../errors'
import { EntranceController } from '../entrance'
import { ThreeRuntime } from '../runtime'
import { EntranceAnimationType, LumaKeyMode, NyxInteraction, type ResolvedLumaKeyConfig } from '../types'
import type { ParticleField } from '../particles'
import fragmentShader from '../shaders/particles.frag.glsl?raw'
import vertexShader from '../shaders/particles.vert.glsl?raw'

const FLOAT32_SAFE_DEPTH = 1_000_000

const three = vi.hoisted(() => {
  class Scene {
    add = vi.fn()
    remove = vi.fn()
  }

  class PerspectiveCamera {
    fov: number
    aspect: number
    near: number
    far: number
    position = { z: 0 }
    lookAt = vi.fn()
    updateProjectionMatrix = vi.fn()

    constructor(fov: number, aspect: number, near: number, far: number) {
      this.fov = fov
      this.aspect = aspect
      this.near = near
      this.far = far
    }
  }

  class BufferGeometry {
    attributes: Record<string, Float32BufferAttribute> = {}
    setAttribute = vi.fn()
    dispose = vi.fn()

    constructor() {
      this.setAttribute.mockImplementation((name: string, attribute: Float32BufferAttribute) => {
        this.attributes[name] = attribute
      })
    }
  }

  class Float32BufferAttribute {
    array: Float32Array
    needsUpdate = false

    constructor(array: Float32Array, _itemSize: number) {
      this.array = array
    }
  }

  class ShaderMaterial {
    depthWrite = true
    dispose = vi.fn()
    uniforms: Record<string, { value: unknown }>

    constructor(parameters: { uniforms: Record<string, { value: unknown }> }) {
      this.uniforms = parameters.uniforms
    }
  }

  class Points {
    visible = true
    frustumCulled = true
    constructor(_geometry: BufferGeometry, _material: ShaderMaterial) {}
  }

  let nextResizeFailure: Error | undefined

  class WebGLRenderer {
    domElement: HTMLCanvasElement
    setSize = vi.fn()
    render = vi.fn()
    dispose = vi.fn()

    constructor(parameters: { canvas: HTMLCanvasElement; alpha: boolean; antialias: boolean }) {
      this.domElement = parameters.canvas
      if (nextResizeFailure) {
        const cause = nextResizeFailure
        nextResizeFailure = undefined
        this.setSize.mockImplementationOnce(() => {
          throw cause
        })
      }
    }
  }

  return {
    Scene: vi.fn((...args: unknown[]) => Reflect.construct(Scene, args)),
    PerspectiveCamera: vi.fn((...args: unknown[]) => Reflect.construct(PerspectiveCamera, args)),
    BufferGeometry: vi.fn((...args: unknown[]) => Reflect.construct(BufferGeometry, args)),
    Float32BufferAttribute: vi.fn((...args: unknown[]) => Reflect.construct(Float32BufferAttribute, args)),
    ShaderMaterial: vi.fn((...args: unknown[]) => Reflect.construct(ShaderMaterial, args)),
    Points: vi.fn((...args: unknown[]) => Reflect.construct(Points, args)),
    WebGLRenderer: vi.fn((...args: unknown[]) => Reflect.construct(WebGLRenderer, args)),
    failNextResize: (cause: Error) => {
      nextResizeFailure = cause
    },
  }
})

vi.mock('three', () => three)

function field(pointCount = 1): ParticleField {
  return {
    positions: new Float32Array(pointCount * 3),
    colors: new Float32Array(pointCount * 3).fill(1),
    luminance: new Float32Array(pointCount).fill(0.5),
    coherence: new Float32Array(pointCount).fill(0.75),
  } as ParticleField
}

function lumaKey(mode = LumaKeyMode.None, threshold = 0.1, coherence = 0): ResolvedLumaKeyConfig {
  return { mode, threshold, coherence }
}

function createRuntime(target: HTMLCanvasElement, particles: ParticleField, depth: number, filter = lumaKey(), onError?: (_error: unknown) => void): ThreeRuntime {
  return new ThreeRuntime(target, particles, depth, filter, onError)
}

function canvas(width = 640, height = 360): HTMLCanvasElement {
  const target = document.createElement('canvas')
  Object.defineProperty(target, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(target, 'clientHeight', { configurable: true, value: height })
  return target
}

describe('ThreeRuntime', () => {
  let requestFrame: ReturnType<typeof vi.fn>
  let cancelFrame: ReturnType<typeof vi.fn>
  let resizeCallback: ResizeObserverCallback
  let observer: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }
  let resizeObserver: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    requestFrame = vi.fn(() => 42)
    cancelFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)
    observer = { observe: vi.fn(), disconnect: vi.fn() }
    resizeObserver = vi.fn((callback: ResizeObserverCallback) => {
      resizeCallback = callback
      return observer
    })
    vi.stubGlobal('ResizeObserver', resizeObserver)
  })

  it('creates and attaches the Three.js particle scene', () => {
    const target = canvas()

    const runtime = createRuntime(target, field(), 0.35, lumaKey(LumaKeyMode.Dark, 0.25, 0.4))

    expect(three.Scene).toHaveBeenCalledTimes(1)
    expect(three.PerspectiveCamera).toHaveBeenCalledWith(50, 640 / 360, expect.any(Number), expect.any(Number))
    const camera = vi.mocked(three.PerspectiveCamera).mock.results[0].value
    expect(camera.position.z).toBeGreaterThan(0.35)
    expect(camera.lookAt).toHaveBeenCalledWith(0, 0, 0)
    expect(camera.near).toBeLessThan(camera.position.z - 0.35)
    expect(camera.far).toBeGreaterThan(camera.position.z + 0.35)
    expect(three.BufferGeometry).toHaveBeenCalledTimes(1)
    expect(three.Points).toHaveBeenCalledTimes(1)
    expect(three.ShaderMaterial).toHaveBeenCalledTimes(1)
    const uniforms = vi.mocked(three.ShaderMaterial).mock.results[0].value.uniforms
    expect(uniforms.depth.value).toBe(0.35)
    expect(uniforms.lumaKeyMode.value).toBe(1)
    expect(uniforms.lumaKeyThreshold.value).toBe(0.25)
    expect(uniforms.lumaKeyCoherence.value).toBe(0.4)
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.attributes.luminance.array).toHaveLength(1)
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.attributes.coherence.array).toHaveLength(1)
    expect(three.WebGLRenderer).toHaveBeenCalledWith({ canvas: target, alpha: true, antialias: true })
    expect(observer.observe).toHaveBeenCalledWith(target)

    runtime.dispose()
  })

  it.each([NyxInteraction.Attract, NyxInteraction.Repel, NyxInteraction.Push, NyxInteraction.Pull])('renders %s after entrance completion and restores clipping on release', (type) => {
    const target = canvas()
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 640, height: 360 } as DOMRect)
    let time = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => time)
    const entrance = new EntranceController({ type: EntranceAnimationType.Gather, duration: 1000 })
    const runtime = new ThreeRuntime(target, field(), 0, lumaKey(), undefined, entrance, { type, duration: 300, delay: 200 })
    const camera = three.PerspectiveCamera.mock.results.at(-1)!.value
    const geometry = three.BufferGeometry.mock.results.at(-1)!.value
    const points = three.Points.mock.results.at(-1)!.value
    const normal = { near: camera.near, far: camera.far, z: camera.position.z }
    entrance.ready()
    runtime.start(vi.fn())
    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback
    frame(0)
    const event = new MouseEvent('pointerenter', { clientX: 300, clientY: 180 })
    Object.defineProperty(event, 'pointerId', { value: 1 })
    target.dispatchEvent(event)
    frame(500)
    expect([...geometry.attributes.interactionOffset.array]).toEqual([0, 0, 0])
    frame(1000)
    frame(1300)
    if (type !== NyxInteraction.Attract) expect(geometry.attributes.interactionOffset.array.some((value: number) => value !== 0)).toBe(true)
    expect(camera.near).toBeLessThan(normal.near)
    expect(camera.far).toBeGreaterThan(normal.far)
    expect(camera.position.z).toBe(normal.z)
    expect(points.frustumCulled).toBe(false)
    expect(geometry.attributes.position.needsUpdate).toBe(false)
    time = 1300
    const leave = new MouseEvent('pointerleave')
    Object.defineProperty(leave, 'pointerId', { value: 1 })
    target.dispatchEvent(leave)
    frame(1300)
    frame(1500)
    frame(1800)
    expect([...geometry.attributes.interactionOffset.array]).toEqual([0, 0, 0])
    expect(camera.near).toBe(normal.near)
    expect(camera.far).toBe(normal.far)
    expect(points.frustumCulled).toBe(true)
    const remove = vi.spyOn(target, 'removeEventListener')
    runtime.dispose()
    expect(remove).toHaveBeenCalledWith('pointermove', expect.any(Function))
    clock.mockRestore()
  })

  it.each([EntranceAnimationType.Depth, EntranceAnimationType.Scatter].flatMap(type => [-1_000_000, -1, 0, 1, 1_000_000].map(depth => [type, depth] as const)))('animates %s at depth %s with safe clipping, stable buffers, and exact settlement', async (type, depth) => {
    const entrance = new EntranceController({ type, autoStart: false, duration: 1000 })
    const runtime = new ThreeRuntime(canvas(), field(), depth, lumaKey(), undefined, entrance)
    const camera = three.PerspectiveCamera.mock.results[0].value
    const points = three.Points.mock.results[0].value
    const material = three.ShaderMaterial.mock.results[0].value
    const normalFar = camera.far
    const normalZ = camera.position.z
    expect(points.visible).toBe(false)
    const callback = vi.fn()
    entrance.ready()
    runtime.start(callback)
    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback
    frame(0)
    const completed = entrance.play()
    frame(10)
    expect(callback).toHaveBeenLastCalledWith(10, true)
    expect(points.visible).toBe(true)
    expect(points.frustumCulled).toBe(false)
    expect(material.depthWrite).toBe(false)
    expect(camera.position.z).toBe(normalZ)
    expect(material.uniforms.entranceOriginZ.value).toBeLessThan(Math.min(0, depth))
    expect(camera.far).toBeGreaterThan(camera.position.z - material.uniforms.entranceOriginZ.value)
    expect(Number.isFinite(camera.far)).toBe(true)
    frame(510)
    resizeCallback([{ contentRect: { width: 360, height: 800 } } as ResizeObserverEntry], observer as unknown as ResizeObserver)
    runtime.setField(field(4))
    frame(610)
    expect(material.uniforms.entranceProgress.value).toBe(0.6)
    frame(1010)
    await completed
    expect(camera.far).toBe(normalFar)
    expect(material.uniforms.entranceType.value).toBe(0)
    expect(points.frustumCulled).toBe(true)
    expect(material.depthWrite).toBe(true)
    expect(three.BufferGeometry).toHaveBeenCalledTimes(2)
    const replay = entrance.play()
    frame(1020)
    expect(callback).toHaveBeenLastCalledWith(1020, true)
    frame(2020)
    await replay
    expect(three.BufferGeometry).toHaveBeenCalledTimes(2)
    runtime.dispose()
  })

  it('does not report entrance completion when the final draw fails', () => {
    const end = vi.fn()
    const onError = vi.fn()
    const entrance = new EntranceController({ type: EntranceAnimationType.Fade, duration: 0 }, undefined, end)
    const runtime = new ThreeRuntime(canvas(), field(), 0, lumaKey(), onError, entrance)
    entrance.ready()
    const failure = new Error('GPU failure')
    three.WebGLRenderer.mock.results[0].value.render.mockImplementation(() => { throw failure })
    runtime.start(vi.fn())
    ;(requestFrame.mock.calls[0][0] as FrameRequestCallback)(0)
    expect(onError).toHaveBeenCalledWith(failure)
    expect(end).not.toHaveBeenCalled()
    entrance.cancel(failure)
  })

  it('updates scan bounds when a new media aspect retains the particle count', () => {
    const landscape = field(2)
    landscape.positions.set([-1, -0.25, 0, 1, 0.25, 0])
    const portrait = field(2)
    portrait.positions.set([-0.25, -1, 0, 0.25, 1, 0])
    const entrance = new EntranceController({ type: EntranceAnimationType.ScanTopToBottom })
    const runtime = new ThreeRuntime(canvas(), landscape, 0, lumaKey(), undefined, entrance)
    entrance.ready()
    runtime.start(vi.fn())
    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback
    frame(0)
    runtime.setField(portrait)
    frame(200)
    const uniforms = three.ShaderMaterial.mock.results[0].value.uniforms
    expect(uniforms.entranceHalfWidth.value).toBe(0.25)
    expect(uniforms.entranceHalfHeight.value).toBe(1)
    expect(uniforms.entranceProgress.value).toBe(0.2)
    expect(three.BufferGeometry).toHaveBeenCalledOnce()
    runtime.dispose()
    entrance.cancel(new Error('done'))
  })

  it.each([
    [LumaKeyMode.None, 0],
    [LumaKeyMode.Dark, 1],
    [LumaKeyMode.Light, 2],
  ] as const)('maps %s to the corresponding shader mode', (mode, numericMode) => {
    const runtime = createRuntime(canvas(), field(), 0.35, lumaKey(mode, 0.25, 0.6))

    const uniforms = vi.mocked(three.ShaderMaterial).mock.results[0].value.uniforms
    expect(uniforms.lumaKeyMode.value).toBe(numericMode)
    expect(uniforms.lumaKeyThreshold.value).toBe(0.25)
    expect(uniforms.lumaKeyCoherence.value).toBe(0.6)
    runtime.dispose()
  })

  it('schedules the internal loop and delegates each frame callback', () => {
    const callback = vi.fn()
    const runtime = createRuntime(canvas(), field(), 0.35)
    const renderer = vi.mocked(three.WebGLRenderer).mock.results[0].value
    const scene = vi.mocked(three.Scene).mock.results[0].value
    const camera = vi.mocked(three.PerspectiveCamera).mock.results[0].value

    runtime.start(callback)

    expect(requestFrame).toHaveBeenCalledOnce()
    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback
    frame(123)

    expect(callback).toHaveBeenCalledWith(123)
    expect(renderer.render).toHaveBeenCalledWith(scene, camera)
    expect(requestFrame).toHaveBeenCalledTimes(2)
    runtime.dispose()
  })

  it('does not start a second loop when a frame callback calls start', () => {
    let runtime: ThreeRuntime
    const callback = vi.fn(() => runtime.start(callback))
    runtime = createRuntime(canvas(), field(), 0.35)
    runtime.start(callback)

    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback
    frame(123)

    expect(callback).toHaveBeenCalledOnce()
    expect(requestFrame).toHaveBeenCalledTimes(2)
    runtime.dispose()
  })

  it('does not render or schedule another frame when the callback disposes', () => {
    const renderer = vi.mocked(three.WebGLRenderer)
    let runtime: ThreeRuntime
    runtime = createRuntime(canvas(), field(), 0.35)
    runtime.start(() => runtime.dispose())

    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback
    frame(123)

    expect(renderer.mock.results[0].value.render).not.toHaveBeenCalled()
    expect(requestFrame).toHaveBeenCalledOnce()
  })

  it('reports and disposes the runtime when a frame callback throws', () => {
    const cause = new Error('frame failed')
    const onError = vi.fn()
    const runtime = createRuntime(canvas(), field(), 0, lumaKey(), onError)
    runtime.start(() => {
      throw cause
    })

    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback

    expect(() => frame(123)).not.toThrow()
    expect(onError).toHaveBeenCalledWith(cause)
    expect(requestFrame).toHaveBeenCalledOnce()
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.WebGLRenderer).mock.results[0].value.dispose).toHaveBeenCalledOnce()
  })

  it('resizes the renderer and camera from the content box', () => {
    const target = canvas()
    const runtime = createRuntime(target, field(), 0.35)

    resizeCallback([{ contentRect: { width: 800, height: 400 } } as ResizeObserverEntry], observer as unknown as ResizeObserver)

    const camera = vi.mocked(three.PerspectiveCamera).mock.results[0].value
    expect(vi.mocked(three.WebGLRenderer).mock.results[0].value.setSize).toHaveBeenLastCalledWith(800, 400, false)
    expect(camera.aspect).toBe(2)
    expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(3)
    runtime.dispose()
  })

  it('keeps the same perspective framing when resized to portrait', () => {
    const runtime = createRuntime(canvas(), field(), -0.75)
    const camera = vi.mocked(three.PerspectiveCamera).mock.results[0].value
    const initialZ = camera.position.z

    resizeCallback([{ contentRect: { width: 360, height: 640 } } as ResizeObserverEntry], observer as unknown as ResizeObserver)

    expect(camera.aspect).toBe(360 / 640)
    expect(camera.position.z).toBe(initialZ)
    const nearestPlaneDistance = initialZ - 0.75
    const visibleHalfHeight = nearestPlaneDistance * Math.tan((camera.fov * Math.PI) / 360)
    expect(visibleHalfHeight).toBeGreaterThanOrEqual(0.5)
    expect(visibleHalfHeight * camera.aspect).toBeGreaterThanOrEqual(camera.aspect / 2)
    expect(camera.near).toBeLessThan(nearestPlaneDistance)
    expect(camera.far).toBeGreaterThan(initialZ + 0.75)
    runtime.dispose()
  })

  it('frames the full field on landscape resize as well', () => {
    const runtime = createRuntime(canvas(), field(), 0.75)
    const camera = vi.mocked(three.PerspectiveCamera).mock.results[0].value

    resizeCallback([{ contentRect: { width: 1280, height: 360 } } as ResizeObserverEntry], observer as unknown as ResizeObserver)

    const nearestPlaneDistance = camera.position.z - 0.75
    const visibleHalfHeight = nearestPlaneDistance * Math.tan((camera.fov * Math.PI) / 360)
    expect(visibleHalfHeight).toBeGreaterThanOrEqual(0.5)
    expect(visibleHalfHeight * camera.aspect).toBeGreaterThanOrEqual(camera.aspect / 2)
    runtime.dispose()
  })

  it.each([FLOAT32_SAFE_DEPTH, -FLOAT32_SAFE_DEPTH])('keeps camera framing and the shader uniform finite at the supported depth bound %s', (depth) => {
    const runtime = createRuntime(canvas(), field(), depth)
    const camera = vi.mocked(three.PerspectiveCamera).mock.results[0].value
    const material = vi.mocked(three.ShaderMaterial).mock.results[0].value

    expect(Number.isFinite(camera.position.z)).toBe(true)
    expect(camera.position.z).toBeGreaterThan(0)
    expect(Number.isFinite(camera.near)).toBe(true)
    expect(camera.near).toBeGreaterThan(0)
    expect(Number.isFinite(camera.far)).toBe(true)
    expect(camera.far).toBeGreaterThan(camera.near)
    expect(Number.isFinite(Math.fround(depth))).toBe(true)
    expect(Number.isFinite(Math.fround(material.uniforms.depth.value as number))).toBe(true)
    expect(material.uniforms.depth.value).toBe(depth)
    runtime.dispose()
  })

  it.each([FLOAT32_SAFE_DEPTH * 1.1, Number.MAX_VALUE])('rejects depth beyond the supported framing bound %s', (depth) => {
    expect(() => createRuntime(canvas(), field(), depth)).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'rendering' }),
    )
  })

  it.each([
    { mode: 'mid' as LumaKeyMode, threshold: 0.1, coherence: 0 },
    { mode: LumaKeyMode.Dark, threshold: Number.NaN, coherence: 0 },
    { mode: LumaKeyMode.Dark, threshold: 0.1, coherence: Number.POSITIVE_INFINITY },
    { mode: LumaKeyMode.Dark, threshold: -0.01, coherence: 0 },
    { mode: LumaKeyMode.Dark, threshold: 0.1, coherence: 1.01 },
  ])('rejects invalid luma-key settings at the rendering boundary', (filter) => {
    expect(() => createRuntime(canvas(), field(), 0, filter)).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'rendering' }),
    )
  })

  it('disposes all owned resources and the pending frame', () => {
    const runtime = createRuntime(canvas(), field(), 0.35)
    const scene = vi.mocked(three.Scene).mock.results[0].value
    const points = vi.mocked(three.Points).mock.results[0].value
    const camera = vi.mocked(three.PerspectiveCamera).mock.results[0].value
    const material = vi.mocked(three.ShaderMaterial).mock.results[0].value
    const renderer = vi.mocked(three.WebGLRenderer).mock.results[0].value
    runtime.start(vi.fn())

    runtime.dispose()
    runtime.dispose()

    expect(cancelFrame).toHaveBeenCalledWith(42)
    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.WebGLRenderer).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect((runtime as unknown as { frameCallback?: unknown }).frameCallback).toBeUndefined()
    expect(scene.remove).toHaveBeenCalledWith(points)
    expect(runtime).toMatchObject({
      canvas: undefined,
      scene: undefined,
      camera: undefined,
      material: undefined,
      renderer: undefined,
      observer: undefined,
      positionAttribute: undefined,
      colorAttribute: undefined,
      luminanceAttribute: undefined,
      coherenceAttribute: undefined,
      points: undefined,
      geometry: undefined,
    })
    expect(camera.updateProjectionMatrix).toHaveBeenCalled()
    expect(material.dispose).toHaveBeenCalledOnce()
    expect(renderer.dispose).toHaveBeenCalledOnce()
  })

  it('ignores queued resize callbacks after disposal', () => {
    const runtime = createRuntime(canvas(), field(), 0.35)
    const renderer = vi.mocked(three.WebGLRenderer).mock.results[0].value
    const camera = vi.mocked(three.PerspectiveCamera).mock.results[0].value

    runtime.dispose()
    resizeCallback([{ contentRect: { width: 800, height: 400 } } as ResizeObserverEntry], observer as unknown as ResizeObserver)

    expect(renderer.setSize).toHaveBeenCalledOnce()
    expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(2)
  })

  it('reports and disposes a typed error when observed resize fails', () => {
    const cause = new Error('resize failed')
    const onError = vi.fn()
    const runtime = createRuntime(canvas(), field(), 0, lumaKey(), onError)
    const renderer = vi.mocked(three.WebGLRenderer).mock.results[0].value
    renderer.setSize.mockImplementationOnce(() => {
      throw cause
    })
    runtime.start(vi.fn())

    resizeCallback([{ contentRect: { width: 800, height: 400 } } as ResizeObserverEntry], observer as unknown as ResizeObserver)

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'RENDERER_UNAVAILABLE', stage: 'rendering', cause, message: 'Renderer resize failed' }))
    expect(cancelFrame).toHaveBeenCalledWith(42)
    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(renderer.dispose).toHaveBeenCalledOnce()
  })

  it('cleans up resources when ResizeObserver construction fails', () => {
    const cause = new Error('observer unavailable')
    resizeObserver.mockImplementationOnce(() => {
      throw cause
    })

    let thrown: unknown
    try {
      createRuntime(canvas(), field(), 0)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(NyxError)
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.WebGLRenderer).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(thrown).toMatchObject({ code: 'RENDERER_UNAVAILABLE', cause })
  })

  it('cleans up resources when ResizeObserver.observe fails', () => {
    const cause = new Error('observe failed')
    observer.observe.mockImplementationOnce(() => {
      throw cause
    })

    let thrown: unknown
    try {
      createRuntime(canvas(), field(), 0)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(NyxError)
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.WebGLRenderer).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(thrown).toMatchObject({ code: 'RENDERER_UNAVAILABLE', cause })
  })

  it('updates existing buffer attributes in place when field sizes match', () => {
    const runtime = createRuntime(canvas(), field(), 0.35)
    const geometry = vi.mocked(three.BufferGeometry).mock.results[0].value
    const attributes = vi.mocked(three.Float32BufferAttribute).mock.results
    const initialPosition = attributes[0].value
    const initialColor = attributes[1].value
    const initialLuminance = attributes[2].value
    const initialCoherence = attributes[3].value
    const initialCoherenceArray = initialCoherence.array
    const nextField = field()
    nextField.positions[0] = 0.5
    nextField.colors[0] = 0.25
    nextField.luminance[0] = 0.75
    nextField.coherence[0] = 0.25

    runtime.setField(nextField)

    expect(vi.mocked(three.BufferGeometry)).toHaveBeenCalledOnce()
    expect(geometry.dispose).not.toHaveBeenCalled()
    expect(vi.mocked(three.Float32BufferAttribute)).toHaveBeenCalledTimes(4)
    expect(initialPosition.array[0]).toBe(0.5)
    expect(initialPosition.needsUpdate).toBe(true)
    expect(initialColor.array[0]).toBe(0.25)
    expect(initialColor.needsUpdate).toBe(true)
    expect(initialLuminance.array[0]).toBe(0.75)
    expect(initialLuminance.needsUpdate).toBe(true)
    expect(initialCoherence.array[0]).toBe(0.25)
    expect(initialCoherence.array).toBe(initialCoherenceArray)
    expect(initialCoherence.needsUpdate).toBe(true)
    runtime.dispose()
  })

  it('replaces and disposes geometry when field sizes change', () => {
    const runtime = createRuntime(canvas(), field(), 0.35)
    const geometry = vi.mocked(three.BufferGeometry).mock.results[0].value

    runtime.setField(field(2))

    expect(geometry.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.BufferGeometry)).toHaveBeenCalledTimes(2)
    const replacementGeometry = vi.mocked(three.BufferGeometry).mock.results[1].value
    expect(replacementGeometry.attributes.luminance.array).toHaveLength(2)
    expect(replacementGeometry.attributes.coherence.array).toHaveLength(2)
    expect(vi.mocked(three.Points)).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial)).toHaveBeenCalledOnce()
    runtime.dispose()
  })

  it('rejects field updates after disposal with a typed lifecycle error', () => {
    const runtime = createRuntime(canvas(), field(), 0.35)
    runtime.dispose()

    expect(() => runtime.setField(field())).toThrowError(NyxError)
    try {
      runtime.setField(field())
    } catch (error) {
      expect(error).toMatchObject({ code: 'DESTROYED', stage: 'rendering' })
    }
    expect(vi.mocked(three.BufferGeometry)).toHaveBeenCalledOnce()
    expect(vi.mocked(three.Float32BufferAttribute)).toHaveBeenCalledTimes(4)
  })

  it('cleans up when initial renderer sizing fails', () => {
    const cause = new Error('resize failed')
    three.failNextResize(cause)

    let thrown: unknown
    try {
      createRuntime(canvas(), field(), 0)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({ code: 'RENDERER_UNAVAILABLE', stage: 'rendering', cause, message: 'Initial renderer resize failed' })
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.WebGLRenderer).mock.results[0].value.dispose).toHaveBeenCalledOnce()
  })

  it('maps renderer construction failures to RENDERER_UNAVAILABLE', () => {
    const cause = new Error('no WebGL')
    vi.mocked(three.WebGLRenderer).mockImplementationOnce(() => {
      throw cause
    })

    let thrown: unknown
    try {
      createRuntime(canvas(), field(), 0)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(NyxError)
    expect(thrown).toMatchObject({ code: 'RENDERER_UNAVAILABLE', stage: 'rendering', cause })
  })

  it('uses Three built-ins and required particle shader behavior', () => {
    expect(vertexShader).not.toMatch(/(?:attribute|in)\s+vec3\s+position\s*;/)
    expect(vertexShader).toMatch(/(?:attribute|in)\s+vec3\s+color\s*;/)
    expect(vertexShader).toMatch(/uniform\s+float\s+depth\s*;/)
    expect(vertexShader).toMatch(/attribute\s+float\s+luminance\s*;/)
    expect(vertexShader).toMatch(/attribute\s+float\s+coherence\s*;/)
    expect(vertexShader).toContain('displacedPosition.z = luminance * depth')
    expect(vertexShader).toContain('gl_PointSize = pointSize')
    expect(vertexShader).toContain('viewPosition = modelViewMatrix * vec4(displacedPosition, 1.0)')
    expect(vertexShader).toContain('gl_Position = projectionMatrix * viewPosition')
    expect(vertexShader).toContain('particleColor = color')
    expect(vertexShader).toContain('varying float particleLuminance')
    expect(vertexShader).toContain('particleLuminance = luminance')
    expect(vertexShader).toContain('varying float particleCoherence')
    expect(vertexShader).toContain('particleCoherence = coherence')
  })

  it('uses ordered smoothstep edges for soft circular alpha', () => {
    expect(fragmentShader).toContain('1.0 - smoothstep(0.35, 0.5, distanceFromCenter)')
    expect(fragmentShader).toContain('varying float particleLuminance')
    expect(fragmentShader).toContain('varying float particleCoherence')
    expect(fragmentShader).toContain('uniform float lumaKeyMode')
    expect(fragmentShader).toContain('uniform float lumaKeyThreshold')
    expect(fragmentShader).toContain('uniform float lumaKeyCoherence')
    expect(fragmentShader).toContain('particleLuminance <= lumaKeyThreshold')
    expect(fragmentShader).toContain('particleLuminance >= 1.0 - lumaKeyThreshold')
    expect(fragmentShader).toContain('if (lumaKeyMode > 0.0 && lumaKeyCoherence > 0.0 && particleCoherence < lumaKeyCoherence) discard')
    expect(fragmentShader.indexOf('particleLuminance <= lumaKeyThreshold')).toBeLessThan(fragmentShader.indexOf('particleCoherence < lumaKeyCoherence'))
    expect(fragmentShader.indexOf('particleCoherence < lumaKeyCoherence')).toBeLessThan(fragmentShader.indexOf('distanceFromCenter'))
  })

  it('does not expose runtime luma-key setters', () => {
    const runtime = createRuntime(canvas(), field(), 0.35, lumaKey())

    expect('setLumaKey' in runtime).toBe(false)
    expect('setLumaKeyThreshold' in runtime).toBe(false)
    runtime.dispose()
  })
})
