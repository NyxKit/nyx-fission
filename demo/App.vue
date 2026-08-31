<script setup lang="ts">
/* global URL, document, HTMLCanvasElement, window, navigator, HTMLInputElement */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NyxBadge, NyxButton, NyxInput, NyxSelect, NyxStatusDot } from 'nyx-kit/components'
import { NyxInputType, NyxSize, NyxTheme, NyxVariant } from 'nyx-kit/types'
import { NyxEventName, NyxFission, type NyxErrorEvent, ThemeName } from '../src/index'
import { buildQuickstart, normalizeDemoDepth } from './quickstart'

enum SourceChoice {
  Image = 'image',
  Video = 'video',
  Usermedia = 'usermedia',
}

enum MountChoice {
  Explicit = 'explicit',
  Selector = 'selector',
}

type Status = 'Waiting for a source' | 'Loading source' | 'Live' | 'Needs attention' | 'Stopped' | 'Webcam unavailable'

const imageUrl = new URL('./fixtures/nyx-orbit.svg', document.baseURI).href
const videoUrl = new URL('./fixtures/nyx-orbit.webm', document.baseURI).href
const sourceChoice = ref<SourceChoice>(SourceChoice.Image)
const sourceUrl = ref(imageUrl)
const theme = ref<ThemeName>(ThemeName.Nyx)
const depth = ref(0.35)
const mountChoice = ref<MountChoice>(MountChoice.Explicit)
const canvas = ref<HTMLCanvasElement | null>(null)
const instance = ref<NyxFission | null>(null)
const status = ref<Status>('Waiting for a source')
const statusTheme = ref(NyxTheme.Info)
const statusDetail = ref('Choose a source, then mount the field.')
const copyLabel = ref('Copy example')
const quickstartCode = computed(() => buildQuickstart(sourceChoice.value, sourceUrl.value, depth.value))

const sourceOptions = [
  { value: SourceChoice.Image, label: 'Local image' },
  { value: SourceChoice.Video, label: 'Video URL' },
]
const themeOptions = [
  { value: ThemeName.Nyx, label: 'Nyx semantic' },
  { value: ThemeName.Grayscale, label: 'Grayscale' },
  { value: ThemeName.Discodip, label: 'Discodip' },
  { value: ThemeName.Pastel, label: 'Pastel' },
]
const mountOptions = [
  { value: MountChoice.Explicit, label: 'instance.mount(canvas)' },
  { value: MountChoice.Selector, label: 'querySelector: #particles-canvas' },
]

const setStatus = (nextStatus: Status, detail: string, nextTheme: NyxTheme) => {
  status.value = nextStatus
  statusTheme.value = nextTheme
  statusDetail.value = detail
}

const handleError = ({ error, stage }: NyxErrorEvent) => {
  setStatus('Needs attention', `${stage}: ${error.message}`, NyxTheme.Danger)
}

const updateDepth = (value: string) => {
  depth.value = normalizeDemoDepth(Number(value))
}

const getParticleCanvas = (): HTMLCanvasElement => {
  const target = document.querySelector('#particles-canvas')
  if (target instanceof HTMLCanvasElement) return target

  const message = 'Particle target #particles-canvas must be an HTMLCanvasElement.'
  setStatus('Needs attention', message, NyxTheme.Danger)
  throw new Error(message)
}

const destroyInstance = () => {
  if (!instance.value) return
  instance.value.destroy()
  instance.value = null
}

const createInstance = async () => {
  destroyInstance()
  if (sourceChoice.value === SourceChoice.Usermedia && !window.isSecureContext) {
    setStatus('Webcam unavailable', 'Webcam access requires HTTPS or localhost.', NyxTheme.Warning)
    return
  }

  try {
    const explicitTarget = mountChoice.value === MountChoice.Explicit ? getParticleCanvas() : undefined
    const config = {
      type: sourceChoice.value,
      theme: theme.value,
      depth: normalizeDemoDepth(depth.value),
      ...(sourceChoice.value === SourceChoice.Usermedia
        ? {}
        : { source: new URL(sourceUrl.value, document.baseURI).href }),
      ...(mountChoice.value === MountChoice.Selector ? { querySelector: '#particles-canvas' } : {}),
    } as const
    const nextInstance = new NyxFission(config)
    instance.value = nextInstance
    nextInstance.on(NyxEventName.Loading, () => setStatus('Loading source', 'Sampling the first frame.', NyxTheme.Primary))
    nextInstance.on(NyxEventName.Ready, () => setStatus('Live', `${sourceChoice.value} is mounted with ${theme.value} at depth ${depth.value.toFixed(2)}.`, NyxTheme.Success))
    nextInstance.on(NyxEventName.Error, handleError)
    nextInstance.on(NyxEventName.Destroy, () => setStatus('Stopped', 'The renderer released its browser resources.', NyxTheme.Secondary))

    nextInstance.ready.catch((error: NyxErrorEvent['error']) => {
      if (instance.value === nextInstance) setStatus('Needs attention', error.message, NyxTheme.Danger)
    })
    if (explicitTarget) nextInstance.mount(explicitTarget)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The media configuration is invalid.'
    setStatus('Needs attention', `Could not start NyxFission: ${message}`, NyxTheme.Danger)
  }
}

