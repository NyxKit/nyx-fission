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
  private canvas: HTMLCanvasElement | undefined
  private scene: Scene | undefined
  private camera: OrthographicCamera | undefined
  private geometry: BufferGeometry | undefined
  private material: ShaderMaterial | undefined
  private points: Points | undefined
  private renderer: WebGLRenderer | undefined
  private observer: ResizeObserver | undefined
  private positionAttribute: Float32BufferAttribute | undefined
  private colorAttribute: Float32BufferAttribute | undefined
  private frameId: number | undefined
  private running = false
  private disposed = false
  private frameCallback: FrameCallback | undefined

  constructor(canvas: HTMLCanvasElement, initialField: ParticleField) {
    this.canvas = canvas
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
      this.geometry?.dispose()
      this.material?.dispose()
      throw new NyxError('WebGL renderer is unavailable', 'RENDERER_UNAVAILABLE', 'rendering', cause)
    }

    let observer: ResizeObserver | undefined
    try {
      this.resize(size.width, size.height)
    } catch (cause) {
      this.geometry?.dispose()
      this.material?.dispose()
      this.renderer?.dispose()
      throw new NyxError('Initial renderer resize failed', 'RENDERER_UNAVAILABLE', 'rendering', cause)
    }
    try {
      observer = new ResizeObserver((entries) => {
        if (this.disposed) return
        const entry = entries[0]
        const currentCanvas = this.canvas
        const width = entry?.contentRect.width ?? (currentCanvas ? canvasSize(currentCanvas).width : 1)
        const height = entry?.contentRect.height ?? (currentCanvas ? canvasSize(currentCanvas).height : 1)
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
      this.geometry?.dispose()
      this.material?.dispose()
      this.renderer?.dispose()
      throw new NyxError('Resize observer setup failed', 'RENDERER_UNAVAILABLE', 'rendering', cause)
    }
  }

  setField(field: ParticleField): void {
    if (this.disposed) {
      throw new NyxError('Runtime has been disposed', 'DESTROYED', 'rendering')
    }
    const geometry = this.geometry
    const points = this.points
    if (!geometry || !points) {
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
    let targetGeometry = geometry
    if (this.positionAttribute || this.colorAttribute) {
      geometry.dispose()
      targetGeometry = new BufferGeometry()
      this.geometry = targetGeometry
      points.geometry = targetGeometry
    }
    targetGeometry.setAttribute('position', positionAttribute)
    targetGeometry.setAttribute('color', colorAttribute)
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
        const renderer = this.renderer
        const scene = this.scene
        const camera = this.camera
        if (!renderer || !scene || !camera) throw new NyxError('Runtime has been disposed', 'DESTROYED', 'rendering')
        renderer.render(scene, camera)
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
    const canvas = this.canvas
    const scene = this.scene
    const camera = this.camera
    const geometry = this.geometry
    const material = this.material
    const points = this.points
    const renderer = this.renderer
    const observer = this.observer
    const frameId = this.frameId
    if (frameId !== undefined) cancelAnimationFrame(frameId)
    this.frameId = undefined
    observer?.disconnect()
    if (scene && points) scene.remove(points)
    geometry?.dispose()
    material?.dispose()
    renderer?.dispose()
    void canvas
    void camera
    this.positionAttribute = undefined
    this.colorAttribute = undefined
    this.points = undefined
    this.geometry = undefined
    this.canvas = undefined
    this.scene = undefined
    this.camera = undefined
    this.material = undefined
    this.renderer = undefined
    this.observer = undefined
  }

  private resize(width: number, height: number): void {
    if (this.disposed) return
    const safeWidth = Math.max(1, width)
    const safeHeight = Math.max(1, height)
    const renderer = this.renderer
    const camera = this.camera
    if (!renderer || !camera) return
    renderer.setSize(safeWidth, safeHeight, false)
    camera.left = -safeWidth / safeHeight / 2
    camera.right = safeWidth / safeHeight / 2
    camera.updateProjectionMatrix()
  }
}
