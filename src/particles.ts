/* global ImageData */

import type { Color } from './themes'

const SAMPLE_STEP = 3

export class ParticleField {
  readonly positions: Float32Array
  readonly colors: Float32Array
  private readonly pixelIndices: number[]
  private readonly width: number
  private readonly height: number
  private readonly theme: readonly Color[]

  constructor(imageData: ImageData, theme: readonly Color[]) {
    this.width = imageData.width
    this.height = imageData.height
    this.theme = theme
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
    updateParticleField(this, imageData)
  }

  update(imageData: ImageData): void {
    this.pixelIndices.forEach((pixelIndex, index) => {
      const sourceIndex = Math.min(pixelIndex, imageData.data.length - 4)
      const red = imageData.data[sourceIndex]
      const green = imageData.data[sourceIndex + 1]
      const blue = imageData.data[sourceIndex + 2]
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
      this.positions[index * 3 + 2] = luminance
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
