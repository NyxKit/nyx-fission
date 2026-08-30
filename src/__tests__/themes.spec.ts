/* global document */

import { describe, expect, it } from 'vitest'

import { resolveTheme } from '../themes'

describe('resolveTheme', () => {
  it.each(['grayscale', 'discodip', 'pastel', 'nyx'] as const)('resolves %s to normalized RGB triples', (name) => {
    const theme = resolveTheme(name)

    expect(theme.length).toBeGreaterThan(1)
    expect(theme.every((color) => color.length === 3 && color.every((value) => value >= 0 && value <= 1))).toBe(true)
  })

  it('returns a grayscale palette with equal channels', () => {
    expect(resolveTheme('grayscale')).toEqual([
      [0, 0, 0],
      [0.25, 0.25, 0.25],
      [0.5, 0.5, 0.5],
      [0.75, 0.75, 0.75],
      [1, 1, 1],
    ])
  })

  it('reads Nyx semantic colors in documented order', () => {
    const documentRef = document.implementation.createHTMLDocument('theme')
    const values = ['#123456', '#abc', 'rgb(10, 20, 30)', 'rgba(40, 50, 60, .5)', '#fed', '#010203']
    const names = ['primary', 'secondary', 'success', 'warning', 'danger', 'info']

    names.forEach((name, index) => documentRef.documentElement.style.setProperty(`--nyx-c-${name}`, values[index]))

    expect(resolveTheme('nyx', documentRef)).toEqual([
      [18 / 255, 52 / 255, 86 / 255],
      [170 / 255, 187 / 255, 204 / 255],
      [10 / 255, 20 / 255, 30 / 255],
      [40 / 255, 50 / 255, 60 / 255],
      [255 / 255, 238 / 255, 221 / 255],
      [1 / 255, 2 / 255, 3 / 255],
    ])
  })

  it('uses the stable Nyx fallback for empty and invalid CSS values', () => {
    const documentRef = document.implementation.createHTMLDocument('theme')
    documentRef.documentElement.style.setProperty('--nyx-c-primary', '')
    documentRef.documentElement.style.setProperty('--nyx-c-secondary', 'not-a-color')

    expect(resolveTheme('nyx', documentRef).slice(0, 2)).toEqual([
      [159 / 255, 80 / 255, 240 / 255],
      [15 / 255, 76 / 255, 117 / 255],
    ])
  })
})
