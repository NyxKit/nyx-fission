import { describe, expect, it } from 'vitest'
import { buildQuickstart } from './quickstart'

describe('buildQuickstart', () => {
  it('builds a webcam example without a source URL', () => {
    expect(buildQuickstart('usermedia', 'ignored')).toContain(
      'import { MediaType, NyxFission } from \'nyx-fission\'',
    )
    expect(buildQuickstart('usermedia', 'ignored')).toContain(
      'new NyxFission({ type: MediaType.Usermedia })',
    )
    expect(buildQuickstart('usermedia', 'ignored')).not.toContain('source:')
  })

  it('serializes media URLs as safe TypeScript strings', () => {
    const url = 'https://example.test/media/quote\n".webm'
    const example = buildQuickstart('video', url)

    expect(example).toContain(`type: MediaType.Video, source: ${JSON.stringify(url)}`)
    expect(example).toContain("document.querySelector<HTMLCanvasElement>('#particles-canvas')")
  })

  it('includes an explicit image type for the SVG default source', () => {
    const example = buildQuickstart('image', '/fixtures/nyx-orbit.svg')

    expect(example).toContain('type: MediaType.Image, source: "/fixtures/nyx-orbit.svg"')
  })
})
