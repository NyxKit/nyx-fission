import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const demoDirectory = dirname(fileURLToPath(import.meta.url))

describe('compiled demo entry', () => {
  it('mounts an SFC instead of relying on a runtime template compiler', () => {
    const main = readFileSync(resolve(demoDirectory, 'main.ts'), 'utf8')
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')

    expect(main).toContain("import App from './App.vue'")
    expect(main).not.toContain('template: `')
    expect(app).toContain('<canvas id="particles-canvas"')
  })

  it('keeps the hero preview independent with dark luma filtering', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')
    const heroFactoryStart = app.indexOf('create: () =>')
    const heroFactoryEnd = app.indexOf('onInstanceChange', heroFactoryStart)
    const heroFactory = app.slice(heroFactoryStart, heroFactoryEnd)

    expect(app).toContain('hero-canvas')
    expect(app).toContain('heroCanvas')
    expect(app).toContain('heroInstance')
    expect(app).toContain('lumaKey: { mode: LumaKeyMode.Dark }')
    expect(heroFactory).not.toContain('threshold:')
    expect(heroFactory).not.toContain('coherence:')
    expect(app).not.toContain('LIVE / NYX-ORBIT.MP4')
    expect(app).not.toContain('browser particle engine')
    expect(app).not.toContain('GPU</span>')
    expect(app).not.toContain('MEDIA</span>')
    expect(app).not.toContain('FIELD</span>')
    expect(app).toContain('particles-canvas')
    expect(app).toContain('class="control-rail"')
    expect(app).toContain('createInstance()')
  })

  it('wires hero creation, mounting, rejection cleanup, and unmount cleanup', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')

    expect(app).toContain("import { createHeroPreviewLifecycle } from './hero-lifecycle'")
    expect(app).toContain('const lifecycle = createHeroPreviewLifecycle({')
    expect(app).toContain('disposeHero = lifecycle.dispose')
    expect(app).toContain('lifecycle.mount()')
    expect(app).toContain('disposeHero?.()')
    expect(app).toContain('heroInstance.value = null')
  })

  it('keeps Vue ambient types out of the library declaration project', () => {
    const rootViteEnv = readFileSync(resolve(demoDirectory, '../src/vite-env.d.ts'), 'utf8')
    const demoViteEnv = readFileSync(resolve(demoDirectory, 'vite-env.d.ts'), 'utf8')
    const typesConfig = readFileSync(resolve(demoDirectory, '../tsconfig.types.json'), 'utf8')

    expect(rootViteEnv).not.toContain("from 'vue'")
    expect(demoViteEnv).toContain("declare module '*.vue'")
    expect(typesConfig).toContain('src/vite-env.d.ts')
    expect(typesConfig).not.toContain("from 'vue'")
    expect(typesConfig).toContain('src/index.ts')
  })

  it('documents lifecycle subscriptions with public event enum members', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')

    expect(app).toContain('NyxEvent.Ready')
    expect(app).toContain('NyxEvent.Error')
    expect(app).not.toContain("on('ready', fn)")
    expect(app).not.toContain("off('ready', fn)")
  })

  it('places the depth control in the playground control rail', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')
    const railStart = app.indexOf('<aside class="control-rail"')
    const depthControl = app.indexOf('for="depth-control"')
    const railEnd = app.indexOf('</aside>', railStart)

    expect(railStart).toBeGreaterThanOrEqual(0)
    expect(depthControl).toBeGreaterThan(railStart)
    expect(depthControl).toBeLessThan(railEnd)
  })

  it('includes the luma-key fields in the demo configuration', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')
    const quickstart = readFileSync(resolve(demoDirectory, 'quickstart.ts'), 'utf8')

    expect(app).toContain('lumaKey: { mode: lumaKey.value, threshold: lumaKeyThreshold.value, coherence: lumaKeyCoherence.value }')
    expect(app).not.toContain('lumaKeyThreshold: lumaKeyThreshold.value')
    expect(app).toContain('lumaKeyCoherence')
    expect(quickstart).toContain('LumaKeyMode')
    expect(quickstart).toContain('coherence: ${String(coherence)}')
  })

  it('exposes luma-key controls in the playground appearance rail', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')

    expect(app).toContain('luma-key-mode')
    expect(app).toContain('luma-key-threshold')
    expect(app).toContain('luma-key-coherence')
    expect(app).not.toContain('class="status-block"')
  })

  it('visually hides playground legends while retaining them for assistive technology', () => {
    const styles = readFileSync(resolve(demoDirectory, 'style.css'), 'utf8')

    expect(styles).toContain('.control-rail legend')
    expect(styles).toContain('position: absolute')
    expect(styles).toContain('width: 1px')
    expect(styles).toContain('height: 1px')
  })

  it('floats the transparent hero preview and resets it on mobile', () => {
    const styles = readFileSync(resolve(demoDirectory, 'style.css'), 'utf8')
    const previewStart = styles.indexOf('.hero-preview {')
    const previewEnd = styles.indexOf('section {', previewStart)
    const previewStyles = styles.slice(previewStart, previewEnd)
    const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 800px)'))
    const mobilePreviewStart = mobileStyles.indexOf('.hero-preview {')
    const mobilePreviewEnd = mobileStyles.indexOf('}', mobilePreviewStart)
    const mobilePreviewStyles = mobileStyles.slice(mobilePreviewStart, mobilePreviewEnd)

    expect(mobileStyles).toContain('.hero { min-height: auto; grid-template-columns: 1fr; }')
    expect(styles).toContain('.hero { min-height: 610px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .72fr); align-items: center; position: relative; border-bottom: 0; }')
    expect(previewStyles).toContain('margin-left: -')
    expect(previewStyles).not.toContain('margin-right:')
    expect(previewStyles).toContain('transform: translateY(')
    expect(previewStyles).not.toContain('border-left: 1px solid var(--demo-line)')
    expect(previewStyles).not.toContain('background: var(--nyx-c-bg-mute)')
    expect(previewStyles).not.toContain('border: 1px solid var(--demo-line)')
    expect(styles).not.toContain('.hero-preview-label')
    expect(mobileStyles).toContain('.hero-preview { margin: 20px 0 0; margin-left: 0; padding: 20px 0 0; transform: none; border-top: 0; }')
    expect(mobileStyles).toContain('margin-left: 0')
    expect(mobilePreviewStyles).not.toContain('background:')
    expect(mobilePreviewStyles).not.toContain('border:')
    expect(mobileStyles).toContain('.hero-preview canvas { width: 100%; }')
    expect(styles).not.toContain('.hero-signal')
    expect(previewStyles).toContain('.hero-preview canvas { display: block; width: 100%; max-width: none; aspect-ratio: 4 / 3; }')
  })

  it('uses the MP4 playground video fixture', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')

    expect(app).toContain("./fixtures/nyx-orbit.mp4")
    expect(app).not.toContain("./fixtures/nyx-orbit.webm")
  })

  it('applies numeric input changes automatically and exposes update progress', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')
    const styles = readFileSync(resolve(demoDirectory, 'style.css'), 'utf8')

    expect(app).toContain('scheduleDepthCommit')
    expect(app).toContain('scheduleLumaKeyThresholdCommit')
    expect(app).toContain('isUpdating')
    expect(app).toContain('aria-live="polite"')
    expect(styles).toContain('.playground-updating')
    expect(styles).toContain('animation:')
  })

  it('keeps the playground focused on explicit mounting and live status', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')

    expect(app).not.toContain('MountChoice')
    expect(app).not.toContain('mountChoice')
    expect(app).not.toContain('mountOptions')
    expect(app).not.toContain('mount-select')
    expect(app).not.toContain('Integration shape')
    expect(app).toContain('<h2 id="playground-title">{{ status }}</h2>')
    expect(app).not.toContain('{{ status.toLowerCase() }} live')
    expect(app).not.toContain('LIVE OUTPUT')
  })
})
