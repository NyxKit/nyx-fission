/* global document, window */

import { describe, expect, it, vi } from 'vitest'
import { createHeroPreviewLifecycle, type HeroPreviewInstance } from './hero-lifecycle'

const target = document.createElement('canvas')

function createInstance(ready: Promise<unknown> = Promise.resolve()): HeroPreviewInstance {
  return {
    ready,
    mount: vi.fn(),
    destroy: vi.fn(),
  }
}

describe('hero particle preview lifecycle', () => {
  it('mounts an independent hero instance', () => {
    const instance = createInstance()
    const create = vi.fn(() => instance)
    const lifecycle = createHeroPreviewLifecycle({ target, create, prefersReducedMotion: () => false })

    lifecycle.mount()

    expect(create).toHaveBeenCalledOnce()
    expect(instance.mount).toHaveBeenCalledWith(target)
    expect(lifecycle.instance).toBe(instance)
  })

  it('destroys and clears the hero instance when ready rejects', async () => {
    const ready = Promise.reject(new Error('fixture failed'))
    const instance = createInstance(ready)
    const onInstanceChange = vi.fn()
    const lifecycle = createHeroPreviewLifecycle({
      target,
      create: () => instance,
      prefersReducedMotion: () => false,
      onInstanceChange,
    })

    lifecycle.mount()
    await ready.catch(() => undefined)
    await Promise.resolve()

    expect(instance.destroy).toHaveBeenCalledOnce()
    expect(lifecycle.instance).toBeNull()
    expect(onInstanceChange).toHaveBeenLastCalledWith(null)
  })

  it('disposes the mounted hero instance on teardown', () => {
    const instance = createInstance()
    const lifecycle = createHeroPreviewLifecycle({ target, create: () => instance, prefersReducedMotion: () => false })

    lifecycle.mount()
    lifecycle.dispose()
    lifecycle.dispose()

    expect(instance.destroy).toHaveBeenCalledOnce()
    expect(lifecycle.instance).toBeNull()
  })

  it('does not initialize the decorative preview for reduced-motion users', () => {
    const create = vi.fn(() => createInstance())
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    })

    const lifecycle = createHeroPreviewLifecycle({ target, create })

    lifecycle.mount()

    expect(create).not.toHaveBeenCalled()
    expect(lifecycle.instance).toBeNull()
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')

    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
  })
})
