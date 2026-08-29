import { describe, expect, it, vi } from 'vitest'
import { NyxEventEmitter } from '../events'
import type { NyxEventMap } from '../types'

describe('NyxEventEmitter', () => {
  it('emits payloads and removes listeners', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const listener = vi.fn()

    emitter.on('error', listener)
    emitter.emit('error', { error: new Error('cors'), stage: 'source' })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({
      error: expect.any(Error),
      stage: 'source',
    })

    emitter.off('error', listener)
    emitter.emit('error', { error: new Error('again'), stage: 'source' })

    expect(listener).toHaveBeenCalledOnce()
  })

  it('delivers one payload to multiple listeners', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const first = vi.fn()
    const second = vi.fn()
    const payload = { error: new Error('failed'), stage: 'sampling' as const }

    emitter.on('error', first)
    emitter.on('error', second)
    emitter.emit('error', payload)

    expect(first).toHaveBeenCalledWith(payload)
    expect(second).toHaveBeenCalledWith(payload)
  })

  it('continues delivery when a listener throws', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const failing = vi.fn(() => {
      throw new Error('listener failed')
    })
    const later = vi.fn()

    emitter.on('ready', failing)
    emitter.on('ready', later)

    expect(() => emitter.emit('ready', undefined)).not.toThrow()
    expect(later).toHaveBeenCalledOnce()
  })

  it('clears listeners for every event', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const loading = vi.fn()
    const destroying = vi.fn()

    emitter.on('loading', loading)
    emitter.on('destroy', destroying)
    emitter.clear()
    emitter.emit('loading', undefined)
    emitter.emit('destroy', undefined)

    expect(loading).not.toHaveBeenCalled()
    expect(destroying).not.toHaveBeenCalled()
  })
})
