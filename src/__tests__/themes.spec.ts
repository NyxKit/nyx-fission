/* global document */

import { describe, expect, it } from 'vitest'

import { resolveTheme } from '../themes'
import { ThemeName } from '../types'

describe('resolveTheme', () => {
  it.each(Object.values(ThemeName))('resolves %s to normalized RGB triples', (name) => {
    const theme = resolveTheme(name)

    expect(theme.length).toBeGreaterThan(0)
    expect(theme.every((color) => color.length === 3 && color.every((value) => value >= 0 && value <= 1))).toBe(true)
  })

  it('returns the exact grayscale palette', () => {
    expect(resolveTheme(ThemeName.Grayscale)).toEqual([[85 / 255, 85 / 255, 85 / 255]])
  })

  it('returns the exact discodip palette', () => {
    expect(resolveTheme(ThemeName.Discodip)).toEqual([
      [240 / 255, 147 / 255, 43 / 255],
      [235 / 255, 77 / 255, 75 / 255],
      [106 / 255, 176 / 255, 76 / 255],
      [34 / 255, 166 / 255, 179 / 255],
      [190 / 255, 46 / 255, 221 / 255],
      [72 / 255, 52 / 255, 212 / 255],
      [19 / 255, 15 / 255, 64 / 255],
    ])
  })

  it('returns the exact pastel palette, including repeated colors', () => {
    expect(resolveTheme(ThemeName.Pastel)).toEqual([
      [168 / 255, 216 / 255, 234 / 255],
      [168 / 255, 216 / 255, 234 / 255],
      [168 / 255, 216 / 255, 234 / 255],
      [170 / 255, 150 / 255, 218 / 255],
      [170 / 255, 150 / 255, 218 / 255],
      [252 / 255, 186 / 255, 211 / 255],
      [255 / 255, 255 / 255, 210 / 255],
    ])
  })

  it('resolves exactly four Nyx particle colors in documented order', () => {
    const documentRef = document.implementation.createHTMLDocument('theme')
    const values = ['#123456', '#abc', 'rgb(10, 20, 30)', 'rgba(40, 50, 60, .5)']
    const names = ['primary', 'secondary', 'tertiary', 'neutral']

    names.forEach((name, index) => documentRef.documentElement.style.setProperty(`--nyx-c-${name}`, values[index]))

    expect(resolveTheme(ThemeName.Nyx, documentRef)).toEqual([
      [18 / 255, 52 / 255, 86 / 255],
      [170 / 255, 187 / 255, 204 / 255],
      [10 / 255, 20 / 255, 30 / 255],
      [40 / 255, 50 / 255, 60 / 255],
    ])
  })

  it('uses stable Nyx fallbacks for missing and invalid CSS values', () => {
    const documentRef = document.implementation.createHTMLDocument('theme')
    documentRef.documentElement.style.setProperty('--nyx-c-primary', '#123456')
    documentRef.documentElement.style.setProperty('--nyx-c-secondary', '#abc')
    documentRef.documentElement.style.setProperty('--nyx-c-neutral', 'not-a-color')

    expect(resolveTheme(ThemeName.Nyx, documentRef)).toEqual([
      [18 / 255, 52 / 255, 86 / 255],
      [170 / 255, 187 / 255, 204 / 255],
      [31 / 255, 170 / 255, 89 / 255],
      [229 / 255, 142 / 255, 38 / 255],
    ])
  })

  it('excludes NyxKit status colors from the particle palette', () => {
    const documentRef = document.implementation.createHTMLDocument('theme')
    const particleColors = {
      primary: '#123456',
      secondary: '#abc',
      tertiary: 'rgb(10, 20, 30)',
      neutral: 'rgba(40, 50, 60, .5)',
    }
    const statusColors = {
      success: '#d72638',
      warning: '#e58e26',
      danger: '#d72638',
      info: '#3b82f6',
    }

    Object.entries(particleColors).forEach(([name, value]) => {
      documentRef.documentElement.style.setProperty(`--nyx-c-${name}`, value)
    })
    Object.entries(statusColors).forEach(([name, value]) => {
      documentRef.documentElement.style.setProperty(`--nyx-c-${name}`, value)
    })

    expect(resolveTheme(ThemeName.Nyx, documentRef)).toEqual([
      [18 / 255, 52 / 255, 86 / 255],
      [170 / 255, 187 / 255, 204 / 255],
      [10 / 255, 20 / 255, 30 / 255],
      [40 / 255, 50 / 255, 60 / 255],
    ])
  })
})