const chooseSource = async (choice: SourceChoice) => {
  sourceChoice.value = choice
  if (choice === SourceChoice.Image) sourceUrl.value = imageUrl
  if (choice === SourceChoice.Video) sourceUrl.value = videoUrl
  await nextTick()
  await createInstance()
}

const startWebcam = async () => {
  sourceChoice.value = SourceChoice.Usermedia
  await nextTick()
  await createInstance()
}

const applySource = async () => {
  await createInstance()
}

const copyExample = async () => {
  try {
    if (!navigator.clipboard) throw new Error('Clipboard access is unavailable in this browser.')
    await navigator.clipboard.writeText(quickstartCode.value)
    copyLabel.value = 'Copied'
  } catch (error) {
    copyLabel.value = 'Copy failed'
    const message = error instanceof Error ? error.message : 'Clipboard access was denied.'
    setStatus('Needs attention', message, NyxTheme.Warning)
  }
  window.setTimeout(() => { copyLabel.value = 'Copy example' }, 1600)
}

const labelNyxControls = () => {
  const sourceInput = document.getElementById('source-url')
  sourceInput?.setAttribute('aria-describedby', 'url-help')
  for (const [id, label] of [['theme-select', 'Particle theme'], ['mount-select', 'Integration shape']] as const) {
    const hiddenSelect = document.getElementById(id)
    const control = hiddenSelect?.closest('.nyx-select')?.querySelector<HTMLInputElement>('.nyx-select__input')
    if (control) {
      control.id = `${id}-control`
      control.setAttribute('aria-label', label)
    }
  }
}

onMounted(async () => {
  await nextTick()
  labelNyxControls()
  void createInstance()
})
watch([theme, mountChoice, depth], () => { void createInstance() })
onBeforeUnmount(destroyInstance)
</script>

