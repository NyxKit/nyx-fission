/* global document, Event, HTMLInputElement, HTMLSelectElement, HTMLDivElement, URL */

import { createApp, nextTick, type App as VueApp } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LumaKeyMode,
  MediaType,
  NyxEvent,
  ThemeName,
  type NyxFissionConfig,
} from '../src/types'
import App from './App.vue'

interface MockInstance {
  config: NyxFissionConfig
  mount: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  markReady: () => void
  emit: (_event: NyxEvent, _payload?: unknown) => void
}

const mocks = vi.hoisted(() => ({ instances: [] as MockInstance[] }))

vi.mock('../src/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/index')>()
  return {
    ...actual,
    NyxFission: class {
      readonly ready: Promise<void>
      readonly mount = vi.fn()
      readonly destroy = vi.fn(() => this.emit(actual.NyxEvent.Destroy))
      private resolveReady!: () => void
      private listeners = new Map<string, (_payload: unknown) => void>()

      readonly config: NyxFissionConfig

      constructor(config: NyxFissionConfig) {
        this.config = config
        this.ready = new Promise((resolve) => {
          this.resolveReady = resolve
        })
        mocks.instances.push(this)
      }

      on(event: string, listener: (_payload: unknown) => void) {
        this.listeners.set(event, listener)
      }

      emit(event: string, payload?: unknown) {
        this.listeners.get(event)?.(payload)
      }

      markReady() {
        this.resolveReady()
        this.emit(actual.NyxEvent.Ready)
      }
    },
  }
})

// Keep the app's bindings and events real while replacing the UI kit's rendering.
vi.mock('nyx-kit/components', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NyxButton: defineComponent({
      setup:
        (_props, { slots }) =>
        () =>
          h('button', slots.default?.()),
    }),
    NyxInput: defineComponent({
      props: ['modelValue', 'size'],
      emits: ['update:modelValue'],
      setup:
        (props, { emit }) =>
        () =>
          h('input', {
            value: props.modelValue,
            onInput: (event: Event) =>
              emit(
                'update:modelValue',
                (event.target as HTMLInputElement).value,
              ),
          }),
    }),
    NyxSelect: defineComponent({
      props: ['modelValue', 'options', 'size'],
      emits: ['update:modelValue'],
      setup:
        (props, { emit }) =>
        () =>
          h(
            'select',
            {
              value: props.modelValue,
              onChange: (event: Event) =>
                emit(
                  'update:modelValue',
                  (event.target as HTMLSelectElement).value,
                ),
            },
            props.options.map((option: { value: string; label: string }) =>
              h('option', { value: option.value }, option.label),
            ),
          ),
    }),
  }
})

let app: VueApp
let host: HTMLDivElement

async function mountDemo(reducedMotion = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reducedMotion })),
  )
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(App)
  app.mount(host)
  await nextTick()
  await nextTick()
}

function instanceFor(canvasId: string): MockInstance {
  const instance = [...mocks.instances]
    .reverse()
    .find((candidate) =>
      candidate.mount.mock.calls.some(([canvas]) => canvas.id === canvasId),
    )
  if (!instance) throw new Error(`No instance mounted on #${canvasId}`)
  return instance
}

async function clickButton(label: string) {
  const button = [...host.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  )
  if (!button) throw new Error(`Missing button: ${label}`)
  button.click()
  await nextTick()
  await nextTick()
}

