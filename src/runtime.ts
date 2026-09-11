/* global HTMLCanvasElement, ResizeObserver, requestAnimationFrame, cancelAnimationFrame */

import {
  BufferGeometry,
  Float32BufferAttribute,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'

import fragmentShader from './shaders/particles.frag.glsl?raw'
import vertexShader from './shaders/particles.vert.glsl?raw'
import { validateParticleDepth } from './depth'
import { NyxError } from './errors'
import type { EntranceController } from './entrance'
import { InteractionController } from './interaction'
import { InteractionField } from './interaction-field'
import { EntranceAnimationType, LumaKeyMode, NyxErrorStage, NyxInteraction, type InteractionConfig, type ResolvedLumaKeyConfig } from './types'
import type { ParticleField } from './particles'

const CAMERA_FOV = 50
const CAMERA_GAP = 0.1
const FIELD_HALF_HEIGHT = 0.5
const ENTRANCE_SHADER_TYPES: Record<EntranceAnimationType, number> = {
  [EntranceAnimationType.None]: 0,
  [EntranceAnimationType.Gather]: 1,
  [EntranceAnimationType.Depth]: 2,
  [EntranceAnimationType.Fade]: 3,
  [EntranceAnimationType.Vortex]: 4,
  [EntranceAnimationType.ScanLeftToRight]: 5,
  [EntranceAnimationType.Scatter]: 6,
  [EntranceAnimationType.ScanRightToLeft]: 7,
  [EntranceAnimationType.ScanTopToBottom]: 8,
  [EntranceAnimationType.ScanBottomToTop]: 9,
}

export type FrameCallback = (_time: number, _force?: boolean) => void
type ErrorCallback = (_error: unknown) => void

function canvasSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  return {
    width: canvas.clientWidth || canvas.width || 1,
    height: canvas.clientHeight || canvas.height || 1,
  }
}

function cameraFrame(aspect: number, depth: number): { positionZ: number; near: number; far: number } {
  const absoluteDepth = Math.abs(depth)
  const verticalHalfAngle = (CAMERA_FOV * Math.PI) / 360
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * aspect)
  const verticalFrameDistance = FIELD_HALF_HEIGHT / Math.tan(verticalHalfAngle)
  const horizontalFrameDistance = (aspect / 2) / Math.tan(horizontalHalfAngle)
  const frameDistance = Math.max(verticalFrameDistance, horizontalFrameDistance)
  const positionZ = frameDistance + absoluteDepth + CAMERA_GAP
  return {
    positionZ,
    near: Math.max(0.01, positionZ - absoluteDepth - CAMERA_GAP),
    far: positionZ + absoluteDepth + CAMERA_GAP,
  }
}

export class ThreeRuntime {
  private canvas: HTMLCanvasElement | undefined
  private scene: Scene | undefined
  private camera: PerspectiveCamera | undefined
  private geometry: BufferGeometry | undefined
  private material: ShaderMaterial | undefined
  private points: Points | undefined
  private renderer: WebGLRenderer | undefined
  private observer: ResizeObserver | undefined
  private positionAttribute: Float32BufferAttribute | undefined
  private colorAttribute: Float32BufferAttribute | undefined
  private luminanceAttribute: Float32BufferAttribute | undefined
  private coherenceAttribute: Float32BufferAttribute | undefined
  private frameId: number | undefined
  private running = false
  private disposed = false
  private frameCallback: FrameCallback | undefined
  private readonly errorCallback: ErrorCallback | undefined
  private readonly depth: number
  private readonly lumaKey: LumaKeyMode
  private readonly lumaKeyThreshold: number
  private readonly lumaKeyCoherence: number
  private readonly entrance: EntranceController | undefined
  private readonly interaction: InteractionController
  private interactionField: InteractionField | undefined
  private interactionAttribute: Float32BufferAttribute | undefined
  private interactionRevision = 0
  private fieldRadius = 0.5
  private fieldHalfWidth = 0.5
  private fieldHalfHeight = 0.5
  private fieldPositions: Float32Array | undefined
  private normalCulling = true
  private normalDepthWrite = true
  private wasVisible = true
  private lastEntranceToken: object | undefined

