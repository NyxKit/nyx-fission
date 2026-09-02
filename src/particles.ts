/* global ImageData */

import type { Color } from './themes'
import { NyxError } from './errors'
import { LumaKeyMode, NyxErrorStage, type ResolvedLumaKeyConfig } from './types'

const SAMPLE_STEP = 3
const DEPTH_UPDATE_THRESHOLD = 0.03

type ParticleFilter = ResolvedLumaKeyConfig

function validateTheme(theme: readonly Color[]): void {
  if (!theme || theme.length === 0 || theme.some((color) => !Array.isArray(color) || color.length !== 3 || color.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 1))) {
    throw new NyxError('Particle theme must contain at least one valid RGB color', 'INVALID_CONFIG', NyxErrorStage.Sampling)
  }
}

function validateImageData(imageData: ImageData, width?: number, height?: number): void {
  if (width !== undefined && (imageData.width !== width || imageData.height !== height)) {
    throw new NyxError('Particle frame dimensions changed; rebuild the particle field', 'INVALID_CONFIG', NyxErrorStage.Sampling)
  }
  if (imageData.width <= 0 || imageData.height <= 0 || imageData.data.length < imageData.width * imageData.height * 4) {
    throw new NyxError('Particle frame does not contain enough pixel data', 'INVALID_CONFIG', NyxErrorStage.Sampling)
  }
}

export class ParticleField {
  readonly positions: Float32Array
  readonly colors: Float32Array
  readonly luminance: Float32Array
  readonly coherence: Float32Array
  private readonly pixelIndices: number[]
  private readonly width: number
  private readonly height: number
  private readonly gridWidth: number
  private readonly gridHeight: number
  private readonly theme: readonly Color[]
  private readonly filter: ParticleFilter

  constructor(imageData: ImageData, theme: readonly Color[], filter: ParticleFilter) {
    validateTheme(theme)
    validateImageData(imageData)
    this.width = imageData.width
    this.height = imageData.height
    this.gridWidth = Math.ceil(this.width / SAMPLE_STEP)
    this.gridHeight = Math.ceil(this.height / SAMPLE_STEP)
    this.theme = theme.map((color) => [color[0], color[1], color[2]])
    this.filter = { ...filter }
    this.pixelIndices = []
    const positions: number[] = []
    for (let y = 0; y < this.height; y += SAMPLE_STEP) {
      for (let x = 0; x < this.width; x += SAMPLE_STEP) {
        this.pixelIndices.push((y * this.width + x) * 4)
        positions.push((x - (this.width - 1) / 2) / this.height, ((this.height - 1) / 2 - y) / this.height, 0)
      }
    }
    this.positions = new Float32Array(positions)
    this.colors = new Float32Array(positions.length)
    this.luminance = new Float32Array(positions.length / 3)
    this.coherence = new Float32Array(this.luminance.length)
    this.updateFrame(imageData, false)
  }

  update(imageData: ImageData): void {
    this.updateFrame(imageData, true)
  }

  private updateFrame(imageData: ImageData, stabilizeDepth: boolean): void {
    validateTheme(this.theme)
    validateImageData(imageData, this.width, this.height)
    this.pixelIndices.forEach((pixelIndex, index) => {
      const red = imageData.data[pixelIndex]
      const green = imageData.data[pixelIndex + 1]
      const blue = imageData.data[pixelIndex + 2]
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
      if (!stabilizeDepth || Math.abs(luminance - this.luminance[index]) >= DEPTH_UPDATE_THRESHOLD) {
        this.luminance[index] = luminance
      }
      const color = this.theme[Math.min(this.theme.length - 1, Math.floor(luminance * this.theme.length))]
      this.colors.set(color, index * 3)
    })

    if (this.filter.mode === LumaKeyMode.None || this.filter.coherence === 0) {
      this.coherence.fill(0)
      return
    }

    this.luminance.forEach((luminance, index) => {
      if (!qualifies(luminance, this.filter)) {
        this.coherence[index] = 0
        return
      }

      const sampleX = index % this.gridWidth
      const sampleY = Math.floor(index / this.gridWidth)
      let availableNeighbors = 0
      let qualifyingNeighbors = 0
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (offsetX === 0 && offsetY === 0) continue
          const neighborX = sampleX + offsetX
          const neighborY = sampleY + offsetY
          if (neighborX < 0 || neighborX >= this.gridWidth || neighborY < 0 || neighborY >= this.gridHeight) continue
          availableNeighbors++
          const neighborIndex = neighborY * this.gridWidth + neighborX
          if (qualifies(this.luminance[neighborIndex], this.filter)) qualifyingNeighbors++
        }
      }
      this.coherence[index] = qualifyingNeighbors / availableNeighbors
    })
  }
}

function qualifies(luminance: number, filter: ParticleFilter): boolean {
  return filter.mode === LumaKeyMode.Dark
    ? luminance > filter.threshold
    : luminance < 1 - filter.threshold
}

const disabledFilter: ParticleFilter = { mode: LumaKeyMode.None, threshold: 0.1, coherence: 0 }

export function createParticleField(imageData: ImageData, theme: readonly Color[], filter: ParticleFilter = disabledFilter): ParticleField {
  return new ParticleField(imageData, theme, filter)
}

export function updateParticleField(field: ParticleField, imageData: ImageData): void {
  field.update(imageData)
}
