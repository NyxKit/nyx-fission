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

    expect(app).toContain('NyxEventName.Ready')
    expect(app).toContain('NyxEventName.Error')
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

    expect(app).toContain('lumaKey: LumaKeyMode.None')
    expect(app).toContain('lumaKeyThreshold: 0.1')
    expect(quickstart).toContain('lumaKey: LumaKeyMode.None')
    expect(quickstart).toContain('lumaKeyThreshold: 0.1')
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
