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
    constructor(_array: Float32Array, _itemSize: number) {}
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

  class WebGLRenderer {
    domElement: HTMLCanvasElement
    setSize = vi.fn()
    render = vi.fn()
    dispose = vi.fn()

    constructor(parameters: { canvas: HTMLCanvasElement; alpha: boolean; antialias: boolean }) {
      this.domElement = parameters.canvas
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
  }
})

vi.mock('three', () => three)

function field(): ParticleField {
  return {
    positions: new Float32Array([0, 0, 0]),
    colors: new Float32Array([1, 0, 0]),
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

  beforeEach(() => {
    vi.clearAllMocks()
    requestFrame = vi.fn(() => 42)
    cancelFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)
    observer = { observe: vi.fn(), disconnect: vi.fn() }
    vi.stubGlobal('ResizeObserver', vi.fn((callback: ResizeObserverCallback) => {
      resizeCallback = callback
      return observer
    }))
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
    runtime.start(vi.fn())

    runtime.dispose()
    runtime.dispose()

    expect(cancelFrame).toHaveBeenCalledWith(42)
    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(vi.mocked(three.BufferGeometry).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.ShaderMaterial).mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(three.WebGLRenderer).mock.results[0].value.dispose).toHaveBeenCalledOnce()
  })

  it('maps renderer construction failures to RENDERER_UNAVAILABLE', () => {
    vi.mocked(three.WebGLRenderer).mockImplementationOnce(() => {
      throw new Error('no WebGL')
    })

    expect(() => new ThreeRuntime(canvas(), field())).toThrowError(NyxError)
    try {
      new ThreeRuntime(canvas(), field())
    } catch (error) {
      expect(error).toMatchObject({ code: 'RENDERER_UNAVAILABLE', stage: 'rendering' })
    }
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
