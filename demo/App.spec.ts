/* global document, Event, HTMLInputElement, HTMLSelectElement, HTMLDivElement, URL */

import { createApp, nextTick, type App as VueApp } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EntranceAnimationType,
  LumaKeyMode,
  MediaType,
  NyxEvent,
  NyxInteraction,
  ThemeName,
  type NyxFissionConfig,
} from '../src/types'
import App from './App.vue'

interface MockInstance {
  config: NyxFissionConfig
  mount: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  playEntrance: ReturnType<typeof vi.fn>
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
      readonly playEntrance = vi.fn(async () => {
        this.emit(actual.NyxEvent.EntranceStart, { type: this.config.entrance?.type, animated: true })
        this.emit(actual.NyxEvent.EntranceComplete, { type: this.config.entrance?.type, animated: true })
      })
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
  const { NyxAccordion } = await vi.importActual<typeof import('nyx-kit/components')>('nyx-kit/components')
  return {
    NyxAccordion,
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
  app.provide('libEnv', {})
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
    (candidate) => candidate.textContent?.trim() === label || candidate.querySelector('.demo-controls__section-title')?.textContent === label,
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
  it('switches between preview and highlighted JSON without replacing the canvas or media', async () => {
    await mountDemo()
    const canvas = host.querySelector('#particles-canvas')
    const current = instanceFor('particles-canvas')
    const count = mocks.instances.length
    await clickButton('Code')
    const code = host.querySelector('.playground__code code')!
    expect(JSON.parse(code.textContent!)).toEqual(current.config)
    expect(code.querySelector('.hljs-attr')).not.toBeNull()
    expect(host.querySelector('.playground__visual')?.getAttribute('aria-hidden')).toBe('true')
    expect(host.querySelector('.playground__visual')?.hasAttribute('inert')).toBe(true)
    await clickButton('Preview')
    expect(host.querySelector('#particles-canvas')).toBe(canvas)
    expect(mocks.instances).toHaveLength(count)
    expect(current.destroy).not.toHaveBeenCalled()
    expect(host.querySelector('.playground__visual')?.getAttribute('aria-hidden')).toBe('false')
  })

  it('keeps JSON synchronized with applied options and excludes unsubmitted URL edits', async () => {
    await mountDemo()
    await clickButton('Code')
    const readConfig = () => JSON.parse(host.querySelector('.playground__code code')!.textContent!)
    const originalSource = readConfig().source
    await changeInput('source-url', './fixtures/custom.svg')
    expect(readConfig().source).toBe(originalSource)
    await clickButton('Apply')
    expect(readConfig().source).toBe(new URL('./fixtures/custom.svg', document.baseURI).href)
    await changeInput('depth-control', '-0.6')
    await vi.advanceTimersByTimeAsync(250)
    const select = host.querySelector<HTMLSelectElement>('#theme-select')!
    select.value = ThemeName.Pastel
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(readConfig()).toEqual(instanceFor('particles-canvas').config)
    expect(readConfig()).toMatchObject({ depth: -0.6, theme: ThemeName.Pastel })
    expect(host.querySelector('.quickstart__example code')?.textContent).toContain('theme: ThemeName.Pastel')
  })

  it('omits source from webcam JSON and retains the stream when returning to preview', async () => {
    await mountDemo()
    await clickButton('Enable webcam')
    const current = instanceFor('particles-canvas')
    await clickButton('Code')
    const config = JSON.parse(host.querySelector('.playground__code code')!.textContent!)
    expect(config.type).toBe('usermedia')
    expect(config).not.toHaveProperty('source')
    await clickButton('Preview')
    expect(current.destroy).not.toHaveBeenCalled()
  })

  it('copies plain JSON and TypeScript rather than highlighted markup', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await mountDemo()
    await clickButton('Code')
    await clickButton('Copy JSON')
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(instanceFor('particles-canvas').config)
    await clickButton('Copy example')
    expect(writeText.mock.calls[1][0]).toBe(host.querySelector('.quickstart__example code')?.textContent)
    expect(writeText.mock.calls[1][0]).toContain('new NyxFission({\n')
    expect(writeText.mock.calls[1][0]).not.toContain('<span')
  })

