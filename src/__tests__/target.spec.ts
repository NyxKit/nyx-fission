/* global Event, MutationObserver, document, setTimeout */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NyxError } from '../errors'
import { resolveCanvas, validateCanvas } from '../target'

describe('canvas target resolution', () => {
  const originalReadyState = document.readyState

  beforeEach(() => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'loading',
    })
  })

  afterEach(() => {
    document.body.replaceChildren()
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: originalReadyState,
    })
  })

  it('validates an explicit canvas', () => {
    const canvas = document.createElement('canvas')

    expect(validateCanvas(canvas)).toBe(canvas)
  })

  it('rejects an explicit non-canvas target', () => {
    expect(() => validateCanvas(document.createElement('div'))).toThrowError(
      expect.objectContaining({ code: 'INVALID_TARGET', stage: 'target' }),
    )
  })

  it('resolves a canvas from a selector', async () => {
    const canvas = document.createElement('canvas')
    canvas.id = 'particles'
    document.body.append(canvas)

    const { promise } = resolveCanvas({ querySelector: '#particles' })

    await expect(promise).resolves.toBe(canvas)
  })

  it('rejects an invalid selector', async () => {
    const { promise } = resolveCanvas({ querySelector: '[' })

    await expect(promise).rejects.toMatchObject({
      code: 'INVALID_TARGET',
      stage: 'target',
    })
  })

  it('rejects when a selector resolves to a non-canvas', async () => {
    const element = document.createElement('div')
    element.id = 'particles'
    document.body.append(element)

    const { promise } = resolveCanvas({ querySelector: '#particles' })

    await expect(promise).rejects.toMatchObject({
      code: 'INVALID_TARGET',
      stage: 'target',
    })
  })

  it('resolves a canvas inserted before DOMContentLoaded', async () => {
    const { promise } = resolveCanvas({ querySelector: '#particles' })
    const canvas = document.createElement('canvas')
    canvas.id = 'particles'
    document.body.append(canvas)
    document.dispatchEvent(new Event('DOMContentLoaded'))
    await expect(promise).resolves.toBe(canvas)
  })

  it('rejects after DOMContentLoaded when no canvas is found', async () => {
    const { promise } = resolveCanvas({ querySelector: '#missing' })
    document.dispatchEvent(new Event('DOMContentLoaded'))

    await expect(promise).rejects.toMatchObject({
      code: 'TARGET_NOT_FOUND',
      stage: 'target',
    })
  })

  it('fails immediately when the document is already ready', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    })

    const { promise } = resolveCanvas({ querySelector: '#missing' })

    await expect(promise).rejects.toMatchObject({
      code: 'TARGET_NOT_FOUND',
      stage: 'target',
    })
  })

  it('cancels observation and prevents later settlement', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')

    try {
      const { promise, cancel } = resolveCanvas({ querySelector: '#particles' })
      cancel()
      document.dispatchEvent(new Event('DOMContentLoaded'))
      const canvas = document.createElement('canvas')
      canvas.id = 'particles'
      document.body.append(canvas)

      expect(disconnect).toHaveBeenCalled()
      expect(await Promise.race([
        promise.then(() => 'settled'),
        new Promise((resolve) => setTimeout(() => resolve('pending'), 0)),
      ])).toBe('pending')
    } finally {
      disconnect.mockRestore()
    }
  })

  it('uses NyxError instances for target failures', async () => {
    const { promise } = resolveCanvas({ querySelector: '#missing' })
    document.dispatchEvent(new Event('DOMContentLoaded'))

    await expect(promise).rejects.toBeInstanceOf(NyxError)
  })
})
