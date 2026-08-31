import { describe, expect, it, vi } from 'vitest'
import { NyxEventEmitter } from '../events'
import { NyxErrorStage, NyxEventName, type NyxEventMap } from '../types'

describe('NyxEventEmitter', () => {
  it('emits payloads and removes listeners', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const listener = vi.fn()

    emitter.on(NyxEventName.Error, listener)
    emitter.emit(NyxEventName.Error, { error: new Error('cors'), stage: NyxErrorStage.Source })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({
      error: expect.any(Error),
      stage: 'source',
    })

    emitter.off(NyxEventName.Error, listener)
    emitter.emit(NyxEventName.Error, { error: new Error('again'), stage: NyxErrorStage.Source })

    expect(listener).toHaveBeenCalledOnce()
  })

  it('delivers one payload to multiple listeners', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const first = vi.fn()
    const second = vi.fn()
    const payload = { error: new Error('failed'), stage: NyxErrorStage.Sampling }

    emitter.on(NyxEventName.Error, first)
    emitter.on(NyxEventName.Error, second)
    emitter.emit(NyxEventName.Error, payload)

    expect(first).toHaveBeenCalledWith(payload)
    expect(second).toHaveBeenCalledWith(payload)
  })

  it('registers duplicate listeners only once', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const listener = vi.fn()

    emitter.on(NyxEventName.Ready, listener)
    emitter.on(NyxEventName.Ready, listener)
    emitter.emit(NyxEventName.Ready, undefined)

    expect(listener).toHaveBeenCalledOnce()
  })

  it('does not invoke a listener removed before its turn', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const removed = vi.fn()
    const removing = vi.fn(() => emitter.off(NyxEventName.Ready, removed))

    emitter.on(NyxEventName.Ready, removing)
    emitter.on(NyxEventName.Ready, removed)
    emitter.emit(NyxEventName.Ready, undefined)

    expect(removing).toHaveBeenCalledOnce()
    expect(removed).not.toHaveBeenCalled()
  })

  it('continues delivery when a listener throws', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const failing = vi.fn(() => {
      throw new Error('listener failed')
    })
    const later = vi.fn()

    emitter.on(NyxEventName.Ready, failing)
    emitter.on(NyxEventName.Ready, later)

    expect(() => emitter.emit(NyxEventName.Ready, undefined)).not.toThrow()
    expect(later).toHaveBeenCalledOnce()
  })

  it('clears listeners for every event', () => {
    const emitter = new NyxEventEmitter<NyxEventMap>()
    const loading = vi.fn()
    const destroying = vi.fn()

    emitter.on(NyxEventName.Loading, loading)
    emitter.on(NyxEventName.Destroy, destroying)
    emitter.clear()
    emitter.emit(NyxEventName.Loading, undefined)
    emitter.emit(NyxEventName.Destroy, undefined)

    expect(loading).not.toHaveBeenCalled()
    expect(destroying).not.toHaveBeenCalled()
  })
})
