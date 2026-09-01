/* global document, getComputedStyle, Document */

import { ThemeName } from './types'

export type Color = readonly [number, number, number]

const grayscale = hexPalette(['#555555'])
const discodip = hexPalette(['#f0932b', '#eb4d4b', '#6ab04c', '#22a6b3', '#be2edd', '#4834d4', '#130f40'])
const pastel = hexPalette(['#A8D8EA', '#A8D8EA', '#A8D8EA', '#AA96DA', '#AA96DA', '#FCBAD3', '#FFFFD2'])
const nyxFallback = hexPalette(['#9f50f0', '#0f4c75', '#3b82f6', '#71657a'])
const semanticNames = ['primary', 'secondary', 'tertiary', 'neutral'] as const

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
  if (name === ThemeName.Grayscale) return grayscale
  if (name === ThemeName.Discodip) return discodip
  if (name === ThemeName.Pastel) return pastel

  const root = documentRef.documentElement
  const computed = documentRef.defaultView?.getComputedStyle(root) ?? getComputedStyle(root)
  return semanticNames.map((semanticName, index) => parseColor(computed.getPropertyValue(`--nyx-c-${semanticName}`)) ?? nyxFallback[index])
}