async function changeInput(id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

beforeEach(() => {
  mocks.instances.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('isSecureContext', true)
})

afterEach(() => {
  app?.unmount()
  host?.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('demo application', () => {
  it('mounts independent hero and playground instances without requesting a webcam', async () => {
    await mountDemo()
    expect(mocks.instances).toHaveLength(2)
    expect(instanceFor('hero-canvas').config).toMatchObject({
      type: MediaType.Video,
      source: new URL('./fixtures/hero.mp4', document.baseURI).href,
      depth: 1,
      lumaKey: { mode: LumaKeyMode.Dark, threshold: 0.2, coherence: 0.3 },
    })
    expect(instanceFor('particles-canvas').config).toMatchObject({
      type: MediaType.Image,
      source: new URL('./fixtures/nyx-orbit.svg', document.baseURI).href,
      theme: ThemeName.Nyx,
      depth: 0.35,
      lumaKey: { mode: LumaKeyMode.None, threshold: 0.1, coherence: 0 },
    })
    expect(host.querySelector('video')).toBeNull()
  })

  it('skips the decorative hero when reduced motion is requested', async () => {
    await mountDemo(true)
    expect(mocks.instances).toHaveLength(1)
    expect(instanceFor('particles-canvas')).toBeDefined()
  })

  it('renders labeled depth and luma controls inside the appearance fieldset', async () => {
    await mountDemo()
    const group = host.querySelector('#depth-control')?.closest('fieldset')
    expect(group?.querySelector('legend')?.textContent).toBe('Appearance')
    for (const id of [
      'depth-control',
      'luma-key-mode',
      'luma-key-threshold',
      'luma-key-coherence',
    ]) {
      expect(group?.querySelector(`#${id}`)).not.toBeNull()
      expect(
        group?.querySelector(`label[for="${id}"]`)?.textContent?.trim(),
      ).toBeTruthy()
    }
  })

  it('shows loading, readiness, and errors from the playground', async () => {
    await mountDemo()
    const playground = instanceFor('particles-canvas')
    expect(
      host.querySelector('[role="status"]')?.getAttribute('aria-live'),
    ).toBe('polite')
    playground.emit(NyxEvent.Loading)
    await nextTick()
    expect(host.querySelector('#playground-title')?.textContent?.trim()).toBe(
      'Loading source',
    )
    playground.markReady()
    await nextTick()
    expect(host.querySelector('#playground-title')?.textContent?.trim()).toBe(
      'Live',
    )
    expect(host.querySelector('[role="status"]')).toBeNull()
    playground.emit(NyxEvent.Error, {
      error: new Error('Unavailable'),
      stage: 'source',
    })
    await nextTick()
    expect(host.querySelector('#playground-title')?.textContent?.trim()).toBe(
      'Needs attention',
    )
  })

  it('switches the playground to video and leaves the hero running', async () => {
    await mountDemo()
    const previous = instanceFor('particles-canvas')
    const hero = instanceFor('hero-canvas')
    await clickButton('Video')
    expect(previous.destroy).toHaveBeenCalledOnce()
    expect(hero.destroy).not.toHaveBeenCalled()
    expect(instanceFor('particles-canvas').config).toMatchObject({
      type: MediaType.Video,
      source: new URL('./fixtures/nyx-orbit.mp4', document.baseURI).href,
    })
  })

  it('applies numeric edits after the debounce and updates the integration example', async () => {
    await mountDemo()
    const previous = instanceFor('particles-canvas')
    await changeInput('depth-control', '-0.5')
    await changeInput('luma-key-threshold', '0.4')
    await changeInput('luma-key-coherence', '0.6')
    await vi.advanceTimersByTimeAsync(249)
    expect(previous.destroy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(instanceFor('particles-canvas').config).toMatchObject({
      depth: -0.5,
      lumaKey: { threshold: 0.4, coherence: 0.6 },
    })
    const example = host.querySelector('pre code')?.textContent
    expect(example).toContain('depth: -0.5')
    expect(example).toContain('threshold: 0.4')
    expect(example).toContain('coherence: 0.6')
  })

  it('commits on blur without waiting for the debounce', async () => {
    await mountDemo()
    await changeInput('depth-control', '0.7')
    host.querySelector('#depth-control')!.dispatchEvent(new Event('blur'))
    await nextTick()
    expect(instanceFor('particles-canvas').config.depth).toBe(0.7)
    const count = mocks.instances.length
    await vi.advanceTimersByTimeAsync(250)
    expect(mocks.instances).toHaveLength(count)
  })

  it('applies a custom source URL through the Apply button', async () => {
    await mountDemo()
    await changeInput('source-url', './fixtures/custom.svg')
    await clickButton('Apply')
    expect(instanceFor('particles-canvas').config.source).toBe(
      new URL('./fixtures/custom.svg', document.baseURI).href,
    )
  })

  it('passes selected theme and luma mode to the next playground instance', async () => {
    await mountDemo()
    for (const [id, value] of [
      ['theme-select', ThemeName.Pastel],
      ['luma-key-mode', LumaKeyMode.Light],
    ]) {
      const select = host.querySelector<HTMLSelectElement>(`#${id}`)!
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
      await nextTick()
    }
    expect(instanceFor('particles-canvas').config).toMatchObject({
      theme: ThemeName.Pastel,
      lumaKey: { mode: LumaKeyMode.Light },
    })
  })

  it('only starts webcam input after the user enables it', async () => {
    await mountDemo()
    await clickButton('Enable webcam')
    const config = instanceFor('particles-canvas').config
    expect(config.type).toBe(MediaType.Usermedia)
    expect(config.source).toBeUndefined()
  })

  it('reports unavailable webcam access in an insecure context', async () => {
    vi.stubGlobal('isSecureContext', false)
    await mountDemo()
    await clickButton('Enable webcam')
    expect(mocks.instances).toHaveLength(2)
    expect(host.querySelector('#playground-title')?.textContent?.trim()).toBe(
      'Webcam unavailable',
    )
  })

  it('disposes both instances and cancels pending edits on unmount', async () => {
    await mountDemo()
    await changeInput('depth-control', '0.9')
    const instances = [...mocks.instances]
    app.unmount()
    await vi.advanceTimersByTimeAsync(250)
    expect(mocks.instances).toHaveLength(2)
    for (const instance of instances) {
      expect(instance.destroy).toHaveBeenCalledOnce()
    }
  })
})
