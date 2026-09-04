import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const assetsDirectory = resolve('dist-demo/assets')
const javascriptAssets = readdirSync(assetsDirectory).filter((file) => file.endsWith('.js'))
if (javascriptAssets.length === 0) throw new Error('Demo build did not emit a JavaScript asset.')
if (!existsSync(resolve('dist-demo/fixtures/hero.mp4'))) throw new Error('Demo build did not include the hero video fixture.')

const bundle = javascriptAssets.map((file) => readFileSync(resolve(assetsDirectory, file), 'utf8')).join('\n')
if (!bundle.includes('particles-canvas')) throw new Error('Compiled demo bundle does not contain the particle canvas.')
if (!bundle.includes('__name:"App"')) throw new Error('Compiled demo bundle does not contain the App SFC.')

console.log('Demo smoke passed: compiled App SFC and particle canvas are present.')
