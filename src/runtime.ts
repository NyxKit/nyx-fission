/* global HTMLCanvasElement, ResizeObserver, requestAnimationFrame, cancelAnimationFrame */

import {
  BufferGeometry,
  Float32BufferAttribute,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'

import fragmentShader from './shaders/particles.frag.glsl?raw'
import vertexShader from './shaders/particles.vert.glsl?raw'
import { NyxError } from './errors'
import type { ParticleField } from './particles'

const CAMERA_Z = 2
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 3

export type FrameCallback = (_time: number) => void

function canvasSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  return {
    width: canvas.clientWidth || canvas.width || 1,
    height: canvas.clientHeight || canvas.height || 1,
  }
}

export class ThreeRuntime {
  private readonly scene: Scene
  private readonly camera: OrthographicCamera
  private geometry: BufferGeometry
  private readonly material: ShaderMaterial
  private readonly points: Points
  private readonly renderer: WebGLRenderer
  private readonly observer: ResizeObserver
  private positionAttribute: Float32BufferAttribute | undefined
  private colorAttribute: Float32BufferAttribute | undefined
  private frameId: number | undefined
  private running = false
  private disposed = false
  private frameCallback: FrameCallback | undefined

  constructor(private readonly canvas: HTMLCanvasElement, initialField: ParticleField) {
    const size = canvasSize(canvas)
    this.scene = new Scene()
    this.camera = new OrthographicCamera(-size.width / size.height / 2, size.width / size.height / 2, 0.5, -0.5, CAMERA_NEAR, CAMERA_FAR)
    this.camera.position.z = CAMERA_Z
    this.geometry = new BufferGeometry()
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: { pointSize: { value: 3 } },
    })
    this.points = new Points(this.geometry, this.material)
    this.scene.add(this.points)
    this.setField(initialField)

    try {
      this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
    } catch (cause) {
      this.geometry.dispose()
      this.material.dispose()
      throw new NyxError('WebGL renderer is unavailable', 'RENDERER_UNAVAILABLE', 'rendering', cause)
    }

    let observer: ResizeObserver | undefined
    try {
      this.resize(size.width, size.height)
      observer = new ResizeObserver((entries) => {
        if (this.disposed) return
        const entry = entries[0]
        const width = entry?.contentRect.width ?? canvasSize(this.canvas).width
        const height = entry?.contentRect.height ?? canvasSize(this.canvas).height
        try {
          this.resize(width, height)
        } catch (cause) {
          const error = new NyxError('Renderer resize failed', 'RENDERER_UNAVAILABLE', 'rendering', cause)
          this.dispose()
          throw error
        }
      })
      observer.observe(canvas)
      this.observer = observer
    } catch (cause) {
      observer?.disconnect()
      this.geometry.dispose()
      this.material.dispose()
      this.renderer.dispose()
      throw new NyxError('Resize observer is unavailable', 'RENDERER_UNAVAILABLE', 'rendering', cause)
    }
  }

  setField(field: ParticleField): void {
    if (this.disposed) {
      throw new NyxError('Runtime has been disposed', 'DESTROYED', 'rendering')
    }
    if (this.positionAttribute?.array.length === field.positions.length && this.colorAttribute?.array.length === field.colors.length) {
      this.positionAttribute.array.set(field.positions)
      this.positionAttribute.needsUpdate = true
      this.colorAttribute.array.set(field.colors)
      this.colorAttribute.needsUpdate = true
      return
    }

    const positionAttribute = new Float32BufferAttribute(field.positions, 3)
    const colorAttribute = new Float32BufferAttribute(field.colors, 3)
    if (this.positionAttribute || this.colorAttribute) {
      this.geometry.dispose()
      this.geometry = new BufferGeometry()
      this.points.geometry = this.geometry
    }
    this.geometry.setAttribute('position', positionAttribute)
    this.geometry.setAttribute('color', colorAttribute)
    this.positionAttribute = positionAttribute
    this.colorAttribute = colorAttribute
  }

  start(frameCallback: FrameCallback): void {
    if (this.disposed || this.running) return
    this.running = true
    this.frameCallback = frameCallback
    const frame = (time: number): void => {
      if (this.disposed) return
      this.frameId = undefined
      try {
        this.frameCallback?.(time)
        if (this.disposed || !this.running) return
        this.renderer.render(this.scene, this.camera)
        if (this.running && !this.disposed) this.frameId = requestAnimationFrame(frame)
      } catch (error) {
        this.dispose()
        throw error
      }
    }
    this.frameId = requestAnimationFrame(frame)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.running = false
    this.frameCallback = undefined
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId)
    this.frameId = undefined
    this.observer.disconnect()
    this.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }

  private resize(width: number, height: number): void {
    if (this.disposed) return
    const safeWidth = Math.max(1, width)
    const safeHeight = Math.max(1, height)
    this.renderer.setSize(safeWidth, safeHeight, false)
    this.camera.left = -safeWidth / safeHeight / 2
    this.camera.right = safeWidth / safeHeight / 2
    this.camera.updateProjectionMatrix()
  }
}
