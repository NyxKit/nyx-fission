import { NyxInteraction, type InteractionConfig } from './types'
import type { ParticleField } from './particles'

export interface InteractionFrame {
  time: number
  active: boolean
  pointer: Float32Array
  viewport: Float32Array
  cameraZ: number
  aspect: number
  fov: number
  depth: number
}

/** Independent particle transitions. Buffers are allocated only when the grid changes. */
export class InteractionField {
  readonly offsets: Float32Array
  moving = false
  private readonly from: Float32Array
  private readonly target: Float32Array
  private readonly started: Float64Array
  private readonly returning: Uint8Array
  private readonly field: ParticleField
  private readonly config: Required<InteractionConfig>

  constructor(field: ParticleField, config: Required<InteractionConfig>) {
    this.field = field
    this.config = config
    this.offsets = new Float32Array(field.positions.length)
    this.from = new Float32Array(field.positions.length)
    this.target = new Float32Array(field.positions.length)
    this.started = new Float64Array(field.luminance.length)
    this.returning = new Uint8Array(field.luminance.length)
  }

  reset(): void {
    this.offsets.fill(0)
    this.from.fill(0)
    this.target.fill(0)
    this.started.fill(0)
    this.returning.fill(0)
    this.moving = false
  }

  update(frame: InteractionFrame): void {
    const { time, active, pointer, viewport, cameraZ, aspect, fov, depth } = frame
    const { radius, duration, delay, type, strength } = this.config
    const halfHeight = Math.tan(fov * Math.PI / 360)
    const positions = this.field.positions
    const luminance = this.field.luminance
    this.moving = false
    for (let particle = 0, i = 0; particle < luminance.length; particle++, i += 3) {
      // Advance the previous transition before retargeting, preserving continuity.
      const elapsed = time - this.started[particle]
      const progress = elapsed <= 0 ? 0 : duration === 0 ? 1 : Math.min(1, elapsed / duration)
      const eased = 1 - (1 - progress) ** 4
      let x = this.from[i] + (this.target[i] - this.from[i]) * eased
      let y = this.from[i + 1] + (this.target[i + 1] - this.from[i + 1]) * eased
      let z = this.from[i + 2] + (this.target[i + 2] - this.from[i + 2]) * eased
      let tx = 0, ty = 0, tz = 0
      if (active && strength > 0 && type !== NyxInteraction.None) {
        const distance = cameraZ - luminance[particle] * depth
        const unitY = 2 * distance * halfHeight / viewport[1]
        const unitX = 2 * distance * halfHeight * aspect / viewport[0]
        const dx = positions[i] / unitX + viewport[0] / 2 - pointer[0]
        const dy = positions[i + 1] / unitY + viewport[1] / 2 - pointer[1]
        const squaredDistance = dx * dx + dy * dy
        if (squaredDistance < radius * radius) {
          const length = Math.sqrt(squaredDistance)
          const t = length / radius
          const influence = (1 - t * t * (3 - 2 * t)) * strength
          if (type === NyxInteraction.Attract) {
            const attraction = Math.min(1, influence * 1.5)
            tx = -dx * unitX * attraction
            ty = -dy * unitY * attraction
          } else if (type === NyxInteraction.Repel) {
            // Deterministic direction for the particle exactly under the pointer.
            const angle = particle * 2.399963229728653
            tx = (length > 0.00001 ? dx / length : Math.cos(angle)) * unitX * radius * influence * 0.65
            ty = (length > 0.00001 ? dy / length : Math.sin(angle)) * unitY * radius * influence * 0.65
          } else {
            tz = Math.min(radius * unitY * 1.3, distance * 0.7) * influence * (type === NyxInteraction.Push ? -1 : 1)
          }
        }
      }
      tx = Math.fround(tx)
      ty = Math.fround(ty)
      tz = Math.fround(tz)
      if (tx !== this.target[i] || ty !== this.target[i + 1] || tz !== this.target[i + 2]) {
        const returns = tx * tx + ty * ty + tz * tz < x * x + y * y + z * z
        // Continued movement must not postpone an already scheduled return forever.
        const waiting = returns && this.returning[particle] === 1 && time < this.started[particle]
        this.from[i] = x
        this.from[i + 1] = y
        this.from[i + 2] = z
        this.target[i] = tx
        this.target[i + 1] = ty
        this.target[i + 2] = tz
        const continuingReturn = returns && this.returning[particle] === 1 && progress < 1
        if (!waiting) this.started[particle] = time + (returns && !continuingReturn ? delay : 0)
        this.returning[particle] = returns ? 1 : 0
      }
      if (duration === 0 && time >= this.started[particle]) {
        x = tx
        y = ty
        z = tz
      }
      this.offsets[i] = x
      this.offsets[i + 1] = y
      this.offsets[i + 2] = z
      if (x !== 0 || y !== 0 || z !== 0 || tx !== 0 || ty !== 0 || tz !== 0) this.moving = true
    }
  }
}
