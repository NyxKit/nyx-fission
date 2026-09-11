<script setup lang="ts">
/* global URL, document, HTMLCanvasElement, window, navigator, HTMLInputElement */

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { NyxButton, NyxInput, NyxSelect, NyxTabs } from 'nyx-kit/components'
import { NyxInputType, NyxSize, NyxTheme, NyxVariant } from 'nyx-kit/types'
import {
  EntranceAnimationType,
  LumaKeyMode,
  MediaType,
  NyxEvent,
  NyxFission,
  NyxInteraction,
  type NyxErrorEvent,
  ThemeName,
} from '../src/index'
import { createHeroPreviewLifecycle } from './hero-lifecycle'
import {
  buildQuickstart,
  commitDemoDepth,
  normalizeDemoDepth,
} from './quickstart'
import {
  commitUnitInterval,
  useDebouncedNumberInput,
} from './use-debounced-number-input'

enum SourceChoice {
  Image = 'image',
  Video = 'video',
  Usermedia = 'usermedia',
}

type Status =
  | 'Waiting for a source'
  | 'Loading source'
  | 'Live'
  | 'Ready, waiting to play'
  | 'Entrance scheduled'
  | 'Playing entrance'
  | 'Needs attention'
  | 'Stopped'
  | 'Webcam unavailable'

