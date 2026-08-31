/* global ImageData */

import type { Color } from './themes'
import { NyxError } from './errors'
import { NyxErrorStage } from './types'

const SAMPLE_STEP = 3

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
  private readonly pixelIndices: number[]
  private readonly width: number
  private readonly height: number
  private readonly theme: readonly Color[]

  constructor(imageData: ImageData, theme: readonly Color[]) {
    validateTheme(theme)
    validateImageData(imageData)
    this.width = imageData.width
    this.height = imageData.height
    this.theme = theme.map((color) => [color[0], color[1], color[2]])
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
    updateParticleField(this, imageData)
  }

  update(imageData: ImageData): void {
    validateTheme(this.theme)
    validateImageData(imageData, this.width, this.height)
    this.pixelIndices.forEach((pixelIndex, index) => {
      const red = imageData.data[pixelIndex]
      const green = imageData.data[pixelIndex + 1]
      const blue = imageData.data[pixelIndex + 2]
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
      this.luminance[index] = luminance
      const color = this.theme[Math.min(this.theme.length - 1, Math.floor(luminance * this.theme.length))]
      this.colors.set(color, index * 3)
    })
  }
}

export function createParticleField(imageData: ImageData, theme: readonly Color[]): ParticleField {
  return new ParticleField(imageData, theme)
}

export function updateParticleField(field: ParticleField, imageData: ImageData): void {
  field.update(imageData)
}
