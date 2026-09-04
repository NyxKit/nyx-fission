import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const demoDirectory = dirname(fileURLToPath(import.meta.url))

describe('compiled demo entry', () => {
  it('tracks the hero fixture used by the production demo', () => {
    const repositoryRoot = resolve(demoDirectory, '..')
    const trackedFiles = execFileSync('git', ['ls-files', '--', 'demo/public/fixtures/hero.mp4'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })

    expect(trackedFiles.trim()).toBe('demo/public/fixtures/hero.mp4')
  })

  it('ignores alternate hero fixtures', () => {
    const gitignore = readFileSync(resolve(demoDirectory, '../.gitignore'), 'utf8')

    expect(gitignore).toContain('demo/public/fixtures/hero-alternatives/')
  })

  it('mounts an SFC instead of relying on a runtime template compiler', () => {
    const main = readFileSync(resolve(demoDirectory, 'main.ts'), 'utf8')
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')

    expect(main).toContain("import App from './App.vue'")
    expect(main).not.toContain('template: `')
    expect(app).toContain('<canvas id="particles-canvas"')
  })

  it('uses the tracked SVG fixture as the favicon', () => {
    const index = readFileSync(resolve(demoDirectory, 'index.html'), 'utf8')

    expect(index).toContain('<link rel="icon" type="image/svg+xml" href="./fixtures/nyx-orbit.svg" />')
  })

  it('keeps the hero preview independent with dark luma filtering', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')
    const heroFactoryStart = app.indexOf('create: () =>')
    const heroFactoryEnd = app.indexOf('onInstanceChange', heroFactoryStart)
    const heroFactory = app.slice(heroFactoryStart, heroFactoryEnd)

    expect(app).toContain('hero-canvas')
    expect(app).toContain('heroCanvas')
    expect(app).toContain('heroInstance')
    expect(app).toContain("const heroVideoUrl = new URL('./fixtures/hero.mp4', document.baseURI).href")
    expect(app).toContain('lumaKey: { mode: LumaKeyMode.Dark, threshold: 0.2, coherence: 0.3 }')
    expect(heroFactory).toContain('source: heroVideoUrl')
    expect(heroFactory).toContain('threshold: 0.2')
    expect(heroFactory).toContain('coherence: 0.3')
    expect(heroFactory).toContain('depth: 1')
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

  it('fills the hero with a layered particle background', () => {
    const styles = readFileSync(resolve(demoDirectory, 'style.css'), 'utf8')
    const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 800px)'))
    const reducedMotionStart = styles.indexOf('@media (prefers-reduced-motion: reduce)')
    const reducedMotionEnd = styles.indexOf('\n}', reducedMotionStart)
    const reducedMotionStyles = styles.slice(reducedMotionStart, reducedMotionEnd)
    const heroPreviewRuleStart = styles.indexOf('.hero-preview {')
    const heroPreviewRuleEnd = styles.indexOf('}', heroPreviewRuleStart)
    const heroPreviewRule = styles.slice(heroPreviewRuleStart, heroPreviewRuleEnd)
    const heroCanvasRuleStart = styles.indexOf('.hero-preview canvas {')
    const heroCanvasRuleEnd = styles.indexOf('}', heroCanvasRuleStart)
    const heroCanvasRule = styles.slice(heroCanvasRuleStart, heroCanvasRuleEnd)
    const heroRuleStart = styles.indexOf('.hero {')
    const heroRuleEnd = styles.indexOf('}', heroRuleStart)
    const heroRule = styles.slice(heroRuleStart, heroRuleEnd)
    const bodyRuleStart = styles.indexOf('body {')
    const bodyRuleEnd = styles.indexOf('}', bodyRuleStart)
    const bodyRule = styles.slice(bodyRuleStart, bodyRuleEnd)
    const topbarRuleStart = styles.indexOf('.topbar {')
    const topbarRuleEnd = styles.indexOf('}', topbarRuleStart)
    const topbarRule = styles.slice(topbarRuleStart, topbarRuleEnd)

    expect(styles).toContain('.hero { min-height: max(610px, calc(100dvh - 76px)); display: block; }')
    expect(heroRule).not.toContain('position: relative;')
    expect(heroRule).not.toContain('overflow: hidden;')
    expect(styles).toContain('.hero-copy { position: relative; z-index: 2;')
    expect(heroPreviewRule).toContain('--hero-preview-scale: 1.5;')
    expect(heroPreviewRule).toContain('position: absolute;')
    expect(heroPreviewRule).toContain('left: 0;')
    expect(heroPreviewRule).toContain('top: 0;')
    expect(heroPreviewRule).toContain('width: 100dvw;')
    expect(heroPreviewRule).toContain('height: 100dvh;')
    expect(heroPreviewRule).toContain('overflow: hidden;')
    expect(heroPreviewRule).toContain('pointer-events: none;')
    expect(heroCanvasRule).toContain('transform: scale(var(--hero-preview-scale));')
    expect(heroCanvasRule).toContain('transform-origin: center;')
    expect(bodyRule).toContain('overflow-x: hidden;')
    expect(topbarRule).toContain('position: relative;')
    expect(topbarRule).toContain('z-index: 3;')
    expect(styles).toContain('.hero-preview::after {')
    expect(styles).toContain('.hero-preview canvas { display: block; width: 100%; height: 100%;')
    expect(styles).toContain('background: var(--nyx-c-bg-mute);')
    expect(styles).toContain('.site-shell > section:not(.hero), footer { position: relative; z-index: 1; background: var(--nyx-c-bg); }')
    expect(mobileStyles).toContain('.hero { min-height: max(610px, calc(100dvh - 76px)); }')
    expect(mobileStyles).toContain('.hero-copy { padding: 72px 20px 48px; }')
    expect(reducedMotionStyles).toContain('.hero-preview canvas { display: none; }')
  })

  it('uses the MP4 playground video fixture', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')

    expect(app).toContain("./fixtures/nyx-orbit.mp4")
    expect(app).not.toContain("./fixtures/nyx-orbit.webm")
  })

  it('applies numeric input changes automatically and exposes update progress', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')
    const styles = readFileSync(resolve(demoDirectory, 'style.css'), 'utf8')
    const playgroundUpdatingRuleStart = styles.indexOf('.playground-updating {')
    const playgroundUpdatingRuleEnd = styles.indexOf('}', playgroundUpdatingRuleStart)
    const playgroundUpdatingRule = styles.slice(playgroundUpdatingRuleStart, playgroundUpdatingRuleEnd)

    expect(app).toContain('scheduleDepthCommit')
    expect(app).toContain('scheduleLumaKeyThresholdCommit')
    expect(app).toContain('isUpdating')
    expect(app).toContain('aria-live="polite"')
    expect(styles).toContain('.playground-updating')
    expect(playgroundUpdatingRule).toContain('position: relative;')
    expect(playgroundUpdatingRule).toContain('z-index: 1;')
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