const imageUrl = new URL('./fixtures/nyx-orbit.svg', document.baseURI).href
const faviconUrl = new URL('./favicon.svg', document.baseURI).href
const videoUrl = new URL('./fixtures/nyx-orbit.mp4', document.baseURI).href
const heroVideoUrl = new URL('./fixtures/hero.mp4', document.baseURI).href
const sourceChoice = ref<SourceChoice>(SourceChoice.Image)
const sourceUrl = ref(imageUrl)
const theme = ref<ThemeName>(ThemeName.Nyx)
const depth = ref(0.35)
const lumaKey = ref<LumaKeyMode>(LumaKeyMode.None)
const lumaKeyThreshold = ref(0.1)
const lumaKeyCoherence = ref(0)
const configTab = ref('Basic')
const configTabs = ['Basic', 'LumaKey', 'Entrance', 'Interaction']
const interactionType = ref(NyxInteraction.None)
const interactionRadius = ref(100)
const interactionStrength = ref(1)
const interactionDelay = ref(0)
const interactionDuration = ref(300)
const interactionConfig = computed(() => ({
  type: interactionType.value,
  radius: interactionRadius.value,
  strength: interactionStrength.value,
  delay: interactionDelay.value,
  duration: interactionDuration.value,
}))
const interactionOptions = [
  { value: NyxInteraction.None, label: 'None' },
  { value: NyxInteraction.Attract, label: 'Attract · toward pointer' },
  { value: NyxInteraction.Repel, label: 'Repel · away from pointer' },
  { value: NyxInteraction.Push, label: 'Push · away from camera' },
  { value: NyxInteraction.Pull, label: 'Pull · toward camera' },
]
const entranceType = ref(EntranceAnimationType.None)
const entranceTrigger = ref('automatic')
const entranceDuration = ref(1000)
const entranceDelay = ref(0)
const entranceBusy = ref(false)
const entrancePlayed = ref(false)
const playgroundReady = ref(false)
const entranceConfig = computed(() => ({
  type: entranceType.value,
  autoStart: entranceTrigger.value === 'automatic',
  duration: entranceDuration.value,
  delay: entranceDelay.value,
}))
const commitTiming = (input: string | number, current: number): number => {
  const value = Number(input)
  return String(input).trim() && Number.isFinite(value)
    ? Math.min(10000, Math.max(0, value))
    : current
}
const {
  input: entranceDurationInput,
  update: updateEntranceDuration,
  commit: commitEntranceDuration,
} = useDebouncedNumberInput(entranceDuration, commitTiming)
const {
  input: entranceDelayInput,
  update: updateEntranceDelay,
  commit: commitEntranceDelay,
} = useDebouncedNumberInput(entranceDelay, commitTiming)
const {
  input: interactionRadiusInput,
  update: updateInteractionRadius,
  commit: commitInteractionRadius,
} = useDebouncedNumberInput(interactionRadius, (input, current) =>
  Math.min(1000, Math.max(1, commitTiming(input, current))),
)
const {
  input: interactionStrengthInput,
  update: updateInteractionStrength,
  commit: commitInteractionStrength,
} = useDebouncedNumberInput(interactionStrength, commitUnitInterval)
const {
  input: interactionDelayInput,
  update: updateInteractionDelay,
  commit: commitInteractionDelay,
} = useDebouncedNumberInput(interactionDelay, commitTiming)
const {
  input: interactionDurationInput,
  update: updateInteractionDuration,
  commit: commitInteractionDuration,
} = useDebouncedNumberInput(interactionDuration, commitTiming)
const isUpdating = ref(false)
const {
  input: depthInput,
  update: updateDepthInput,
  commit: commitDepth,
} = useDebouncedNumberInput(depth, commitDemoDepth)
const {
  input: lumaKeyThresholdInput,
  update: updateLumaKeyThresholdInput,
  commit: commitLumaKeyThreshold,
} = useDebouncedNumberInput(lumaKeyThreshold, commitUnitInterval)
const {
  input: lumaKeyCoherenceInput,
  update: updateLumaKeyCoherenceInput,
  commit: commitLumaKeyCoherence,
} = useDebouncedNumberInput(lumaKeyCoherence, commitUnitInterval)
let disposeHero: (() => void) | null = null
const canvas = ref<HTMLCanvasElement | null>(null)
const instance = shallowRef<NyxFission | null>(null)
const heroCanvas = ref<HTMLCanvasElement | null>(null)
const heroInstance = ref<NyxFission | null>(null)
const status = ref<Status>('Waiting for a source')
const statusTheme = ref(NyxTheme.Info)
const statusDetail = ref('Choose a source, then mount the field.')
const copyLabel = ref('Copy example')
const quickstartCode = computed(() =>
  buildQuickstart(
    sourceChoice.value,
    sourceUrl.value,
    depth.value,
    {
      mode: lumaKey.value,
      threshold: lumaKeyThreshold.value,
      coherence: lumaKeyCoherence.value,
    },
    entranceConfig.value,
    interactionConfig.value,
  ),
)

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
const lumaKeyOptions = [
  { value: LumaKeyMode.None, label: 'Keep all particles' },
  { value: LumaKeyMode.Dark, label: 'Discard dark particles' },
  { value: LumaKeyMode.Light, label: 'Discard light particles' },
]
const entranceOptions = [
  { value: EntranceAnimationType.None, label: 'None' },
  { value: EntranceAnimationType.Gather, label: 'Gather · outside inward' },
  {
    value: EntranceAnimationType.Depth,
    label: 'Depth · distant point forward',
  },
  { value: EntranceAnimationType.Fade, label: 'Fade · reveal in place' },
  { value: EntranceAnimationType.Vortex, label: 'Vortex · spiral inward' },
  {
    value: EntranceAnimationType.ScanLeftToRight,
    label: 'Scan · left to right',
  },
  {
    value: EntranceAnimationType.ScanRightToLeft,
    label: 'Scan · right to left',
  },
  {
    value: EntranceAnimationType.ScanTopToBottom,
    label: 'Scan · top to bottom',
  },
  {
    value: EntranceAnimationType.ScanBottomToTop,
    label: 'Scan · bottom to top',
  },
  {
    value: EntranceAnimationType.Scatter,
    label: 'Scatter · assemble a dust cloud',
  },
]
const entranceTriggerOptions = [
  { value: 'automatic', label: 'Automatically on load' },
  { value: 'manual', label: 'Wait for Play' },
]
const setStatus = (nextStatus: Status, detail: string, nextTheme: NyxTheme) => {
  status.value = nextStatus
  statusTheme.value = nextTheme
  statusDetail.value = detail
}

const handleError = ({ error, stage }: NyxErrorEvent) => {
  isUpdating.value = false
  playgroundReady.value = false
  entranceBusy.value = false
  setStatus('Needs attention', `${stage}: ${error.message}`, NyxTheme.Danger)
}

