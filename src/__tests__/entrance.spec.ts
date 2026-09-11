/* global document, Event, MediaQueryList */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { EntranceController, resolveEntranceConfig } from '../entrance'
import { EntranceAnimationType as Type, type EntranceConfig } from '../index'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function draw(controller: EntranceController, time: number): void {
  controller.afterRender(controller.advance(time))
}

describe('entrance configuration', () => {
  it('defaults to immediate display and nested millisecond timing', () => {
    expect(resolveEntranceConfig()).toEqual({
      type: Type.None,
      autoStart: true,
      duration: 1000,
      delay: 0,
    })
    const config = { type: Type.Gather, duration: 1200 }
    const controller = new EntranceController(config)
    config.duration = 500
    expect(controller.config.duration).toBe(1200)
  })

  it.each([
    null,
    [],
    false,
    { type: 'unknown' },
    { type: null },
    { autoStart: 0 },
    { duration: null },
    { duration: '100' },
    { duration: -1 },
    { duration: NaN },
    { delay: Infinity },
    { delay: -1 },
    { duration: Number.MAX_VALUE, delay: Number.MAX_VALUE },
  ])('rejects malformed configuration %j', (config) => {
    expect(() => resolveEntranceConfig(config as EntranceConfig)).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'rendering' }),
    )
  })
})

describe('entrance lifecycle', () => {
  it.each(Object.values(Type))(
    'keeps manual %s hidden after readiness',
    (type) => {
      const controller = new EntranceController({ type, autoStart: false })
      controller.ready()
      draw(controller, 100000)
      expect(controller.visible).toBe(false)
    },
  )

  it('keeps the default path visible without entrance events', () => {
    const start = vi.fn()
    const end = vi.fn()
    const controller = new EntranceController(undefined, start, end)
    controller.ready()
    draw(controller, 0)
    expect(controller.visible).toBe(true)
    expect(start).not.toHaveBeenCalled()
    expect(end).not.toHaveBeenCalled()
  })

  it('queues pre-ready requests, joins automatic startup, and completes after a successful draw', async () => {
    const start = vi.fn()
    const end = vi.fn()
    const controller = new EntranceController(
      { type: Type.Gather, delay: 200, duration: 1000 },
      start,
      end,
    )
    const completion = controller.play()
    const settled = vi.fn()
    void completion.then(settled)
    controller.ready()
    expect(controller.play()).toBe(completion)
    draw(controller, 50000)
    draw(controller, 50199)
    expect(controller.visible).toBe(false)
    draw(controller, 50200)
    expect(start).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledWith({
      type: Type.Gather,
      animated: true,
    })
    draw(controller, 50700)
    expect(controller.progress).toBe(0.5)
    const token = controller.advance(51200)
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    controller.afterRender(token)
    await completion
    expect(end).toHaveBeenCalledOnce()
    const replay = controller.play()
    expect(replay).not.toBe(completion)
    expect(controller.visible).toBe(false)
    draw(controller, 60000)
    draw(controller, 61200)
    await replay
    expect(end).toHaveBeenCalledTimes(2)
  })

  it('waits for initialization when None is manually called before ready', async () => {
    const controller = new EntranceController()
    const settled = vi.fn()
    const completion = controller.play().then(settled)
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    controller.ready()
    draw(controller, 0)
    await completion
  })

  it.each([Type.None, Type.Fade])(
    'handles an instant %s reveal with ordered events',
    async (type) => {
      const events: string[] = []
      const controller = new EntranceController(
        { type, autoStart: false, duration: 0, delay: 500 },
        (event) => events.push(`start:${event.animated}`),
        () => events.push('complete'),
      )
      controller.ready()
      const completion = controller.play()
      draw(controller, 0)
      if (type !== Type.None) {
        expect(events).toEqual([])
        draw(controller, 500)
      }
      await completion
      expect(events).toEqual(['start:false', 'complete'])
    },
  )

  it('rejects pending and future work on cancellation without completion', async () => {
    const end = vi.fn()
    const controller = new EntranceController(
      { type: Type.Depth },
      undefined,
      end,
    )
    const completion = controller.play()
    draw(controller, 0)
    const failure = new Error('render failed')
    controller.cancel(failure)
    await expect(completion).rejects.toBe(failure)
    await expect(controller.play()).rejects.toBe(failure)
    draw(controller, 1000)
    expect(end).not.toHaveBeenCalled()
  })

  it('allows completion listeners to replay without settling the new run', async () => {
    let replay: Promise<void> | undefined
    const controller = new EntranceController(
      { type: Type.Fade, duration: 0 },
      undefined,
      () => {
        replay = controller.play()
      },
    )
    const first = controller.play()
    draw(controller, 0)
    await first
    expect(controller.visible).toBe(false)
    expect(replay).not.toBe(first)
    controller.cancel(new Error('done'))
    await expect(replay).rejects.toThrow('done')
  })

  it('can be destroyed by a start listener without completing', async () => {
    const end = vi.fn()
    const controller = new EntranceController(
      { type: Type.Fade, duration: 0 },
      () => controller.cancel(new Error('destroy')),
      end,
    )
    const completion = controller.play()
    draw(controller, 0)
    await expect(completion).rejects.toThrow('destroy')
    expect(end).not.toHaveBeenCalled()
  })

  it('pauses the clock in hidden tabs and removes environment listeners', async () => {
    let hidden = false
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    const remove = vi.spyOn(document, 'removeEventListener')
    const controller = new EntranceController({
      type: Type.Fade,
      duration: 1000,
    })
    controller.connect()
    const completion = controller.play()
    draw(controller, 0)
    draw(controller, 300)
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    draw(controller, 3000)
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    draw(controller, 10000)
    expect(controller.progress).toBe(0.3)
    draw(controller, 10700)
    await completion
    controller.disconnect()
    expect(remove).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
  })

  it('respects initial and changing reduced motion without revealing manual media early', async () => {
    let change!: () => void
    const query = {
      matches: true,
      addEventListener: vi.fn((_event, callback) => {
        change = callback
      }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('matchMedia', () => query as unknown as MediaQueryList)
    const start = vi.fn()
    const controller = new EntranceController(
      { type: Type.Depth, autoStart: false, delay: 9000 },
      start,
    )
    controller.connect()
    controller.ready()
    draw(controller, 0)
    expect(controller.visible).toBe(false)
    const first = controller.play()
    draw(controller, 10)
    await first
    expect(start).toHaveBeenCalledWith({ type: Type.Depth, animated: false })
    query.matches = false
    change()
    const replay = controller.play()
    draw(controller, 20)
    expect(controller.visible).toBe(false)
    query.matches = true
    change()
    draw(controller, 30)
    await replay
    controller.disconnect()
    expect(query.removeEventListener).toHaveBeenCalledWith('change', change)
  })
})
