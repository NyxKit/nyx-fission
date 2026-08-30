/* global ImageData */

import { describe, expect, it } from 'vitest'

import { createParticleField, updateParticleField } from '../particles'
import type { Color } from '../themes'

const theme: readonly Color[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

function imageData(width: number, height: number, pixels: number[]): ImageData {
  return { width, height, data: new Uint8ClampedArray(pixels) } as ImageData
}

function sampledImageData(colors: number[][]): ImageData {
  const pixels = new Array(12).fill(undefined).flatMap((_, index) => [...(colors[index / 3] ?? [0, 0, 0]), 255])
  return imageData(12, 1, pixels)
}

describe('particle fields', () => {
  it('creates one centered, aspect-preserving point per three-pixel sample', () => {
    const source = imageData(6, 4, new Array(6 * 4 * 4).fill(0).map((_, index) => index % 4 === 3 ? 255 : index / 4))
    const field = createParticleField(source, theme)

    expect(field.positions.length / 3).toBe(4)
    expect(Array.from(field.positions).filter((_, index) => index % 3 !== 2)).toEqual([
      -0.625, 0.375,
      0.125, 0.375,
      -0.625, -0.375,
      0.125, -0.375,
    ])
    expect(field.colors.length).toBe(field.positions.length)
  })

  it('derives Z and palette colors from luminance and updates the existing buffers', () => {
    const initial = sampledImageData([[255, 255, 255], [0, 0, 0], [0, 255, 0], [0, 0, 255]])
    const field = createParticleField(initial, theme)
    const positions = field.positions
    const updated = sampledImageData([[0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 0]])

    updateParticleField(field, updated)

    expect(field.positions).toBe(positions)
    expect(field.positions[2]).toBeCloseTo(0)
    expect(field.positions[5]).toBeCloseTo(1)
    expect(field.positions[8]).toBeCloseTo(0.2126)
    expect(field.positions[11]).toBeCloseTo(0.7152)
    expect(Array.from(field.colors)).toEqual([
      0, 0, 0,
      0, 0, 1,
      0, 0, 0,
      0, 1, 0,
    ])
  })
})
