/* global HTMLCanvasElement, ResizeObserver, ResizeObserverCallback, ResizeObserverEntry, FrameRequestCallback, document */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NyxError } from '../errors'
import { ThreeRuntime } from '../runtime'
import type { ParticleField } from '../particles'
import fragmentShader from '../shaders/particles.frag.glsl?raw'
import vertexShader from '../shaders/particles.vert.glsl?raw'

const three = vi.hoisted(() => {
  class Scene {
    add = vi.fn()
    remove = vi.fn()
  }

  class OrthographicCamera {
    left: number
    right: number
    top: number
    bottom: number
    near: number
    far: number
    position = { z: 0 }
    updateProjectionMatrix = vi.fn()

    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number) {
      this.left = left
      this.right = right
      this.top = top
      this.bottom = bottom
      this.near = near
      this.far = far
    }
  }

  class BufferGeometry {
    setAttribute = vi.fn()
    dispose = vi.fn()
  }

  class Float32BufferAttribute {
    array: Float32Array
    needsUpdate = false

    constructor(array: Float32Array, _itemSize: number) {
      this.array = array
    }
  }

  class ShaderMaterial {
    dispose = vi.fn()
    uniforms: Record<string, { value: unknown }>

    constructor(parameters: { uniforms: Record<string, { value: unknown }> }) {
      this.uniforms = parameters.uniforms
    }
  }

  class Points {
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
    OrthographicCamera: vi.fn((...args: unknown[]) => Reflect.construct(OrthographicCamera, args)),
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
  } as ParticleField
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

    const runtime = new ThreeRuntime(target, field())

    expect(three.Scene).toHaveBeenCalledTimes(1)
    expect(three.OrthographicCamera).toHaveBeenCalledWith(-640 / 360 / 2, 640 / 360 / 2, 0.5, -0.5, 0.1, 3)
    const camera = vi.mocked(three.OrthographicCamera).mock.results[0].value
    expect(camera.position.z).toBe(2)
    expect(camera.near).toBeLessThan(camera.position.z - 1)
    expect(camera.far).toBeGreaterThan(camera.position.z)
    expect(three.BufferGeometry).toHaveBeenCalledTimes(1)
    expect(three.Points).toHaveBeenCalledTimes(1)
    expect(three.ShaderMaterial).toHaveBeenCalledTimes(1)
    expect(three.WebGLRenderer).toHaveBeenCalledWith({ canvas: target, alpha: true, antialias: true })
    expect(observer.observe).toHaveBeenCalledWith(target)

    runtime.dispose()
  })

  it('schedules the internal loop and delegates each frame callback', () => {
    const callback = vi.fn()
    const runtime = new ThreeRuntime(canvas(), field())

    runtime.start(callback)

    expect(requestFrame).toHaveBeenCalledOnce()
    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback
    frame(123)

    expect(callback).toHaveBeenCalledWith(123)
    expect(requestFrame).toHaveBeenCalledTimes(2)
    runtime.dispose()
  })

  it('does not start a second loop when a frame callback calls start', () => {
    let runtime: ThreeRuntime
    const callback = vi.fn(() => runtime.start(callback))
    runtime = new ThreeRuntime(canvas(), field())
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
    runtime = new ThreeRuntime(canvas(), field())
    runtime.start(() => runtime.dispose())

    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback
    frame(123)

    expect(renderer.mock.results[0].value.render).not.toHaveBeenCalled()
    expect(requestFrame).toHaveBeenCalledOnce()
  })

  it('stops and disposes the runtime when a frame callback throws', () => {
    const cause = new Error('frame failed')
    const runtime = new ThreeRuntime(canvas(), field())
    runtime.start(() => {
      throw cause
    })

    const frame = requestFrame.mock.calls[0][0] as FrameRequestCallback

    expect(() => frame(123)).toThrow(cause)
    expect(requestFrame).toHaveBeenCalledOnce()
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.WebGLRenderer).mock.results[0].value.dispose).toHaveBeenCalledOnce()
  })

  it('resizes the renderer and camera from the content box', () => {
    const target = canvas()
    const runtime = new ThreeRuntime(target, field())

    resizeCallback([{ contentRect: { width: 800, height: 400 } } as ResizeObserverEntry], observer as unknown as ResizeObserver)

    const camera = vi.mocked(three.OrthographicCamera).mock.results[0].value
    expect(vi.mocked(three.WebGLRenderer).mock.results[0].value.setSize).toHaveBeenLastCalledWith(800, 400, false)
    expect(camera.left).toBe(-1)
    expect(camera.right).toBe(1)
    expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(2)
    runtime.dispose()
  })

  it('disposes all owned resources and the pending frame', () => {
    const runtime = new ThreeRuntime(canvas(), field())
    const scene = vi.mocked(three.Scene).mock.results[0].value
    const points = vi.mocked(three.Points).mock.results[0].value
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
      positionAttribute: undefined,
      colorAttribute: undefined,
      points: undefined,
      geometry: undefined,
    })
  })

  it('ignores queued resize callbacks after disposal', () => {
    const runtime = new ThreeRuntime(canvas(), field())
    const renderer = vi.mocked(three.WebGLRenderer).mock.results[0].value
    const camera = vi.mocked(three.OrthographicCamera).mock.results[0].value

    runtime.dispose()
    resizeCallback([{ contentRect: { width: 800, height: 400 } } as ResizeObserverEntry], observer as unknown as ResizeObserver)

    expect(renderer.setSize).toHaveBeenCalledOnce()
    expect(camera.updateProjectionMatrix).toHaveBeenCalledOnce()
  })

  it('disposes and rethrows a typed error when observed resize fails', () => {
    const cause = new Error('resize failed')
    const runtime = new ThreeRuntime(canvas(), field())
    const renderer = vi.mocked(three.WebGLRenderer).mock.results[0].value
    renderer.setSize.mockImplementationOnce(() => {
      throw cause
    })
    runtime.start(vi.fn())

    let thrown: unknown
    try {
      resizeCallback([{ contentRect: { width: 800, height: 400 } } as ResizeObserverEntry], observer as unknown as ResizeObserver)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({ code: 'RENDERER_UNAVAILABLE', stage: 'rendering', cause, message: 'Renderer resize failed' })
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
      new ThreeRuntime(canvas(), field())
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
      new ThreeRuntime(canvas(), field())
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
    const runtime = new ThreeRuntime(canvas(), field())
    const geometry = vi.mocked(three.BufferGeometry).mock.results[0].value
    const attributes = vi.mocked(three.Float32BufferAttribute).mock.results
    const initialPosition = attributes[0].value
    const initialColor = attributes[1].value
    const nextField = field()
    nextField.positions[0] = 0.5
    nextField.colors[0] = 0.25

    runtime.setField(nextField)

    expect(vi.mocked(three.BufferGeometry)).toHaveBeenCalledOnce()
    expect(geometry.dispose).not.toHaveBeenCalled()
    expect(vi.mocked(three.Float32BufferAttribute)).toHaveBeenCalledTimes(2)
    expect(initialPosition.array[0]).toBe(0.5)
    expect(initialPosition.needsUpdate).toBe(true)
    expect(initialColor.array[0]).toBe(0.25)
    expect(initialColor.needsUpdate).toBe(true)
    runtime.dispose()
  })

  it('replaces and disposes geometry when field sizes change', () => {
    const runtime = new ThreeRuntime(canvas(), field())
    const geometry = vi.mocked(three.BufferGeometry).mock.results[0].value

    runtime.setField(field(2))

    expect(geometry.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.BufferGeometry)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(three.Points)).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial)).toHaveBeenCalledOnce()
    runtime.dispose()
  })

  it('rejects field updates after disposal with a typed lifecycle error', () => {
    const runtime = new ThreeRuntime(canvas(), field())
    runtime.dispose()

    expect(() => runtime.setField(field())).toThrowError(NyxError)
    try {
      runtime.setField(field())
    } catch (error) {
      expect(error).toMatchObject({ code: 'DESTROYED', stage: 'rendering' })
    }
    expect(vi.mocked(three.BufferGeometry)).toHaveBeenCalledOnce()
    expect(vi.mocked(three.Float32BufferAttribute)).toHaveBeenCalledTimes(2)
  })

  it('cleans up when initial renderer sizing fails', () => {
    const cause = new Error('resize failed')
    three.failNextResize(cause)

    let thrown: unknown
    try {
      new ThreeRuntime(canvas(), field())
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
      new ThreeRuntime(canvas(), field())
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(NyxError)
    expect(thrown).toMatchObject({ code: 'RENDERER_UNAVAILABLE', stage: 'rendering', cause })
  })

  it('uses Three built-ins and required particle shader behavior', () => {
    expect(vertexShader).not.toMatch(/(?:attribute|in)\s+vec3\s+position\s*;/)
    expect(vertexShader).toMatch(/(?:attribute|in)\s+vec3\s+color\s*;/)
    expect(vertexShader).toContain('gl_PointSize = pointSize')
    expect(vertexShader).toContain('gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0)')
    expect(vertexShader).toContain('particleColor = color')
  })

  it('uses ordered smoothstep edges for soft circular alpha', () => {
    expect(fragmentShader).toContain('1.0 - smoothstep(0.35, 0.5, distanceFromCenter)')
  })
})
