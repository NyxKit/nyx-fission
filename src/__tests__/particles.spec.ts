/* global ImageData */

import { describe, expect, it } from 'vitest'

import { NyxError } from '../errors'
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

  it('stores normalized luminance separately and updates the existing buffers', () => {
    const initial = sampledImageData([[255, 255, 255], [0, 0, 0], [0, 255, 0], [0, 0, 255]])
    const field = createParticleField(initial, theme)
    const positions = field.positions
    const xyPositions = Array.from(field.positions).filter((_, index) => index % 3 !== 2)
    const luminance = field.luminance
    const updated = sampledImageData([[0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 0]])

    expect(Array.from(field.luminance)).toEqual([1, 0, 0.7152, 0.0722].map((value) => expect.closeTo(value, 5)))
    updateParticleField(field, updated)

    expect(field.positions).toBe(positions)
    expect(Array.from(field.positions).filter((_, index) => index % 3 !== 2)).toEqual(xyPositions)
    expect(field.luminance).toBe(luminance)
    expect(Array.from(field.positions).filter((_, index) => index % 3 === 2)).toEqual([0, 0, 0, 0])
    expect(Array.from(field.luminance)).toEqual([0, 1, 0.2126, 0.7152].map((value) => expect.closeTo(value, 5)))
    expect(Array.from(field.colors)).toEqual([
      0, 0, 0,
      0, 0, 1,
      0, 0, 0,
      0, 1, 0,
    ])
  })

  it('rejects frame dimensions that no longer match the field', () => {
    const field = createParticleField(imageData(6, 4, new Array(6 * 4 * 4).fill(0)), theme)
    const mismatched = imageData(3, 4, new Array(3 * 4 * 4).fill(0))

    expect(() => updateParticleField(field, mismatched)).toThrowError(NyxError)
    try {
      updateParticleField(field, mismatched)
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_CONFIG', stage: 'sampling' })
    }
  })

  it('rejects frames whose pixel buffer is too short', () => {
    const field = createParticleField(imageData(6, 4, new Array(6 * 4 * 4).fill(0)), theme)

    expect(() => updateParticleField(field, imageData(6, 4, new Array(6 * 4 * 4 - 1).fill(0)))).toThrowError(NyxError)
  })

  it('keeps a private copy of the supplied palette', () => {
    const palette: [number, number, number][] = [[1, 0, 0], [0, 1, 0]]
    const field = createParticleField(imageData(3, 1, [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]), palette)

    palette[0][0] = 0
    palette[0][2] = 1
    palette.push([0, 0, 1])
    updateParticleField(field, imageData(3, 1, [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]))

    expect(Array.from(field.colors)).toEqual([1, 0, 0])
  })

  it('rejects an empty or invalid palette at creation', () => {
    const source = imageData(3, 1, [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255])

    expect(() => createParticleField(source, [])).toThrowError(NyxError)
    expect(() => createParticleField(source, [[1, 0, Number.NaN]])).toThrowError(NyxError)
  })
})