const getParticleCanvas = (): HTMLCanvasElement => {
  const target = document.querySelector('#particles-canvas')
  if (target instanceof HTMLCanvasElement) return target

  const message =
    'Particle target #particles-canvas must be an HTMLCanvasElement.'
  setStatus('Needs attention', message, NyxTheme.Danger)
  throw new Error(message)
}

const destroyInstance = () => {
  if (!instance.value) return
  instance.value.destroy()
  instance.value = null
}

const createHeroInstance = () => {
  const target = heroCanvas.value
  if (!target) return

  const lifecycle = createHeroPreviewLifecycle({
    target,
    create: () =>
      new NyxFission({
        type: MediaType.Video,
        source: heroVideoUrl,
        depth: 1,
        lumaKey: { mode: LumaKeyMode.Dark, threshold: 0.2, coherence: 0.3 },
        entrance: {
          type: EntranceAnimationType.Vortex,
          autoStart: true,
          delay: 1000,
        },
      }),
    onInstanceChange: (nextInstance) => {
      heroInstance.value = nextInstance as NyxFission | null
    },
  })
  disposeHero = lifecycle.dispose
  lifecycle.mount()
}

const restartPlayground = (): void => {
  isUpdating.value = true
  destroyInstance()
  playgroundReady.value = false
  entranceBusy.value = false
  entrancePlayed.value = false
  if (
    sourceChoice.value === SourceChoice.Usermedia &&
    !window.isSecureContext
  ) {
    setStatus(
      'Webcam unavailable',
      'Webcam access requires HTTPS or localhost.',
      NyxTheme.Warning,
    )
    isUpdating.value = false
    return
  }

  try {
    const explicitTarget = getParticleCanvas()
    const config = {
      type: sourceChoice.value,
      theme: theme.value,
      depth: normalizeDemoDepth(depth.value),
      entrance: entranceConfig.value,
      interaction: interactionConfig.value,
      lumaKey: {
        mode: lumaKey.value,
        threshold: lumaKeyThreshold.value,
        coherence: lumaKeyCoherence.value,
      },
      ...(sourceChoice.value === SourceChoice.Usermedia
        ? {}
        : { source: new URL(sourceUrl.value, document.baseURI).href }),
    } as const
    const nextInstance = new NyxFission(config)
    instance.value = nextInstance
    nextInstance.on(NyxEvent.Loading, () =>
      setStatus(
        'Loading source',
        'Sampling the first frame.',
        NyxTheme.Primary,
      ),
    )
    nextInstance.on(NyxEvent.Ready, () => {
      isUpdating.value = false
      playgroundReady.value = true
      if (!config.entrance.autoStart) {
        setStatus(
          'Ready, waiting to play',
          'Media is ready. Press Play entrance to reveal the particles.',
          NyxTheme.Info,
        )
        return
      }
      if (config.entrance.type !== EntranceAnimationType.None) {
        entranceBusy.value = true
        setStatus(
          'Entrance scheduled',
          'The particles will appear after the configured delay.',
          NyxTheme.Info,
        )
        return
      }
      entrancePlayed.value = true
      setStatus(
        'Live',
        `${sourceChoice.value} is mounted with ${theme.value} at depth ${depth.value.toFixed(2)}.`,
        NyxTheme.Success,
      )
    })
    nextInstance.on(NyxEvent.EntranceStart, () => {
      entranceBusy.value = true
      setStatus(
        'Playing entrance',
        'The particle field is forming.',
        NyxTheme.Primary,
      )
    })
    nextInstance.on(NyxEvent.EntranceComplete, ({ animated }) => {
      entranceBusy.value = false
      entrancePlayed.value = true
      setStatus(
        'Live',
        animated
          ? 'Entrance complete. Press Replay entrance to watch it again.'
          : 'The particle field is visible. Motion preferences are respected.',
        NyxTheme.Success,
      )
    })
    nextInstance.on(NyxEvent.Error, handleError)
    nextInstance.on(NyxEvent.Destroy, () =>
      setStatus(
        'Stopped',
        'The renderer released its browser resources.',
        NyxTheme.Secondary,
      ),
    )

    nextInstance.ready.catch((error: NyxErrorEvent['error']) => {
      if (instance.value === nextInstance) {
        isUpdating.value = false
        setStatus('Needs attention', error.message, NyxTheme.Danger)
      }
    })
    nextInstance.mount(explicitTarget)
  } catch (error) {
    isUpdating.value = false
    const message =
      error instanceof Error
        ? error.message
        : 'The media configuration is invalid.'
    setStatus(
      'Needs attention',
      `Could not start NyxFission: ${message}`,
      NyxTheme.Danger,
    )
  }
}