  it('shows clipboard failure locally while keeping selectable code and renderer status intact', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } })
    await mountDemo()
    const status = host.querySelector('#playground-title')?.textContent
    await clickButton('Copy example')
    expect(host.querySelector('.code-example__feedback')?.textContent).toContain('Select the code to copy it')
    expect(host.querySelector('.quickstart__example pre')?.getAttribute('tabindex')).toBe('0')
    expect(host.querySelector('#playground-title')?.textContent).toBe(status)
  })

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

  it('opens Source initially and groups all settings in accordion panels', async () => {
    await mountDemo()
    const group = host.querySelector('#depth-control')?.closest('fieldset')
    expect(group?.querySelector('legend')?.textContent).toBe('Appearance')
    expect(group?.closest('.nyx-accordion__panel')?.getAttribute('aria-hidden')).toBe('true')
    const source = host.querySelector('#source-url')?.closest('.nyx-accordion__panel')
    expect(source?.getAttribute('aria-hidden')).toBe('false')
    expect(source?.querySelector('legend')?.textContent).toBe('Source')
    const luma = host.querySelector('#luma-key-mode')?.closest('fieldset')
    expect(luma?.querySelector('legend')?.textContent).toBe('LumaKey')
    for (const id of [
      'luma-key-mode',
      'luma-key-threshold',
      'luma-key-coherence',
    ]) {
      expect(luma?.querySelector(`#${id}`)).not.toBeNull()
      expect(
        luma?.querySelector(`label[for="${id}"]`)?.textContent?.trim(),
      ).toBeTruthy()
    }
  })

  it('opens only one section at a time without replacing media or resetting inputs', async () => {
    await mountDemo()
    const playground = instanceFor('particles-canvas')
    const labels = [...host.querySelectorAll('.demo-controls__section-title')].map(label => label.textContent)
    expect(labels).toEqual(['Source', 'Appearance', 'LumaKey', 'Entrance', 'Interaction'])
    const triggers = () => [...host.querySelectorAll('.nyx-accordion__trigger')]
    expect(triggers().map(button => button.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false'])
    await clickButton('Entrance')
    expect(triggers().map(button => button.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'true', 'false'])
    await clickButton('LumaKey')
    expect(triggers().map(button => button.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false'])
    expect(playground.destroy).not.toHaveBeenCalled()
    expect(mocks.instances).toHaveLength(2)
    await clickButton('Appearance')
    await changeInput('depth-control', '0.6')
    await vi.advanceTimersByTimeAsync(250)
    const edited = instanceFor('particles-canvas')
    const input = host.querySelector<HTMLInputElement>('#depth-control')!
    await changeInput('depth-control', '0.75')
    await clickButton('Appearance')
    await clickButton('Appearance')
    expect(host.querySelector('#depth-control')).toBe(input)
    expect(input.value).toBe('0.75')
    expect(edited.config.depth).toBe(0.6)
    expect(edited.destroy).not.toHaveBeenCalled()
    await clickButton('Appearance')
    expect(triggers().every(button => button.getAttribute('aria-expanded') === 'false')).toBe(true)
    for (const panel of host.querySelectorAll('.nyx-accordion__panel')) {
      expect(panel.getAttribute('aria-hidden')).toBe('true')
      expect(panel.hasAttribute('inert')).toBe(true)
    }
    expect(host.querySelector('#source-url')?.closest('[inert]')).not.toBeNull()
    expect(edited.destroy).not.toHaveBeenCalled()
  })

  it('keeps video, webcam, and JSON intact while expanding sections', async () => {
    await mountDemo()
    for (const source of ['Video', 'Enable webcam']) {
      const sourceHeader = [...host.querySelectorAll('.nyx-accordion__trigger')].find(button => button.textContent?.trim() === 'Source')!
      if (sourceHeader.getAttribute('aria-expanded') !== 'true') await clickButton('Source')
      await clickButton(source)
      await clickButton('Code')
      const current = instanceFor('particles-canvas')
      const canvas = host.querySelector('#particles-canvas')
      const code = host.querySelector('.playground__code code')?.textContent
      await clickButton('Entrance')
      await clickButton('Interaction')
      await clickButton('Appearance')
      expect(host.querySelector('#particles-canvas')).toBe(canvas)
      expect(host.querySelector('.playground__code code')?.textContent).toBe(code)
      expect(current.destroy).not.toHaveBeenCalled()
      expect(current.mount).toHaveBeenCalledOnce()
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

  it('configures pointer effects, preserves settings across sections, and updates the example', async () => {
    await mountDemo()
    expect(instanceFor('particles-canvas').config.interaction).toEqual({ type: NyxInteraction.None, radius: 100, strength: 1, delay: 0, duration: 300 })
    const hero = instanceFor('hero-canvas')
    await clickButton('Interaction')
    const select = host.querySelector<HTMLSelectElement>('#interaction-type')!
    expect([...select.options].map(option => option.value)).toEqual(Object.values(NyxInteraction))
    select.value = NyxInteraction.Pull
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    await changeInput('interaction-radius', '150')
    await changeInput('interaction-strength', '0.4')
    await changeInput('interaction-delay', '200')
    await changeInput('interaction-duration', '400')
    await vi.advanceTimersByTimeAsync(250)
    const playground = instanceFor('particles-canvas')
    expect(playground.config.interaction).toEqual({ type: NyxInteraction.Pull, radius: 150, strength: 0.4, delay: 200, duration: 400 })
    expect(host.querySelector('pre code')?.textContent?.replace(/\s+/g, ' ')).toContain('interaction: { type: NyxInteraction.Pull, radius: 150, strength: 0.4, delay: 200, duration: 400, }')
    await clickButton('Appearance')
    const interactionHeader = [...host.querySelectorAll('.nyx-accordion__trigger')].find(button => button.textContent?.includes('Interaction'))
    expect(interactionHeader?.querySelector('.demo-controls__summary')?.textContent).toBe('Pull')
    expect(host.querySelector<HTMLInputElement>('#interaction-radius')?.value).toBe('150')
    expect(playground.destroy).not.toHaveBeenCalled()
    expect(hero.destroy).not.toHaveBeenCalled()
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

  it('configures a manual entrance, updates the example, and replays without recreating media', async () => {
    await mountDemo()
    const hero = instanceFor('hero-canvas')
    for (const [id, value] of [['entrance-type', EntranceAnimationType.Depth], ['entrance-trigger', 'manual']]) {
      const select = host.querySelector<HTMLSelectElement>(`#${id}`)!
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
      await nextTick()
    }
    await changeInput('entrance-duration', '1400')
    await changeInput('entrance-delay', '250')
    await vi.advanceTimersByTimeAsync(250)
    const playground = instanceFor('particles-canvas')
    expect(playground.config.entrance).toEqual({ type: EntranceAnimationType.Depth, autoStart: false, duration: 1400, delay: 250 })
    playground.markReady()
    await nextTick()
    expect(host.querySelector('#playground-title')?.textContent).toContain('Ready, waiting to play')
    expect(host.querySelector('pre code')?.textContent).toContain('await particles.playEntrance()')
    expect(host.querySelector('pre code')?.textContent?.replace(/\s+/g, ' ')).toContain('duration: 1400, delay: 250')
    await clickButton('Code')
    await clickButton('Play entrance')
    expect(host.querySelector('.playground__visual')?.getAttribute('aria-hidden')).toBe('false')
    await clickButton('Replay entrance')
    expect(playground.playEntrance).toHaveBeenCalledTimes(2)
    expect(playground.destroy).not.toHaveBeenCalled()
    expect(hero.destroy).not.toHaveBeenCalled()
  })

  it('shows automatic delay and playback states from entrance events', async () => {
    await mountDemo()
    const select = host.querySelector<HTMLSelectElement>('#entrance-type')!
    select.value = EntranceAnimationType.Gather
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    const playground = instanceFor('particles-canvas')
    playground.markReady()
    await nextTick()
    expect(host.querySelector('#playground-title')?.textContent).toContain('Entrance scheduled')
    playground.emit(NyxEvent.EntranceStart, { animated: true })
    await nextTick()
    expect(host.querySelector('#playground-title')?.textContent).toContain('Playing entrance')
    playground.emit(NyxEvent.EntranceComplete, { animated: false })
    await nextTick()
    expect(host.querySelector('#playground-title')?.textContent?.trim()).toBe('Live')
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
