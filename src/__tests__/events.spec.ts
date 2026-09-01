import { describe, expect, it, vi } from 'vitest'
import { NyxEventEmitter } from '../events'
import { NyxErrorStage, NyxEvent, type NyxEventMap } from '../types'

describe('NyxEventEmitter', () => {
  it('emits payloads and removes listeners', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const listener = vi.fn()

    emitter.on(NyxEvent.Error, listener)
    emitter.emit(NyxEvent.Error, { error: new Error('cors'), stage: NyxErrorStage.Source })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({
      error: expect.any(Error),
      stage: 'source',
    })

    emitter.off(NyxEvent.Error, listener)
    emitter.emit(NyxEvent.Error, { error: new Error('again'), stage: NyxErrorStage.Source })

    expect(listener).toHaveBeenCalledOnce()
  })

  it('delivers one payload to multiple listeners', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const first = vi.fn()
    const second = vi.fn()
    const payload = { error: new Error('failed'), stage: NyxErrorStage.Sampling }

    emitter.on(NyxEvent.Error, first)
    emitter.on(NyxEvent.Error, second)
    emitter.emit(NyxEvent.Error, payload)

    expect(first).toHaveBeenCalledWith(payload)
    expect(second).toHaveBeenCalledWith(payload)
  })

  it('registers duplicate listeners only once', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const listener = vi.fn()

    emitter.on(NyxEvent.Ready, listener)
    emitter.on(NyxEvent.Ready, listener)
    emitter.emit(NyxEvent.Ready, undefined)

    expect(listener).toHaveBeenCalledOnce()
  })

  it('does not invoke a listener removed before its turn', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const removed = vi.fn()
    const removing = vi.fn(() => emitter.off(NyxEvent.Ready, removed))

    emitter.on(NyxEvent.Ready, removing)
    emitter.on(NyxEvent.Ready, removed)
    emitter.emit(NyxEvent.Ready, undefined)

    expect(removing).toHaveBeenCalledOnce()
    expect(removed).not.toHaveBeenCalled()
  })

  it('continues delivery when a listener throws', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const failing = vi.fn(() => {
      throw new Error('listener failed')
    })
    const later = vi.fn()

    emitter.on(NyxEvent.Ready, failing)
    emitter.on(NyxEvent.Ready, later)

    expect(() => emitter.emit(NyxEvent.Ready, undefined)).not.toThrow()
    expect(later).toHaveBeenCalledOnce()
  })

  it('clears listeners for every event', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const loading = vi.fn()
    const destroying = vi.fn()

    emitter.on(NyxEvent.Loading, loading)
    emitter.on(NyxEvent.Destroy, destroying)
    emitter.clear()
    emitter.emit(NyxEvent.Loading, undefined)
    emitter.emit(NyxEvent.Destroy, undefined)

    expect(loading).not.toHaveBeenCalled()
    expect(destroying).not.toHaveBeenCalled()
  })
})