  constructor(canvas: HTMLCanvasElement, initialField: ParticleField, depth: number, lumaKey: ResolvedLumaKeyConfig, errorCallback?: ErrorCallback, entrance?: EntranceController, interaction?: InteractionConfig) {
    validateParticleDepth(depth, NyxErrorStage.Rendering)
    if (!Object.values(LumaKeyMode).includes(lumaKey.mode) || !Number.isFinite(lumaKey.threshold) || lumaKey.threshold < 0 || lumaKey.threshold > 1 || !Number.isFinite(lumaKey.coherence) || lumaKey.coherence < 0 || lumaKey.coherence > 1) {
      throw new NyxError('Invalid luma-key configuration', 'INVALID_CONFIG', NyxErrorStage.Rendering)
    }
    this.errorCallback = errorCallback
    this.interaction = new InteractionController(interaction)
    this.entrance = entrance
    this.depth = depth
    this.lumaKey = lumaKey.mode
    this.lumaKeyThreshold = lumaKey.threshold
    this.lumaKeyCoherence = lumaKey.coherence
    this.canvas = canvas
    const size = canvasSize(canvas)
    this.scene = new Scene()
    const frame = cameraFrame(size.width / size.height, depth)
    this.camera = new PerspectiveCamera(CAMERA_FOV, size.width / size.height, frame.near, frame.far)
    this.camera.position.z = frame.positionZ
    this.updateCameraFraming(size.width / size.height, depth)
    this.geometry = new BufferGeometry()
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      defines: this.interaction.config.type === NyxInteraction.None || this.interaction.config.strength === 0 ? {} : { NYX_INTERACTION: 1 },
      uniforms: {
        pointSize: { value: 3 },
        depth: { value: depth },
        lumaKeyMode: { value: this.lumaKey === LumaKeyMode.None ? 0 : this.lumaKey === LumaKeyMode.Dark ? 1 : 2 },
        lumaKeyThreshold: { value: this.lumaKeyThreshold },
        lumaKeyCoherence: { value: this.lumaKeyCoherence },
        entranceType: { value: 0 },
        entranceProgress: { value: 1 },
        entranceRadius: { value: 1 },
        entranceOriginZ: { value: -1 },
        entranceFieldRadius: { value: 0.5 },
        entranceHalfWidth: { value: 0.5 },
        entranceHalfHeight: { value: 0.5 },
      },
    })
    this.points = new Points(this.geometry, this.material)
    this.normalCulling = this.points.frustumCulled
    this.normalDepthWrite = this.material.depthWrite
    this.wasVisible = entrance?.visible ?? true
    this.points.visible = this.wasVisible
    this.scene.add(this.points)
    this.setField(initialField)

    try {
      this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
    } catch (cause) {
      this.geometry?.dispose()
      this.material?.dispose()
      throw new NyxError('WebGL renderer is unavailable', 'RENDERER_UNAVAILABLE', NyxErrorStage.Rendering, cause)
    }

    let observer: ResizeObserver | undefined
    try {
      this.resize(size.width, size.height)
    } catch (cause) {
      this.geometry?.dispose()
      this.material?.dispose()
      this.renderer?.dispose()
      throw new NyxError('Initial renderer resize failed', 'RENDERER_UNAVAILABLE', NyxErrorStage.Rendering, cause)
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
          const error = new NyxError('Renderer resize failed', 'RENDERER_UNAVAILABLE', NyxErrorStage.Rendering, cause)
          this.dispose()
          this.errorCallback?.(error)
        }
      })
      observer.observe(canvas)
      this.observer = observer
      entrance?.connect(canvas.ownerDocument)
      this.interaction.connect(canvas)
    } catch (cause) {
      observer?.disconnect()
      entrance?.disconnect()
      this.interaction.disconnect()
      this.geometry?.dispose()
      this.material?.dispose()
      this.renderer?.dispose()
      throw new NyxError('Resize observer setup failed', 'RENDERER_UNAVAILABLE', NyxErrorStage.Rendering, cause)
    }
  }

  setField(field: ParticleField): void {
    if (this.disposed) {
      throw new NyxError('Runtime has been disposed', 'DESTROYED', NyxErrorStage.Rendering)
    }
    const geometry = this.geometry
    const points = this.points
    if (!geometry || !points) {
      throw new NyxError('Runtime has been disposed', 'DESTROYED', NyxErrorStage.Rendering)
    }
    // A changed media aspect can produce a new grid with the same particle count.
    if (this.fieldPositions !== field.positions) {
      this.fieldPositions = field.positions
      if (this.interaction.config.type !== NyxInteraction.None && this.interaction.config.strength > 0) {
        this.interactionField = new InteractionField(field, this.interaction.config)
        this.interactionAttribute = new Float32BufferAttribute(this.interactionField.offsets, 3)
        geometry.setAttribute('interactionOffset', this.interactionAttribute)
      }
      this.fieldRadius = 0
      this.fieldHalfWidth = 0
      this.fieldHalfHeight = 0
      for (let i = 0; i < field.positions.length; i += 3) {
        this.fieldRadius = Math.max(this.fieldRadius, Math.hypot(field.positions[i], field.positions[i + 1]))
        this.fieldHalfWidth = Math.max(this.fieldHalfWidth, Math.abs(field.positions[i]))
        this.fieldHalfHeight = Math.max(this.fieldHalfHeight, Math.abs(field.positions[i + 1]))
      }
    }
    if (this.positionAttribute?.array.length === field.positions.length && this.colorAttribute?.array.length === field.colors.length && this.luminanceAttribute?.array.length === field.luminance.length && this.coherenceAttribute?.array.length === field.coherence.length) {
      this.positionAttribute.array.set(field.positions)
      this.positionAttribute.needsUpdate = true
      this.colorAttribute.array.set(field.colors)
      this.colorAttribute.needsUpdate = true
      this.luminanceAttribute.array.set(field.luminance)
      this.luminanceAttribute.needsUpdate = true
      this.coherenceAttribute.array.set(field.coherence)
      this.coherenceAttribute.needsUpdate = true
      return
    }

    const positionAttribute = new Float32BufferAttribute(field.positions, 3)
    const colorAttribute = new Float32BufferAttribute(field.colors, 3)
    const luminanceAttribute = new Float32BufferAttribute(field.luminance, 1)
    const coherenceAttribute = new Float32BufferAttribute(field.coherence, 1)
    let targetGeometry = geometry
    if (this.positionAttribute || this.colorAttribute) {
      geometry.dispose()
      targetGeometry = new BufferGeometry()
      this.geometry = targetGeometry
      points.geometry = targetGeometry
    }
    if (this.interactionAttribute) targetGeometry.setAttribute('interactionOffset', this.interactionAttribute)
    targetGeometry.setAttribute('position', positionAttribute)
    targetGeometry.setAttribute('color', colorAttribute)
    targetGeometry.setAttribute('luminance', luminanceAttribute)
    targetGeometry.setAttribute('coherence', coherenceAttribute)
    this.positionAttribute = positionAttribute
    this.colorAttribute = colorAttribute
    this.luminanceAttribute = luminanceAttribute
    this.coherenceAttribute = coherenceAttribute
  }

  start(frameCallback: FrameCallback): void {
    if (this.disposed || this.running) return
    this.running = true
    this.frameCallback = frameCallback
    const frame = (time: number): void => {
      if (this.disposed) return
      this.frameId = undefined
      try {
        const token = this.entrance?.advance(time)
        if (this.disposed || !this.running) return
        const visible = this.entrance?.visible ?? true
        if (visible && (!this.wasVisible || (token && token !== this.lastEntranceToken))) this.frameCallback?.(time, true)
        else this.frameCallback?.(time)
        this.wasVisible = visible
        this.lastEntranceToken = token
        if (this.disposed || !this.running) return
        const renderer = this.renderer
        const scene = this.scene
        const camera = this.camera
        if (!renderer || !scene || !camera) throw new NyxError('Runtime has been disposed', 'DESTROYED', NyxErrorStage.Rendering)
        this.applyEntrance()
        this.applyInteraction(time)
        renderer.render(scene, camera)
        this.entrance?.afterRender(token)
        if (this.running && !this.disposed) this.frameId = requestAnimationFrame(frame)
      } catch (error) {
        this.dispose()
        this.errorCallback?.(error)
      }
    }
    this.frameId = requestAnimationFrame(frame)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.entrance?.disconnect()
    this.interaction.disconnect()
    this.lastEntranceToken = undefined
    this.fieldPositions = undefined
    this.interactionField = undefined
    this.interactionAttribute = undefined
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
    this.luminanceAttribute = undefined
    this.coherenceAttribute = undefined
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
    this.updateCameraFraming(safeWidth / safeHeight, this.depth)
  }

  private updateCameraFraming(aspect: number, depth: number): void {
    const camera = this.camera
    if (!camera) return
    const frame = cameraFrame(aspect, depth)
    camera.aspect = aspect
    camera.position.z = frame.positionZ
    camera.near = frame.near
    camera.far = frame.far
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }

  private applyEntrance(): void {
    const entrance = this.entrance
    const material = this.material
    const camera = this.camera
    const points = this.points
    if (!entrance || !material || !camera || !points) return
    const active = entrance.visible && entrance.progress < 1
    const type = active ? entrance.config.type : EntranceAnimationType.None
    points.visible = entrance.visible
    points.frustumCulled = active ? false : this.normalCulling
    material.depthWrite = active ? false : this.normalDepthWrite
    material.uniforms.entranceType.value = ENTRANCE_SHADER_TYPES[type]
    material.uniforms.entranceProgress.value = entrance.progress
    material.uniforms.entranceFieldRadius.value = this.fieldRadius
    material.uniforms.entranceHalfWidth.value = this.fieldHalfWidth
    material.uniforms.entranceHalfHeight.value = this.fieldHalfHeight
    const zMin = Math.min(0, this.depth)
    const halfHeight = (camera.position.z - zMin) * Math.tan(CAMERA_FOV * Math.PI / 360)
    material.uniforms.entranceRadius.value = Math.max(this.fieldRadius, Math.hypot(halfHeight, halfHeight * camera.aspect)) * 1.15
    const originZ = zMin - Math.max(4 * this.fieldRadius, camera.position.z)
    material.uniforms.entranceOriginZ.value = originZ
  }

  private applyInteraction(time: number): void {
    const material = this.material
    const camera = this.camera
    const points = this.points
    if (!material || !camera || !points) return
    this.interaction.advance()
    const entering = !!this.entrance && (!this.entrance.visible || this.entrance.progress < 1)
    const field = this.interactionField
    const attribute = this.interactionAttribute
    if (field && attribute) {
      const wasMoving = field.moving
      if (entering || this.interactionRevision !== this.interaction.revision) field.reset()
      this.interactionRevision = this.interaction.revision
      if (!entering && (this.interaction.active || field.moving)) {
        field.update({ time, active: this.interaction.active, pointer: this.interaction.pointer,
          viewport: this.interaction.viewport, cameraZ: camera.position.z, aspect: camera.aspect,
          fov: CAMERA_FOV, depth: this.depth })
      }
      if (wasMoving || field.moving) {
        attribute.array.set(field.offsets)
        attribute.needsUpdate = true
      }
    }
    const interacting = field?.moving ?? false
    points.frustumCulled = entering || interacting ? false : this.normalCulling
    const frame = cameraFrame(camera.aspect, this.depth)
    const type = this.entrance?.config.type
    const travelsInDepth = entering && (type === EntranceAnimationType.Depth || type === EntranceAnimationType.Scatter)
    let far = travelsInDepth ? Math.max(frame.far, camera.position.z - Number(material.uniforms.entranceOriginZ.value) + CAMERA_GAP) : frame.far
    let near = frame.near
    if (interacting) {
      // Push/Pull cap depth displacement at 70% of each particle's camera distance.
      near = Math.max(0.01, frame.near * 0.3)
      far *= 1.7
    }
    if (camera.far !== far || camera.near !== near) {
      camera.far = far
      camera.near = near
      camera.updateProjectionMatrix()
    }
  }
}
