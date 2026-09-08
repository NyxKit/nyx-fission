/* global DOMParser */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compile } from 'sass'

const demoDirectory = dirname(fileURLToPath(import.meta.url))
const compiledStyles = compile(resolve(demoDirectory, 'style.scss')).css

function styleRule(selector: string, styles = compiledStyles): string {
  const start = styles.indexOf(`${selector} {`)
  expect(start, `Missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0)
  return styles
    .slice(start, styles.indexOf('}', start) + 1)
    .replace(/\s+/g, ' ')
}

function mediaStyles(condition: string): string {
  return [
    ...compiledStyles.matchAll(/@media ([^{]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g),
  ]
    .filter((match) => match[1].trim() === condition)
    .map((match) => match[2])
    .join('\n')
}

describe('compiled demo entry', () => {
  it('tracks the hero fixture used by the production demo', () => {
    const repositoryRoot = resolve(demoDirectory, '..')
    const trackedFiles = execFileSync(
      'git',
      ['ls-files', '--', 'demo/public/fixtures/hero.mp4'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
      },
    )

    expect(trackedFiles.trim()).toBe('demo/public/fixtures/hero.mp4')
  })

  it('ignores alternate hero fixtures', () => {
    const gitignore = readFileSync(
      resolve(demoDirectory, '../.gitignore'),
      'utf8',
    )

    expect(gitignore).toContain('demo/public/fixtures/hero-alternatives/')
  })

  it('uses the tracked SVG fixture as the favicon', () => {
    const markup = readFileSync(resolve(demoDirectory, 'index.html'), 'utf8')
    const page = new DOMParser().parseFromString(markup, 'text/html')
    const favicon = page.querySelector('link[rel="icon"]')

    expect(favicon?.getAttribute('type')).toBe('image/svg+xml')
    expect(favicon?.getAttribute('href')).toBe('./fixtures/nyx-orbit.svg')
  })

  it('visually hides playground legends while retaining them for assistive technology', () => {
    const legend = styleRule('.demo-controls__legend')
    expect(legend).toContain('position: absolute;')
    expect(legend).toContain('width: 1px;')
    expect(legend).toContain('height: 1px;')
    expect(legend).toContain('clip: rect(0, 0, 0, 0);')
  })

  it('fills the hero with a layered particle background', () => {
    const hero = styleRule('.hero')
    const preview = styleRule('.hero__preview')
    const canvas = styleRule('.hero__canvas')
    const reducedMotion = mediaStyles('(prefers-reduced-motion: reduce)')
    const mobile = mediaStyles('(max-width: 800px)')
    const narrow = mediaStyles('(max-width: 480px)')

    expect(styleRule('.hero__copy', mobile)).toContain(
      'padding: 72px 20px 48px;',
    )
    expect(styleRule('.playground__layout', mobile)).toContain(
      'grid-template-columns: 1fr;',
    )
    expect(styleRule('.reference__grid', mobile)).toContain(
      'grid-template-columns: repeat(2, 1fr);',
    )
    expect(styleRule('.reference__grid', narrow)).toContain(
      'grid-template-columns: 1fr;',
    )

    expect(hero).toContain('min-height: max(610px, 100dvh - 76px);')
    expect(hero).not.toContain('position: relative;')
    expect(hero).not.toContain('overflow: hidden;')
    expect(styleRule('.hero__copy')).toContain('z-index: 2;')
    expect(preview).toContain('--hero-preview-scale: 1.5;')
    expect(preview).toContain('position: absolute;')
    expect(preview).toContain('left: 0;')
    expect(preview).toContain('top: 0;')
    expect(preview).toContain('width: 100dvw;')
    expect(preview).toContain('height: 100dvh;')
    expect(preview).toContain('overflow: hidden;')
    expect(preview).toContain('pointer-events: none;')
    expect(canvas).toContain('width: 100%;')
    expect(canvas).toContain('height: 100%;')
    expect(canvas).toContain('transform: scale(var(--hero-preview-scale));')
    expect(canvas).toContain('transform-origin: center;')
    expect(styleRule('body')).toContain('overflow-x: hidden;')
    expect(styleRule('.demo-header')).toContain('z-index: 3;')
    expect(styleRule('.hero__preview::after')).toContain(
      'pointer-events: none;',
    )
    expect(styleRule('.particle-stage')).toContain(
      'background: var(--nyx-c-bg-mute);',
    )
    expect(styleRule('.demo-section--surface')).toContain('z-index: 1;')
    expect(styleRule('.demo-section--surface')).toContain(
      'background: var(--nyx-c-bg);',
    )
    expect(styleRule('.hero__canvas', reducedMotion)).toContain(
      'display: none;',
    )
  })
})
