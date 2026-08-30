import { createApp, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NyxKit } from 'nyx-kit'
import { NyxBadge, NyxButton, NyxInput, NyxSelect, NyxStatusDot } from 'nyx-kit/components'
import { NyxInputType, NyxSize, NyxTheme, NyxVariant } from 'nyx-kit/types'
import 'nyx-kit/style.css'
import { NyxFission, type NyxErrorEvent, type ThemeName } from '../src/index'
import './style.css'

type SourceChoice = 'image' | 'video' | 'usermedia'
type MountChoice = 'explicit' | 'selector'

const imageUrl = new URL('./fixtures/nyx-orbit.svg', document.baseURI).href
const videoUrl = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

const Demo = defineComponent({
  name: 'NyxFissionDemo',
  components: { NyxBadge, NyxButton, NyxInput, NyxSelect, NyxStatusDot },
  setup() {
    const sourceChoice = ref<SourceChoice>('image')
    const sourceUrl = ref(imageUrl)
    const theme = ref<ThemeName>('nyx')
    const mountChoice = ref<MountChoice>('explicit')
    const canvas = ref<HTMLCanvasElement | null>(null)
    const instance = ref<NyxFission | null>(null)
    const status = ref('Waiting for a source')
    const statusDetail = ref('Choose a source, then mount the field.')
    const copyLabel = ref('Copy example')

    const sourceOptions = [
      { value: 'image', label: 'Local image' },
      { value: 'video', label: 'Video URL' },
    ]
    const themeOptions = [
      { value: 'nyx', label: 'Nyx semantic' },
      { value: 'grayscale', label: 'Grayscale' },
      { value: 'discodip', label: 'Discodip' },
      { value: 'pastel', label: 'Pastel' },
    ]
    const mountOptions = [
      { value: 'explicit', label: 'instance.mount(canvas)' },
      { value: 'selector', label: 'querySelector: #nyx-canvas' },
    ]

    const setStatus = (nextStatus: string, detail: string) => {
      status.value = nextStatus
      statusDetail.value = detail
    }

    const handleError = ({ error, stage }: NyxErrorEvent) => {
      setStatus('Needs attention', `${stage}: ${error.message}`)
    }

    const destroyInstance = () => {
      if (!instance.value) return
      instance.value.destroy()
      instance.value = null
    }

    const createInstance = async () => {
      destroyInstance()
      if (sourceChoice.value === 'usermedia' && !window.isSecureContext) {
        setStatus('Webcam unavailable', 'Webcam access requires HTTPS or localhost.')
        return
      }

      const config = {
        type: sourceChoice.value,
        theme: theme.value,
        ...(sourceChoice.value === 'usermedia'
          ? {}
          : { source: new URL(sourceUrl.value, document.baseURI).href }),
        ...(mountChoice.value === 'selector' ? { querySelector: '#nyx-canvas' } : {}),
      } as const
      const nextInstance = new NyxFission(config)
      instance.value = nextInstance
      nextInstance.on('loading', () => setStatus('Loading source', 'Sampling the first frame.'))
      nextInstance.on('ready', () => setStatus('Live', `${sourceChoice.value} is mounted with ${theme.value}.`))
      nextInstance.on('error', handleError)
      nextInstance.on('destroy', () => setStatus('Stopped', 'The renderer released its browser resources.'))

      nextInstance.ready.catch((error: NyxErrorEvent['error']) => {
        if (instance.value === nextInstance) setStatus('Needs attention', error.message)
      })
      if (mountChoice.value === 'explicit' && canvas.value) nextInstance.mount(canvas.value)
    }

    const chooseSource = async (choice: SourceChoice) => {
      sourceChoice.value = choice
      if (choice === 'image') sourceUrl.value = imageUrl
      if (choice === 'video') sourceUrl.value = videoUrl
      await nextTick()
      await createInstance()
    }

    const startWebcam = async () => {
      sourceChoice.value = 'usermedia'
      await nextTick()
      await createInstance()
    }

    const applySource = async () => {
      await createInstance()
    }

    const copyExample = async () => {
      const example = `const particles = new NyxFission({ source: '${sourceUrl.value}' })\nparticles.mount(document.querySelector('#nyx-canvas'))`
      await navigator.clipboard?.writeText(example)
      copyLabel.value = 'Copied'
      window.setTimeout(() => { copyLabel.value = 'Copy example' }, 1600)
    }

    onMounted(() => { void createInstance() })
    watch([theme, mountChoice], () => { void createInstance() })
    onBeforeUnmount(destroyInstance)

    return {
      applySource,
      canvas,
      chooseSource,
      copyExample,
      copyLabel,
      mountChoice,
      mountOptions,
      NyxInputType,
      NyxSize,
      NyxTheme,
      NyxVariant,
      sourceChoice,
      sourceOptions,
      sourceUrl,
      startWebcam,
      status,
      statusDetail,
      theme,
      themeOptions,
    }
  },
  template: `
    <main class="site-shell">
      <header class="topbar">
        <a class="wordmark" href="#top" aria-label="NyxFission home"><span class="wordmark-mark">N</span><span>nyx<span class="wordmark-muted">fission</span></span></a>
        <nav aria-label="Page sections"><a href="#playground">Playground</a><a href="#reference">Reference</a><a href="https://github.com/NyxKit/nyx-fission">GitHub</a></nav>
      </header>

      <section class="hero" id="top">
        <div class="hero-copy">
          <NyxBadge :theme="NyxTheme.Primary" :variant="NyxVariant.Soft">browser particle engine</NyxBadge>
          <p class="eyebrow">NYX / FISSION 0.1</p>
          <h1>Media goes in.<br><em>Particles come alive.</em></h1>
          <p class="lede">A tiny, framework-agnostic browser API for turning images, video, and webcam frames into a GPU-rendered field.</p>
          <a class="text-link" href="#playground">Try the live field <span aria-hidden="true">↓</span></a>
        </div>
        <div class="hero-signal" aria-hidden="true"><span>GPU</span><span>MEDIA</span><span>FIELD</span></div>
      </section>

      <section class="playground" id="playground" aria-labelledby="playground-title">
        <div class="section-heading"><div><p class="eyebrow">01 / playground</p><h2 id="playground-title">See the source dissolve.</h2></div><p class="section-note">The renderer owns sampling, animation, resize, and cleanup. You only choose what to feed it.</p></div>
        <div class="stage-layout">
          <div class="stage-wrap">
            <div class="stage-meta"><span>LIVE OUTPUT</span><span>640 × 480 target</span></div>
            <div class="stage"><canvas id="nyx-canvas" ref="canvas" aria-label="Live NyxFission particle output"></canvas><div class="stage-corner">NYX<br>FISSION</div></div>
            <p class="stage-caption">A local SVG fixture is loaded first, so this surface works without a network request.</p>
          </div>
          <aside class="control-rail" aria-label="Demo controls">
            <div class="status-block"><NyxStatusDot theme="success" :label="status" /><div><strong>{{ status }}</strong><span aria-live="polite">{{ statusDetail }}</span></div></div>
            <fieldset><legend>Source</legend><div class="source-actions"><NyxButton :variant="sourceChoice === 'image' ? NyxVariant.Filled : NyxVariant.Outline" :theme="NyxTheme.Primary" :size="NyxSize.Small" @click="chooseSource('image')">Image</NyxButton><NyxButton :variant="sourceChoice === 'video' ? NyxVariant.Filled : NyxVariant.Outline" :theme="NyxTheme.Primary" :size="NyxSize.Small" @click="chooseSource('video')">Video</NyxButton><NyxButton :variant="NyxVariant.Outline" :theme="NyxTheme.Warning" :size="NyxSize.Small" @click="startWebcam">Enable webcam</NyxButton></div><label class="field-label" for="source-url">Media URL</label><div class="url-row"><NyxInput id="source-url" v-model="sourceUrl" :type="NyxInputType.Url" :size="NyxSize.Small" aria-describedby="url-help" /><NyxButton :theme="NyxTheme.Secondary" :size="NyxSize.Small" @click="applySource">Apply</NyxButton></div><span id="url-help" class="help-text">Relative URLs resolve from <code>document.baseURI</code>.</span></fieldset>
            <fieldset><legend>Appearance</legend><label class="field-label" for="theme-select">Particle theme</label><NyxSelect id="theme-select" v-model="theme" :options="themeOptions" :size="NyxSize.Small" :theme="NyxTheme.Primary" /></fieldset>
            <fieldset><legend>Mount target</legend><label class="field-label" for="mount-select">Integration shape</label><NyxSelect id="mount-select" v-model="mountChoice" :options="mountOptions" :size="NyxSize.Small" :theme="NyxTheme.Primary" /><span class="help-text">Changing controls recreates the instance.</span></fieldset>
          </aside>
        </div>
      </section>

      <section class="quickstart" aria-labelledby="quickstart-title"><div><p class="eyebrow">02 / shortest path</p><h2 id="quickstart-title">One construct. One mount.</h2><p>NyxFission keeps the render loop and Three.js out of your application. Give it a source, then mount the canvas when you are ready.</p></div><div class="code-panel"><div class="code-bar"><span>quickstart.ts</span><NyxButton :variant="NyxVariant.Ghost" :size="NyxSize.Small" @click="copyExample">{{ copyLabel }}</NyxButton></div><pre><code><span class="code-keyword">import</span> { NyxFission } <span class="code-keyword">from</span> <span class="code-string">'nyx-fission'</span>

      <section class="reference" id="reference" aria-labelledby="reference-title"><div class="section-heading"><div><p class="eyebrow">03 / reference</p><h2 id="reference-title">The browser details matter.</h2></div><p class="section-note">A predictable effect starts with predictable inputs.</p></div><div class="reference-grid"><article><span class="ref-index">A</span><h3>Sources</h3><p>Images and videos use a URL. The source must be readable by the browser and video media should be served with CORS headers. Webcam is opt-in and uses <code>getUserMedia</code>.</p></article><article><span class="ref-index">B</span><h3>URLs</h3><p>NyxFission resolves relative media URLs against <code>document.baseURI</code>, so deployed subpaths and base URLs work as expected. Absolute URLs remain absolute.</p></article><article><span class="ref-index">C</span><h3>Lifecycle</h3><p>Listen with <code>on('ready', fn)</code> and <code>off('ready', fn)</code>. Await <code>ready</code> for a promise, and call <code>destroy()</code> to release the renderer.</p></article><article><span class="ref-index">D</span><h3>Webcam safety</h3><p>Camera access requires a secure context, HTTPS or localhost, plus user permission. The demo never requests it on load, and no video leaves your device.</p></article></div></section>
      <footer><span>NYXFISSION / MEDIA TO PARTICLES</span><span>Built for the browser, not the render loop.</span></footer>
    </main>
  `,
})

createApp(Demo).use(NyxKit).mount('#app')