const playEntrance = async () => {
  const current = instance.value
  if (!current || !playgroundReady.value || entranceBusy.value) return
  entranceBusy.value = true
  setStatus('Entrance scheduled', 'Preparing the entrance.', NyxTheme.Info)
  try {
    canvas.value?.scrollIntoView?.({ block: 'center', behavior: 'instant' })
    await current.playEntrance()
    if (instance.value !== current) return
    entranceBusy.value = false
    entrancePlayed.value = true
    setStatus('Live', 'The particle field is visible.', NyxTheme.Success)
  } catch (error) {
    if (instance.value === current)
      handleError({
        error: error as Error,
        stage: 'rendering' as NyxErrorEvent['stage'],
      })
  }
}

const chooseSource = async (choice: SourceChoice) => {
  sourceChoice.value = choice
  if (choice === SourceChoice.Image) sourceUrl.value = imageUrl
  if (choice === SourceChoice.Video) sourceUrl.value = videoUrl
  await nextTick()
  restartPlayground()
}

const startWebcam = async () => {
  sourceChoice.value = SourceChoice.Usermedia
  await nextTick()
  restartPlayground()
}

const copyExample = async () => {
  try {
    if (!navigator.clipboard)
      throw new Error('Clipboard access is unavailable in this browser.')
    await navigator.clipboard.writeText(quickstartCode.value)
    copyLabel.value = 'Copied'
  } catch (error) {
    copyLabel.value = 'Copy failed'
    const message =
      error instanceof Error ? error.message : 'Clipboard access was denied.'
    setStatus('Needs attention', message, NyxTheme.Warning)
  }
  window.setTimeout(() => {
    copyLabel.value = 'Copy example'
  }, 1600)
}

const labelNyxControls = () => {
  const sourceInput = document.getElementById('source-url')
  sourceInput?.setAttribute('aria-describedby', 'url-help')
  const hiddenSelect = document.getElementById('theme-select')
  const control = hiddenSelect
    ?.closest('.nyx-select')
    ?.querySelector<HTMLInputElement>('.nyx-select__input')
  if (control) {
    control.id = 'theme-select-control'
    control.setAttribute('aria-label', 'Particle theme')
  }
  for (const [id, label] of [
    ['entrance-type', 'Entrance animation'],
    ['entrance-trigger', 'Start entrance'],
    ['interaction-type', 'Pointer effect'],
  ]) {
    const select = document.getElementById(id)
    const input = select
      ?.closest('.nyx-select')
      ?.querySelector<HTMLInputElement>('.nyx-select__input')
    if (input) {
      input.id = `${id}-control`
      input.setAttribute('aria-label', label)
      select?.setAttribute('aria-hidden', 'true')
    }
  }
}

onMounted(async () => {
  await nextTick()
  labelNyxControls()
  createHeroInstance()
  restartPlayground()
})
watch(
  [
    theme,
    depth,
    lumaKey,
    lumaKeyThreshold,
    lumaKeyCoherence,
    entranceType,
    entranceTrigger,
    entranceDuration,
    entranceDelay,
    interactionType,
    interactionRadius,
    interactionStrength,
    interactionDelay,
    interactionDuration,
  ],
  () => {
    restartPlayground()
  },
)
onBeforeUnmount(() => {
  disposeHero?.()
  disposeHero = null
  heroInstance.value = null
  destroyInstance()
})
</script>