<template>
  <div class="depth-control">
    <label class="field-label" for="depth-control">Particle depth: {{ depth.toFixed(2) }}</label>
    <NyxInput id="depth-control" :model-value="String(depth)" @update:model-value="updateDepth" :type="NyxInputType.Number" :min="-1" :max="1" :step="0.05" :size="NyxSize.Small" />
    <span class="help-text">Signed depth maps luminance toward or away from the camera.</span>
  </div>
  <main class="site-shell">
    <header class="topbar">
      <a class="wordmark" href="#top" aria-label="NyxFission home"><span class="wordmark-mark">N</span><span>nyx<span class="wordmark-muted">fission</span></span></a>
      <nav aria-label="Page sections"><a href="#playground">Playground</a><a href="#reference">Reference</a><a href="https://github.com/NyxKit/nyx-fission">GitHub</a></nav>
    </header>
    <section class="hero" id="top"><div class="hero-copy"><NyxBadge :theme="NyxTheme.Primary" :variant="NyxVariant.Soft">browser particle engine</NyxBadge><p class="eyebrow">NYX / FISSION 0.1</p><h1>Media goes in.<br><em>Particles come alive.</em></h1><p class="lede">A tiny, framework-agnostic browser API for turning images, video, and webcam frames into a GPU-rendered field.</p><a class="text-link" href="#playground">Try the live field <span aria-hidden="true">↓</span></a></div><div class="hero-signal" aria-hidden="true"><span>GPU</span><span>MEDIA</span><span>FIELD</span></div></section>
    <section class="playground" id="playground" aria-labelledby="playground-title"><div class="section-heading"><div><p class="eyebrow">01 / playground</p><h2 id="playground-title">See the source dissolve.</h2></div><p class="section-note">The renderer owns sampling, animation, resize, and cleanup. You only choose what to feed it.</p></div><div class="stage-layout"><div class="stage-wrap"><div class="stage-meta"><span>LIVE OUTPUT</span><span>640 × 480 target</span></div><div class="stage"><canvas id="particles-canvas" ref="canvas" aria-label="Live NyxFission particle output"></canvas><div class="stage-corner">NYX<br>FISSION</div></div><p class="stage-caption">A local SVG fixture is loaded first, so this surface works without a network request.</p></div><aside class="control-rail" aria-label="Demo controls"><div class="status-block"><NyxStatusDot :theme="statusTheme" :label="status" /><div><strong>{{ status }}</strong><span aria-live="polite">{{ statusDetail }}</span></div></div><fieldset><legend>Source</legend><div class="source-actions"><NyxButton :variant="sourceChoice === SourceChoice.Image ? NyxVariant.Filled : NyxVariant.Outline" :theme="NyxTheme.Primary" :size="NyxSize.Small" @click="chooseSource(SourceChoice.Image)">Image</NyxButton><NyxButton :variant="sourceChoice === SourceChoice.Video ? NyxVariant.Filled : NyxVariant.Outline" :theme="NyxTheme.Primary" :size="NyxSize.Small" @click="chooseSource(SourceChoice.Video)">Video</NyxButton><NyxButton :variant="NyxVariant.Outline" :theme="NyxTheme.Warning" :size="NyxSize.Small" @click="startWebcam">Enable webcam</NyxButton></div><label class="field-label" for="source-url">Media URL</label><div class="url-row"><NyxInput id="source-url" v-model="sourceUrl" :type="NyxInputType.Url" :size="NyxSize.Small" /><NyxButton :theme="NyxTheme.Secondary" :size="NyxSize.Small" @click="applySource">Apply</NyxButton></div><span id="url-help" class="help-text">Relative URLs resolve from <code>document.baseURI</code>.</span></fieldset><fieldset><legend>Appearance</legend><label class="field-label" for="theme-select-control">Particle theme</label><NyxSelect id="theme-select" v-model="theme" :options="themeOptions" :size="NyxSize.Small" :theme="NyxTheme.Primary" /></fieldset><fieldset><legend>Mount target</legend><label class="field-label" for="mount-select-control">Integration shape</label><NyxSelect id="mount-select" v-model="mountChoice" :options="mountOptions" :size="NyxSize.Small" :theme="NyxTheme.Primary" /><span class="help-text">Changing controls recreates the instance.</span></fieldset></aside></div></section>
    <section class="quickstart" aria-labelledby="quickstart-title"><div><p class="eyebrow">02 / shortest path</p><h2 id="quickstart-title">One construct. One mount.</h2><p>NyxFission keeps the render loop and Three.js out of your application. Give it a source, then mount the canvas when you are ready.</p></div><div class="code-panel"><div class="code-bar"><span>quickstart.ts</span><NyxButton :variant="NyxVariant.Ghost" :size="NyxSize.Small" @click="copyExample">{{ copyLabel }}</NyxButton></div><pre><code>{{ quickstartCode }}</code></pre></div></section>
    <section class="reference" id="reference" aria-labelledby="reference-title"><div class="section-heading"><div><p class="eyebrow">03 / reference</p><h2 id="reference-title">The browser details matter.</h2></div><p class="section-note">A predictable effect starts with predictable inputs.</p></div><div class="reference-grid"><article><span class="ref-index">A</span><h3>Sources</h3><p>Images and videos use a URL. The source must be readable by the browser and video media should be served with CORS headers. Webcam is opt-in and uses <code>getUserMedia</code>.</p></article><article><span class="ref-index">B</span><h3>URLs</h3><p>NyxFission resolves relative media URLs against <code>document.baseURI</code>, so deployed subpaths and base URLs work as expected. Absolute URLs remain absolute.</p></article><article><span class="ref-index">C</span><h3>Lifecycle</h3><p>Listen with <code>on(NyxEventName.Ready, fn)</code> and <code>off(NyxEventName.Ready, fn)</code>. Handle failures with <code>on(NyxEventName.Error, fn)</code>, await <code>ready</code> for a promise, and call <code>destroy()</code> to release the renderer.</p></article><article><span class="ref-index">D</span><h3>Webcam safety</h3><p>Camera access requires a secure context, HTTPS or localhost, plus user permission. The demo never requests it on load, and no video leaves your device.</p></article></div></section>
    <footer><span>NYXFISSION / MEDIA TO PARTICLES</span><span>Built for the browser, not the render loop.</span></footer>
  </main>
</template>
