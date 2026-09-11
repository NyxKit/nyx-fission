/* global HTMLCanvasElement, PointerEvent, MediaQueryList */

import { NyxError } from './errors'
import { NyxErrorStage, NyxInteraction, type InteractionConfig } from './types'

export function resolveInteractionConfig(config: InteractionConfig = {}): Required<InteractionConfig> {
  const invalid = () => new NyxError(
    'Invalid interaction configuration: use a supported type, radius from 1 to 1000 CSS pixels, strength from 0 to 1, and finite nonnegative delay/duration in milliseconds',
    'INVALID_CONFIG', NyxErrorStage.Rendering,
  )
  if (config === null || typeof config !== 'object' || Array.isArray(config)) throw invalid()
  const resolved = {
    type: config.type === undefined ? NyxInteraction.None : config.type,
    radius: config.radius === undefined ? 100 : config.radius,
    strength: config.strength === undefined ? 1 : config.strength,
    delay: config.delay === undefined ? 0 : config.delay,
    duration: config.duration === undefined ? 300 : config.duration,
  }
  if (!Object.values(NyxInteraction).includes(resolved.type) ||
    !Number.isFinite(resolved.radius) || resolved.radius < 1 || resolved.radius > 1000 ||
    !Number.isFinite(resolved.strength) || resolved.strength < 0 || resolved.strength > 1 ||
    !Number.isFinite(resolved.delay) || resolved.delay < 0 ||
    !Number.isFinite(resolved.duration) || resolved.duration < 0 ||
    !Number.isFinite(resolved.delay + resolved.duration)) throw invalid()
  return resolved
}

/** Canvas-local pointer state, using the renderer's clock instead of timers. */
export class InteractionController {
  readonly config: Required<InteractionConfig>
  readonly pointer = new Float32Array(2)
  readonly viewport = new Float32Array([1, 1])
  active = false
  revision = 0
  private canvas: HTMLCanvasElement | undefined
  private motionQuery: MediaQueryList | undefined
  private pointerId: number | undefined
  private clientX = 0
  private clientY = 0
  private inside = false

  constructor(config?: InteractionConfig) {
    this.config = resolveInteractionConfig(config)
  }

  connect(canvas: HTMLCanvasElement): void {
    this.disconnect()
    if (this.config.type === NyxInteraction.None || this.config.strength === 0) return
    this.canvas = canvas
    this.motionQuery = canvas.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')
    for (const name of ['pointerenter', 'pointermove', 'pointerdown'] as const) canvas.addEventListener(name, this.onPointer)
    for (const name of ['pointerleave', 'pointercancel', 'lostpointercapture'] as const) canvas.addEventListener(name, this.onLeave)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.ownerDocument.addEventListener('visibilitychange', this.reset)
    canvas.ownerDocument.defaultView?.addEventListener('blur', this.reset)
    this.motionQuery?.addEventListener('change', this.reset)
  }

  disconnect(): void {
    const canvas = this.canvas
    if (canvas) {
      for (const name of ['pointerenter', 'pointermove', 'pointerdown'] as const) canvas.removeEventListener(name, this.onPointer)
      for (const name of ['pointerleave', 'pointercancel', 'lostpointercapture'] as const) canvas.removeEventListener(name, this.onLeave)
      canvas.removeEventListener('pointerup', this.onPointerUp)
      canvas.ownerDocument.removeEventListener('visibilitychange', this.reset)
      canvas.ownerDocument.defaultView?.removeEventListener('blur', this.reset)
    }
    this.motionQuery?.removeEventListener('change', this.reset)
    this.motionQuery = undefined
    this.canvas = undefined
    this.reset()
  }

  advance(): void {
    const canvas = this.canvas
    if (!canvas || this.motionQuery?.matches || canvas.ownerDocument.hidden) {
      this.reset()
      return
    }
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      this.reset()
      return
    }
    this.viewport[0] = rect.width
    this.viewport[1] = rect.height
    this.pointer[0] = this.clientX - rect.left
    this.pointer[1] = rect.height - (this.clientY - rect.top)
    if (this.inside && (this.pointer[0] < 0 || this.pointer[0] > rect.width || this.pointer[1] < 0 || this.pointer[1] > rect.height)) this.leave()
    this.active = this.inside
  }

  private onPointer = (event: PointerEvent): void => {
    if (event.isPrimary === false || this.motionQuery?.matches ||
      (event.pointerType === 'touch' && event.type !== 'pointerdown' && this.pointerId !== event.pointerId)) return
    if (this.pointerId !== undefined && this.pointerId !== event.pointerId) return
    this.clientX = event.clientX
    this.clientY = event.clientY
    this.pointerId = event.pointerId
    this.inside = true
  }

  private onLeave = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return
    this.leave()
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') this.onLeave(event)
  }

  private leave(): void {
    if (!this.inside) return
    this.inside = false
    this.pointerId = undefined
    this.active = false
  }

  private reset = (): void => {
    this.inside = false
    this.pointerId = undefined
    this.active = false
    this.revision++
  }
}
