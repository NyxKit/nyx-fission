import { describe, expect, it } from 'vitest'
import { buildQuickstart } from './quickstart'

describe('buildQuickstart', () => {
  it.each([
    ['image', '/fixtures/nyx-orbit.svg', '0.35', 'type: MediaType.Image, source: "/fixtures/nyx-orbit.svg", depth: 0.35'],
    ['video', 'https://example.test/field.webm', '-0.5', 'type: MediaType.Video, source: "https://example.test/field.webm", depth: -0.5'],
    ['usermedia', 'ignored', '0', 'type: MediaType.Usermedia, depth: 0'],
  ] as const)('includes the active depth literal for %s examples', (source, sourceUrl, depth, config) => {
    expect(buildQuickstart(source, sourceUrl, Number(depth))).toContain(config)
  })

  it('builds a webcam example without a source URL', () => {
    expect(buildQuickstart('usermedia', 'ignored', 0.35)).toContain(
      'import { MediaType, NyxFission } from \'nyx-fission\'',
    )
    expect(buildQuickstart('usermedia', 'ignored', 0.35)).toContain(
      'new NyxFission({ type: MediaType.Usermedia, depth: 0.35 })',
    )
    expect(buildQuickstart('usermedia', 'ignored', 0.35)).not.toContain('source:')
  })

  it('serializes media URLs as safe TypeScript strings', () => {
    const url = 'https://example.test/media/quote\n".webm'
    const example = buildQuickstart('video', url, 0.35)

    expect(example).toContain(`type: MediaType.Video, source: ${JSON.stringify(url)}`)
    expect(example).toContain("document.querySelector<HTMLCanvasElement>('#particles-canvas')")
  })

  it('includes an explicit image type for the SVG default source', () => {
    const example = buildQuickstart('image', '/fixtures/nyx-orbit.svg', 0.35)

    expect(example).toContain('type: MediaType.Image, source: "/fixtures/nyx-orbit.svg"')
  })
})