<template>
  <main class="demo-page">
    <header class="demo-header">
      <a
        class="wordmark"
        href="#top"
        aria-label="NyxFission home"
      >
        <img
          class="wordmark__mark"
          :src="faviconUrl"
          alt=""
          width="32"
          height="32"
        />
        <!-- prettier-ignore -->
        <span><span class="wordmark__muted">nyx</span>fission</span>
      </a>
      <nav
        class="demo-nav"
        aria-label="Page sections"
      >
        <a
          class="demo-nav__link"
          href="#playground"
        >
          Playground
        </a>
        <a
          class="demo-nav__link"
          href="#reference"
        >
          Reference
        </a>
        <a
          class="demo-nav__link"
          href="https://github.com/NyxKit/nyx-fission"
        >
          GitHub
        </a>
      </nav>
    </header>
    <section
      class="hero demo-section"
      id="top"
    >
      <div class="hero__copy">
        <p class="eyebrow">NYX / FISSION 1.1.1</p>
        <h1 class="hero__title">
          Media goes in.
          <br />
          <em class="hero__emphasis">Particles come alive.</em>
        </h1>
        <p class="hero__description">
          A tiny, framework-agnostic browser API for turning images, video, and
          webcam frames into a GPU-rendered field.
        </p>
        <a
          class="hero__link"
          href="#playground"
        >
          Try the live field
          <span aria-hidden="true">↓</span>
        </a>
      </div>
      <div
        class="hero__preview"
        aria-hidden="true"
      >
        <canvas
          class="particle-canvas hero__canvas"
          id="hero-canvas"
          ref="heroCanvas"
        ></canvas>
      </div>
    </section>
    <div
      v-if="isUpdating"
      class="playground__updating"
      role="status"
      aria-live="polite"
    >
      <span
        class="playground__spinner"
        aria-hidden="true"
      ></span>
      <span>Updating field</span>
    </div>
    <section
      class="playground demo-section demo-section--surface"
      id="playground"
      aria-labelledby="playground-title"
    >
      <div class="section-heading">
        <div>
          <p class="eyebrow">01 / playground</p>
          <h2
            class="section-heading__title"
            id="playground-title"
          >
            {{ status }}
          </h2>
        </div>
        <p class="section-heading__note">
          The renderer owns sampling, animation, resize, and cleanup. You only
          choose what to feed it.
        </p>
      </div>
      <div class="playground__layout">
        <div class="playground__preview">
          <div class="particle-stage__meta"><span>640 × 480 target</span></div>
          <div class="particle-stage">
            <canvas
              class="particle-canvas"
              id="particles-canvas"
              ref="canvas"
              aria-label="Live NyxFission particle output"
            ></canvas>
            <div class="particle-stage__corner">
              NYX
              <br />
              FISSION
            </div>
          </div>
          <p class="particle-stage__caption">
            A local SVG fixture is loaded first, so this surface works without a
            network request.
          </p>
        </div>
        <aside
          class="demo-controls"
          aria-label="Demo controls"
        >
          <NyxTabs
            v-model="configTab"
            :tabs="configTabs"
            :theme="NyxTheme.Primary"
            :size="NyxSize.Small"
            class="demo-controls__tabs"
          >
            <template #tab-Basic>
              <fieldset class="demo-controls__group">
                <legend class="demo-controls__legend">Source</legend>
                <div class="demo-controls__actions">
                  <NyxButton
                    :variant="
                      sourceChoice === SourceChoice.Image
                        ? NyxVariant.Filled
                        : NyxVariant.Outline
                    "
                    :theme="NyxTheme.Primary"
                    :size="NyxSize.Small"
                    @click="chooseSource(SourceChoice.Image)"
                  >
                    Image
                  </NyxButton>
                  <NyxButton
                    :variant="
                      sourceChoice === SourceChoice.Video
                        ? NyxVariant.Filled
                        : NyxVariant.Outline
                    "
                    :theme="NyxTheme.Primary"
                    :size="NyxSize.Small"
                    @click="chooseSource(SourceChoice.Video)"
                  >
                    Video
                  </NyxButton>
                  <NyxButton
                    :variant="NyxVariant.Outline"
                    :theme="NyxTheme.Warning"
                    :size="NyxSize.Small"
                    @click="startWebcam"
                  >
                    Enable webcam
                  </NyxButton>
                </div>
                <label
                  class="demo-controls__label"
                  for="source-url"
                >
                  Media URL
                </label>
                <div class="demo-controls__url">
                  <NyxInput
                    id="source-url"
                    v-model="sourceUrl"
                    :type="NyxInputType.Url"
                    :size="NyxSize.Small"
                  />
                  <NyxButton
                    :theme="NyxTheme.Secondary"
                    :size="NyxSize.Small"
                    @click="restartPlayground"
                  >
                    Apply
                  </NyxButton>
                </div>
                <span
                  id="url-help"
                  class="demo-controls__help"
                >
                  Relative URLs resolve from
                  <code class="inline-code">document.baseURI</code>
                  .
                </span>
              </fieldset>
              <fieldset class="demo-controls__group">
                <legend class="demo-controls__legend">Appearance</legend>
                <label
                  class="demo-controls__label"
                  for="theme-select-control"
                >
                  Particle theme
                </label>
                <NyxSelect
                  id="theme-select"
                  v-model="theme"
                  :options="themeOptions"
                  :size="NyxSize.Small"
                  :theme="NyxTheme.Primary"
                />
                <label
                  class="demo-controls__label"
                  for="depth-control"
                >
                  Particle depth: {{ depth.toFixed(2) }}
                </label>
                <NyxInput
                  id="depth-control"
                  :model-value="depthInput"
                  @update:model-value="updateDepthInput"
                  @blur="commitDepth"
                  :type="NyxInputType.Number"
                  :min="-1"
                  :max="1"
                  :step="0.05"
                  :size="NyxSize.Small"
                />
                <span class="demo-controls__help">
                  Signed depth maps luminance toward or away from the camera.
                </span>
              </fieldset>
            </template>
            <template #tab-LumaKey>
              <fieldset class="demo-controls__group">
                <legend class="demo-controls__legend">LumaKey</legend>
                <label
                  class="demo-controls__label"
                  for="luma-key-mode"
                >
                  Luma key
                </label>
                <NyxSelect
                  id="luma-key-mode"
                  v-model="lumaKey"
                  :options="lumaKeyOptions"
                  :size="NyxSize.Small"
                  :theme="NyxTheme.Primary"
                />
                <label
                  class="demo-controls__label"
                  for="luma-key-threshold"
                >
                  Luma threshold: {{ lumaKeyThreshold.toFixed(2) }}
                </label>
                <NyxInput
                  id="luma-key-threshold"
                  :model-value="lumaKeyThresholdInput"
                  @update:model-value="updateLumaKeyThresholdInput"
                  @blur="commitLumaKeyThreshold"
                  :type="NyxInputType.Number"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  :size="NyxSize.Small"
                />
                <label
                  class="demo-controls__label"
                  for="luma-key-coherence"
                >
                  Luma coherence: {{ lumaKeyCoherence.toFixed(2) }}
                </label>
                <NyxInput
                  id="luma-key-coherence"
                  :model-value="lumaKeyCoherenceInput"
                  @update:model-value="updateLumaKeyCoherenceInput"
                  @blur="commitLumaKeyCoherence"
                  :type="NyxInputType.Number"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  :size="NyxSize.Small"
                />
                <span class="demo-controls__help">
                  Coherence keeps particles with local support in the sampled
                  3x3 grid.
                </span>
              </fieldset>
            </template>
            <template #tab-Entrance>
              <fieldset
                class="demo-controls__group demo-controls__group--entrance"
              >
                <legend class="demo-controls__legend">Entrance</legend>
                <label
                  class="demo-controls__label"
                  for="entrance-type-control"
                >
                  Entrance animation
                </label>
                <NyxSelect
                  id="entrance-type"
                  v-model="entranceType"
                  :options="entranceOptions"
                  :size="NyxSize.Small"
                  :theme="NyxTheme.Primary"
                />
                <label
                  class="demo-controls__label"
                  for="entrance-trigger-control"
                >
                  Start entrance
                </label>
                <NyxSelect
                  id="entrance-trigger"
                  v-model="entranceTrigger"
                  :options="entranceTriggerOptions"
                  :size="NyxSize.Small"
                  :theme="NyxTheme.Primary"
                />
                <div class="demo-controls__timing">
                  <div>
                    <label
                      class="demo-controls__label"
                      for="entrance-duration"
                    >
                      Duration (ms)
                    </label>
                    <NyxInput
                      id="entrance-duration"
                      :model-value="entranceDurationInput"
                      @update:model-value="updateEntranceDuration"
                      @blur="commitEntranceDuration"
                      :type="NyxInputType.Number"
                      :min="0"
                      :max="10000"
                      :step="100"
                      :disabled="entranceType === EntranceAnimationType.None"
                      :size="NyxSize.Small"
                    />
                  </div>
                  <div>
                    <label
                      class="demo-controls__label"
                      for="entrance-delay"
                    >
                      Delay (ms)
                    </label>
                    <NyxInput
                      id="entrance-delay"
                      :model-value="entranceDelayInput"
                      @update:model-value="updateEntranceDelay"
                      @blur="commitEntranceDelay"
                      :type="NyxInputType.Number"
                      :min="0"
                      :max="10000"
                      :step="100"
                      :disabled="entranceType === EntranceAnimationType.None"
                      :size="NyxSize.Small"
                    />
                  </div>
                </div>
                <NyxButton
                  :size="NyxSize.Small"
                  :theme="NyxTheme.Primary"
                  :disabled="!playgroundReady || entranceBusy"
                  @click="playEntrance"
                >
                  {{
                    entranceBusy
                      ? 'Entrance in progress'
                      : entrancePlayed
                        ? 'Replay entrance'
                        : 'Play entrance'
                  }}
                </NyxButton>
                <span
                  class="demo-controls__help"
                  aria-live="polite"
                >
                  {{
                    entranceTrigger === 'manual'
                      ? 'Particles stay hidden until you press Play. Media loads immediately.'
                      : 'The entrance runs when the media is ready.'
                  }}
                  Reduced motion reveals the field instantly.
                </span>
              </fieldset>
            </template>
            <template #tab-Interaction>
              <fieldset class="demo-controls__group">
                <legend class="demo-controls__legend">Interaction</legend>
                <label
                  class="demo-controls__label"
                  for="interaction-type-control"
                >
                  Pointer effect
                </label>
                <NyxSelect
                  id="interaction-type"
                  v-model="interactionType"
                  :options="interactionOptions"
                  :size="NyxSize.Small"
                  :theme="NyxTheme.Primary"
                />
                <label
                  class="demo-controls__label"
                  for="interaction-radius"
                >
                  Radius (px)
                </label>
                <NyxInput
                  id="interaction-radius"
                  :model-value="interactionRadiusInput"
                  @update:model-value="updateInteractionRadius"
                  @blur="commitInteractionRadius"
                  :type="NyxInputType.Number"
                  :min="1"
                  :max="1000"
                  :step="10"
                  :disabled="interactionType === NyxInteraction.None"
                  :size="NyxSize.Small"
                />
                <span class="demo-controls__help">
                  Distance around the pointer that affects particles, with a
                  soft edge.
                </span>
                <label
                  class="demo-controls__label"
                  for="interaction-strength"
                >
                  Strength (0–1)
                </label>
                <NyxInput
                  id="interaction-strength"
                  :model-value="interactionStrengthInput"
                  @update:model-value="updateInteractionStrength"
                  @blur="commitInteractionStrength"
                  :type="NyxInputType.Number"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  :disabled="interactionType === NyxInteraction.None"
                  :size="NyxSize.Small"
                />
                <span class="demo-controls__help">
                  How far particles move: 0 has no effect, 1 uses the full
                  displacement.
                </span>
                <div class="demo-controls__timing">
                  <div>
                    <label
                      class="demo-controls__label"
                      for="interaction-delay"
                    >
                      Delay (ms)
                    </label>
                    <NyxInput
                      id="interaction-delay"
                      :model-value="interactionDelayInput"
                      @update:model-value="updateInteractionDelay"
                      @blur="commitInteractionDelay"
                      :type="NyxInputType.Number"
                      :min="0"
                      :max="10000"
                      :step="100"
                      :disabled="interactionType === NyxInteraction.None"
                      :size="NyxSize.Small"
                    />
                  </div>
                  <div>
                    <label
                      class="demo-controls__label"
                      for="interaction-duration"
                    >
                      Duration (ms)
                    </label>
                    <NyxInput
                      id="interaction-duration"
                      :model-value="interactionDurationInput"
                      @update:model-value="updateInteractionDuration"
                      @blur="commitInteractionDuration"
                      :type="NyxInputType.Number"
                      :min="0"
                      :max="10000"
                      :step="100"
                      :disabled="interactionType === NyxInteraction.None"
                      :size="NyxSize.Small"
                    />
                  </div>
                </div>
                <span class="demo-controls__help">
                  Hover or touch the field after its entrance. Delay holds
                  displaced particles after the pointer moves away; duration
                  sets their transition and return time. Reduced motion disables
                  pointer effects.
                </span>
              </fieldset>
            </template>
          </NyxTabs>
        </aside>
      </div>
    </section>
    <section
      class="quickstart demo-section demo-section--surface"
      aria-labelledby="quickstart-title"
    >
      <div>
        <p class="eyebrow">02 / shortest path</p>
        <h2
          class="section-heading__title"
          id="quickstart-title"
        >
          One construct. One mount.
        </h2>
        <p class="quickstart__description">
          NyxFission keeps the render loop and Three.js out of your application.
          Give it a source, then mount the canvas when you are ready.
        </p>
      </div>
      <div class="code-example quickstart__example">
        <div class="code-example__bar">
          <span>quickstart.ts</span>
          <NyxButton
            :variant="NyxVariant.Ghost"
            :size="NyxSize.Small"
            @click="copyExample"
          >
            {{ copyLabel }}
          </NyxButton>
        </div>
        <pre class="code-example__code"><code>{{ quickstartCode }}</code></pre>
      </div>
    </section>
    <section
      class="reference demo-section demo-section--surface"
      id="reference"
      aria-labelledby="reference-title"
    >
      <div class="section-heading">
        <div>
          <p class="eyebrow">03 / reference</p>
          <h2
            class="section-heading__title"
            id="reference-title"
          >
            The browser details matter.
          </h2>
        </div>
        <p class="section-heading__note">
          A predictable effect starts with predictable inputs.
        </p>
      </div>
      <div class="reference__grid">
        <article class="reference__item">
          <span class="reference__index">A</span>
          <h3 class="reference__title">Sources</h3>
          <p class="reference__description">
            Images and videos use a URL. The source must be readable by the
            browser and video media should be served with CORS headers. Webcam
            is opt-in and uses
            <code class="inline-code">getUserMedia</code>
            .
          </p>
        </article>
        <article class="reference__item">
          <span class="reference__index">B</span>
          <h3 class="reference__title">URLs</h3>
          <p class="reference__description">
            NyxFission resolves relative media URLs against
            <code class="inline-code">document.baseURI</code>
            , so deployed subpaths and base URLs work as expected. Absolute URLs
            remain absolute.
          </p>
        </article>
        <article class="reference__item">
          <span class="reference__index">C</span>
          <h3 class="reference__title">Lifecycle</h3>
          <p class="reference__description">
            Listen with
            <code class="inline-code">on(NyxEvent.Ready, fn)</code>
            and
            <code class="inline-code">off(NyxEvent.Ready, fn)</code>
            . Handle failures with
            <code class="inline-code">on(NyxEvent.Error, fn)</code>
            , await
            <code class="inline-code">ready</code>
            for a promise, and call
            <code class="inline-code">destroy()</code>
            to release the renderer.
          </p>
        </article>
        <article class="reference__item">
          <span class="reference__index">D</span>
          <h3 class="reference__title">Webcam safety</h3>
          <p class="reference__description">
            Camera access requires a secure context, HTTPS or localhost, plus
            user permission. The demo never requests it on load, and no video
            leaves your device.
          </p>
        </article>
      </div>
    </section>
    <footer class="demo-footer">
      <span class="demo-footer__item">NYXFISSION / MEDIA TO PARTICLES</span>
      <span class="demo-footer__item">
        Built for the browser, not the render loop.
      </span>
    </footer>
  </main>
</template>
