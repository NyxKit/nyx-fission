/* global document, window, MouseEvent, Event, MediaQueryList, HTMLCanvasElement, DOMRect */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InteractionController, resolveInteractionConfig } from '../interaction'
import { NyxFission, NyxInteraction, type InteractionConfig } from '../index'

describe('interaction configuration', () => {
  it('defaults to no interaction and copies nested settings', () => {
    expect(resolveInteractionConfig()).toEqual({ type: NyxInteraction.None, radius: 100, strength: 1, delay: 0, duration: 300 })
    const config = { type: NyxInteraction.Attract, radius: 80 }
    const controller = new InteractionController(config)
    config.radius = 900
    expect(controller.config.radius).toBe(80)
  })

  it.each([
    null, [], 'attract', { type: 'unknown' }, { type: null },
    { radius: 0 }, { radius: 1001 }, { radius: NaN }, { radius: Infinity }, { radius: '100' },
    { strength: -0.1 }, { strength: 1.1 }, { strength: NaN }, { strength: Infinity }, { strength: '0.5' }, { strength: null },
    { delay: -1 }, { delay: null }, { delay: Infinity }, { duration: -1 }, { duration: NaN },
    { duration: '300' }, { duration: Number.MAX_VALUE, delay: Number.MAX_VALUE },
  ])('rejects invalid configuration before loading media: %j', (interaction) => {
    expect(() => new NyxFission({ source: 'image.png', interaction: interaction as InteractionConfig })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'rendering' }),
    )
  })

  it.each(Object.values(NyxInteraction))('accepts %s with zero timings and boundary radii', (type) => {
    for (const radius of [1, 1000]) {
      expect(resolveInteractionConfig({ type, radius, delay: 0, duration: 0 })).toEqual({ type, radius, strength: 1, delay: 0, duration: 0 })
    }
  })
})

describe('InteractionController', () => {
  let controller: InteractionController
  let canvas: HTMLCanvasElement
  let motion: MediaQueryList
  let motionChange: () => void
  let rect: { left: number; top: number; width: number; height: number }

  const advance = (_nextTime: number) => { controller.advance() }
  const pointer = (type: string, options: { pointerType?: string; pointerId?: number; isPrimary?: boolean; clientX?: number; clientY?: number } = {}) => {
    const event = new MouseEvent(type, { clientX: options.clientX ?? 150, clientY: options.clientY ?? 100 })
    Object.defineProperties(event, {
      pointerType: { value: options.pointerType ?? 'mouse' },
      pointerId: { value: options.pointerId ?? 1 },
      isPrimary: { value: options.isPrimary ?? true },
    })
    canvas.dispatchEvent(event)
    return event
  }

  beforeEach(() => {
    motion = { matches: false, addEventListener: vi.fn((_name, listener) => { motionChange = listener }), removeEventListener: vi.fn() } as unknown as MediaQueryList
    vi.stubGlobal('matchMedia', vi.fn(() => motion))
    canvas = document.createElement('canvas')
    rect = { left: 50, top: 25, width: 400, height: 200 }
    canvas.getBoundingClientRect = vi.fn(() => ({ ...rect }) as DOMRect)
    controller = new InteractionController({ type: NyxInteraction.Attract, delay: 200, duration: 300 })
    controller.connect(canvas)
  })

  afterEach(() => {
    controller.disconnect()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('maps viewport coordinates to bottom-left CSS pixels and follows layout changes', () => {
    pointer('pointerenter')
    advance(500)
    expect([...controller.pointer]).toEqual([100, 125])
    expect([...controller.viewport]).toEqual([400, 200])
    rect = { left: 100, top: 50, width: 200, height: 100 }
    advance(510)
    expect([...controller.pointer]).toEqual([50, 50])
    expect([...controller.viewport]).toEqual([200, 100])
    rect.left = 200
    advance(520)
    advance(820)
    expect(controller.active).toBe(false)
  })

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('releases touch on %s without preventing native gestures', (eventName) => {
    pointer('pointerenter', { pointerType: 'touch' })
    advance(500)
    expect(controller.active).toBe(false)
    const event = pointer('pointerdown', { pointerType: 'touch' })
    advance(1000)
    expect(controller.active).toBe(true)
    expect(event.defaultPrevented).toBe(false)
    pointer(eventName, { pointerType: 'touch' })
    advance(1300)
    expect(controller.active).toBe(false)
    pointer('pointermove', { pointerType: 'touch' })
    advance(2000)
    expect(controller.active).toBe(false)
  })

  it('ignores secondary pointers and unrelated pointer releases', () => {
    pointer('pointerdown', { isPrimary: false, pointerId: 2 })
    advance(500)
    expect(controller.active).toBe(false)
    pointer('pointerenter')
    advance(1000)
    pointer('pointermove', { pointerId: 2, clientX: 350 })
    pointer('pointerleave', { pointerId: 2 })
    advance(1100)
    expect(controller.active).toBe(true)
    expect(controller.pointer[0]).toBe(100)
  })

  it('disables motion immediately on preference change and requires fresh pointer input', () => {
    pointer('pointerenter')
    advance(500)
    Object.defineProperty(motion, 'matches', { configurable: true, value: true })
    motionChange()
    expect(controller.active).toBe(false)
    pointer('pointermove')
    advance(1000)
    expect(controller.active).toBe(false)
    Object.defineProperty(motion, 'matches', { value: false })
    motionChange()
    advance(1500)
    expect(controller.active).toBe(false)
    pointer('pointermove')
    advance(2000)
    expect(controller.active).toBe(true)
  })

  it.each(['blur', 'visibilitychange'])('clears stale pointers on %s', (name) => {
    pointer('pointerenter')
    advance(500)
    ;(name === 'blur' ? window : document).dispatchEvent(new Event(name))
    advance(10000)
    expect(controller.active).toBe(false)
  })

  it('releases every listener and ignores input after disconnect', () => {
    const removeCanvas = vi.spyOn(canvas, 'removeEventListener')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    pointer('pointerenter')
    advance(500)
    controller.disconnect()
    expect(removeCanvas).toHaveBeenCalledTimes(7)
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(removeWindow).toHaveBeenCalledWith('blur', expect.any(Function))
    expect(motion.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    pointer('pointermove')
    advance(1000)
    expect(controller.active).toBe(false)
  })

  it('attaches no listeners when None is selected', () => {
    controller.disconnect()
    const add = vi.spyOn(canvas, 'addEventListener')
    controller = new InteractionController()
    controller.connect(canvas)
    expect(add).not.toHaveBeenCalled()
    pointer('pointermove')
    advance(1000)
    expect(controller.active).toBe(false)
  })
})
