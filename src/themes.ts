/* global document, getComputedStyle, Document */

import type { ThemeName } from './types'

export type Color = readonly [number, number, number]

const grayscale: readonly Color[] = [
  [0, 0, 0],
  [0.25, 0.25, 0.25],
  [0.5, 0.5, 0.5],
  [0.75, 0.75, 0.75],
  [1, 1, 1],
]

const discodip = hexPalette(['#ff006e', '#8338ec', '#3a86ff', '#06d6a0', '#ffbe0b'])
const pastel = hexPalette(['#ea6c92', '#f0a573', '#fff6a3', '#abeda1', '#9eb8ff'])
const nyxFallback = hexPalette(['#9f50f0', '#0f4c75', '#1faa59', '#e58e26', '#d72638', '#3b82f6'])
const semanticNames = ['primary', 'secondary', 'success', 'warning', 'danger', 'info'] as const

function hexPalette(values: readonly string[]): readonly Color[] {
  return values.map((value) => parseColor(value) as Color)
}

function parseColor(value: string): Color | undefined {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map((digit) => digit + digit).join('') : hex[1]
    return [parseInt(digits.slice(0, 2), 16) / 255, parseInt(digits.slice(2, 4), 16) / 255, parseInt(digits.slice(4), 16) / 255]
  }

  const rgb = value.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i)
  if (!rgb) return undefined
  const channels = rgb.slice(1, 4).map(Number)
  return channels.every((channel) => channel >= 0 && channel <= 255)
    ? [channels[0] / 255, channels[1] / 255, channels[2] / 255]
    : undefined
}

export function resolveTheme(name: ThemeName, documentRef: Document = document): readonly Color[] {
  if (name === 'grayscale') return grayscale
  if (name === 'discodip') return discodip
  if (name === 'pastel') return pastel

  const root = documentRef.documentElement
  const computed = documentRef.defaultView?.getComputedStyle(root) ?? getComputedStyle(root)
  return semanticNames.map((semanticName, index) => parseColor(computed.getPropertyValue(`--nyx-c-${semanticName}`)) ?? nyxFallback[index])
}
