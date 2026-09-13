import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import { buildQuickstart, commitDemoDepth } from './quickstart'
import {
  EntranceAnimationType,
  LumaKeyMode,
  MediaType,
  NyxInteraction,
  ThemeName,
  type NyxFissionConfig,
} from '../src/types'

// Compile and execute the displayed example with a fake renderer to verify that
// formatting still produces working TypeScript and the intended configuration.
async function runExample(code: string) {
  const result = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  })
  expect(result.diagnostics).toEqual([])
  let config: NyxFissionConfig | undefined
  const target = {}
  const mount = vi.fn()
  const playEntrance = vi.fn()
  const library = {
    EntranceAnimationType,
    LumaKeyMode,
    MediaType,
    NyxInteraction,
    ThemeName,
    NyxFission: class {
      ready = Promise.resolve()
      mount = mount
      playEntrance = playEntrance
      constructor(value: NyxFissionConfig) {
        config = value
      }
    },
  }
  const run = new Function(
    'require',
    'exports',
    'document',
    `return (async () => {\n${result.outputText}\n})()`,
  )
  await run(() => library, {}, { querySelector: () => target })
  expect(mount).toHaveBeenCalledWith(target)
  return { config, playEntrance }
}

describe('buildQuickstart', () => {
  it.each(Object.entries(NyxInteraction))(
    'exports the %s interaction settings',
    async (_member, type) => {
      const interaction = {
        type,
        radius: 150,
        strength: 0.4,
        delay: 200,
        duration: 300,
      }
      const { config } = await runExample(
        buildQuickstart(
          'image',
          '/image.png',
          0.35,
          undefined,
          undefined,
          interaction,
        ),
      )
      expect(config?.interaction).toEqual(interaction)
    },
  )

  it.each(Object.entries(EntranceAnimationType))(
    'exports a working manual example for %s',
    async (_member, type) => {
      const entrance = { type, autoStart: false, duration: 1400, delay: 250 }
      const { config, playEntrance } = await runExample(
        buildQuickstart('image', '/image.png', 0.35, undefined, entrance),
      )
      expect(config?.entrance).toEqual(entrance)
      expect(playEntrance).toHaveBeenCalledOnce()
    },
  )

  it.each([
    ['image', '/fixtures/nyx-orbit.svg', 0.35],
    ['video', 'https://example.test/field.webm', -0.5],
    ['usermedia', 'ignored', 0],
  ] as const)(
    'exports the source and depth for %s',
    async (source, sourceUrl, depth) => {
      const { config } = await runExample(
        buildQuickstart(source, sourceUrl, depth),
      )
      expect(config).toEqual({
        type: source,
        ...(source === 'usermedia' ? {} : { source: sourceUrl }),
        theme: ThemeName.Nyx,
        depth,
        lumaKey: { mode: LumaKeyMode.None, threshold: 0.1, coherence: 0 },
      })
    },
  )

  it.each(Object.values(ThemeName))(
    'includes the selected %s theme',
    async (theme) => {
      const { config } = await runExample(
        buildQuickstart(
          'image',
          '/image.png',
          0.35,
          undefined,
          undefined,
          undefined,
          theme,
        ),
      )
      expect(config?.theme).toBe(theme)
    },
  )

  it('serializes quotes, newlines, and markup in media URLs as literal data', async () => {
    const url =
      'https://example.test/media/quote\n"</code><script>alert(1)</script>.webm'
    const { config } = await runExample(buildQuickstart('video', url, 0.35))
    expect(config?.source).toBe(url)
  })

  it.each([
    [2, 1],
    [-2, -1],
    [Number.NaN, 0.35],
  ])(
    'normalizes depth %s into the demo range',
    async (depth, expectedDepth) => {
      const { config } = await runExample(
        buildQuickstart('image', '/image.png', depth),
      )
      expect(config?.depth).toBe(expectedDepth)
    },
  )

  it('keeps transient empty and negative input editable until commit', () => {
    expect(commitDemoDepth('', 0.35)).toBe(0.35)
    expect(commitDemoDepth('-', 0.35)).toBe(0.35)
    expect(commitDemoDepth('-0.5', 0.35)).toBe(-0.5)
    expect(commitDemoDepth(0.5, 0.35)).toBe(0.5)
  })

  it('exports nested luma-key settings and normalizes out-of-range values', async () => {
    const selected = {
      mode: LumaKeyMode.Dark,
      threshold: 0.25,
      coherence: 0.75,
    }
    expect(
      (await runExample(buildQuickstart('image', '/image.png', 0.35, selected)))
        .config?.lumaKey,
    ).toEqual(selected)
    expect(
      (
        await runExample(
          buildQuickstart('image', '/image.png', 0.35, {
            mode: LumaKeyMode.Light,
            threshold: 2,
            coherence: -1,
          }),
        )
      ).config?.lumaKey,
    ).toEqual({ mode: LumaKeyMode.Light, threshold: 1, coherence: 0 })
  })

  it('keeps imports, the constructor and nested options on readable lines', () => {
    const example = buildQuickstart(
      'image',
      '/image.png',
      0.35,
      undefined,
      { type: EntranceAnimationType.ScanBottomToTop },
      { type: NyxInteraction.Attract },
    )
    expect(example).toContain('new NyxFission({\n')
    expect(example).toContain('  entrance: {\n')
    expect(
      Math.max(...example.split('\n').map((line) => line.length)),
    ).toBeLessThanOrEqual(80)
  })
})
