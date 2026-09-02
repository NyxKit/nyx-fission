/* global ImageData */

import { describe, expect, it } from 'vitest'

import { NyxError } from '../errors'
import { createParticleField, updateParticleField } from '../particles'
import type { Color } from '../themes'
import { LumaKeyMode, type ResolvedLumaKeyConfig } from '../types'

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

function singleParticleImageData(red: number): ImageData {
  const pixels = new Array(48).fill(0)
  pixels[0] = red
  pixels[3] = 255
  return { width: 12, height: 1, data: pixels } as unknown as ImageData
}

function sampledGridImageData(values: number[][]): ImageData {
  const width = 9
  const height = 9
  const pixels = new Uint8ClampedArray(width * height * 4)
  values.forEach((row, sampleY) => row.forEach((red, sampleX) => {
    const offset = (sampleY * 3 * width + sampleX * 3) * 4
    pixels[offset] = red
    pixels[offset + 1] = red
    pixels[offset + 2] = red
    pixels[offset + 3] = 255
  }))
  return imageData(width, height, Array.from(pixels))
}

const darkFilter: ResolvedLumaKeyConfig = { mode: LumaKeyMode.Dark, threshold: 0.5, coherence: 0.5 }

describe('particle fields', () => {
  it('writes low initial luminance during construction', () => {
    const field = createParticleField(sampledImageData([[5, 0, 0]]), theme)

    expect(field.luminance[0]).not.toBe(0)
    expect(field.luminance[0]).toBeCloseTo((0.2126 * 5) / 255, 5)
  })

  it('keeps depth stable for a luminance change below the threshold', () => {
    const field = createParticleField(sampledImageData([[128, 128, 128]]), theme)
    const initialLuminance = field.luminance[0]

    updateParticleField(field, sampledImageData([[125, 125, 125]]))

    expect(field.luminance[0]).toBe(initialLuminance)
  })

  it('accepts a luminance change at the threshold', () => {
    const field = createParticleField(singleParticleImageData(0), theme)
    const thresholdRed = (0.03 * 255) / 0.2126

    updateParticleField(field, singleParticleImageData(thresholdRed))

    expect(field.luminance[0]).not.toBe(0)
    expect(field.luminance[0]).toBeCloseTo(0.03)
  })

  it('updates colors for a sub-threshold luminance change', () => {
    const field = createParticleField(sampledImageData([[128, 128, 128]]), theme)
    const initialLuminance = field.luminance[0]
    const initialColor = Array.from(field.colors)

    updateParticleField(field, sampledImageData([[125, 125, 125]]))

    expect(field.luminance[0]).toBe(initialLuminance)
    expect(Array.from(field.colors)).not.toEqual(initialColor)
    expect(Array.from(field.colors).slice(0, 3)).toEqual([1, 0, 0])
  })

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

  it('gives an isolated qualifying center sample zero support', () => {
    const field = createParticleField(sampledGridImageData([
      [0, 0, 0],
      [0, 255, 0],
      [0, 0, 0],
    ]), theme, darkFilter)

    expect(field.coherence[4]).toBeCloseTo(0)
  })

  it('gives every sample full support in a qualifying 3x3 region', () => {
    const field = createParticleField(sampledGridImageData([
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ]), theme, darkFilter)

    expect(Array.from(field.coherence)).toEqual(new Array(9).fill(1))
  })

  it('uses only available neighbors for a border support denominator', () => {
    const field = createParticleField(sampledGridImageData([
      [255, 255, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]), theme, darkFilter)

    expect(field.coherence[0]).toBeCloseTo(1 / 3)
  })

  it('qualifies dark samples only above the threshold', () => {
    const field = createParticleField(sampledGridImageData([
      [0, 0, 0],
      [0, 128, 255],
      [0, 0, 0],
    ]), theme, darkFilter)

    expect(field.coherence[4]).toBeCloseTo(1 / 8)
  })

  it('qualifies light samples only below one minus the threshold', () => {
    const field = createParticleField(sampledGridImageData([
      [255, 255, 255],
      [255, 127, 0],
      [255, 255, 255],
    ]), theme, { mode: LumaKeyMode.Light, threshold: 0.5, coherence: 0.5 })

    expect(field.coherence[4]).toBeCloseTo(1 / 8)
  })

  it('scores a thin qualifying line from its adjacent line samples', () => {
    const field = createParticleField(sampledGridImageData([
      [0, 0, 0],
      [255, 255, 255],
      [0, 0, 0],
    ]), theme, darkFilter)

    expect(field.coherence[3]).toBeCloseTo(1 / 5)
    expect(field.coherence[4]).toBeCloseTo(1 / 4)
    expect(field.coherence[5]).toBeCloseTo(1 / 5)
  })

  it('updates coherence in place across dynamic frames', () => {
    const field = createParticleField(sampledGridImageData([
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ]), theme, darkFilter)
    const coherence = field.coherence

    updateParticleField(field, sampledGridImageData([
      [0, 0, 0],
      [0, 255, 0],
      [0, 0, 0],
    ]))

    expect(field.coherence).toBe(coherence)
    expect(field.coherence[4]).toBe(0)
  })

  it.each([
    { mode: LumaKeyMode.None, threshold: 0.5, coherence: 1 },
    { mode: LumaKeyMode.Dark, threshold: 0.5, coherence: 0 },
  ])('uses disabled support values for $mode with coherence $coherence', (filter) => {
    const field = createParticleField(sampledGridImageData([
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ]), theme, filter)

    expect(Array.from(field.coherence)).toEqual(new Array(9).fill(0))
  })

  it('rejects an empty or invalid palette at creation', () => {
    const source = imageData(3, 1, [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255])

    expect(() => createParticleField(source, [])).toThrowError(NyxError)
    expect(() => createParticleField(source, [[1, 0, Number.NaN]])).toThrowError(NyxError)
  })
})
