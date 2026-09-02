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

  it('keeps the hero preview independent and default-only', () => {
    const app = readFileSync(resolve(demoDirectory, 'App.vue'), 'utf8')

    expect(app).toContain('hero-canvas')
    expect(app).toContain('heroCanvas')
    expect(app).toContain('heroInstance')
    expect(app).toContain('new NyxFission({ type: MediaType.Video, source: videoUrl })')
    expect(app).not.toContain('browser particle engine')
    expect(app).not.toContain('GPU</span>')
    expect(app).not.toContain('MEDIA</span>')
    expect(app).not.toContain('FIELD</span>')
    expect(app).toContain('particles-canvas')
    expect(app).toContain('class="control-rail"')
    expect(app).toContain('createInstance()')
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
