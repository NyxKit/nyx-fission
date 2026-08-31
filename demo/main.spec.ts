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
})
