import { describe, expect, it } from 'vitest'
import {
  EntranceAnimationType,
  MediaType,
  NyxErrorStage,
  NyxEvent,
  NyxFission,
  NyxInteraction,
  type InteractionConfig,
  LumaKeyMode,
  ThemeName,
  type LumaKeyConfig,
  type NyxFissionConfig,
} from '../index'

describe('public string enums', () => {
  it('exposes the documented string values at runtime', () => {
    expect(MediaType).toEqual({ Image: 'image', Video: 'video', Usermedia: 'usermedia' })
    expect(ThemeName).toEqual({ Grayscale: 'grayscale', Discodip: 'discodip', Pastel: 'pastel', Nyx: 'nyx' })
    expect(NyxEvent).toEqual({ Loading: 'loading', Ready: 'ready', EntranceStart: 'entrance-start', EntranceComplete: 'entrance-complete', Error: 'error', Destroy: 'destroy' })
    expect(EntranceAnimationType).toEqual({ None: 'none', Gather: 'gather', Depth: 'depth', Fade: 'fade', Vortex: 'vortex', ScanLeftToRight: 'scan-left-to-right', ScanRightToLeft: 'scan-right-to-left', ScanTopToBottom: 'scan-top-to-bottom', ScanBottomToTop: 'scan-bottom-to-top', Scatter: 'scatter' })
    expect(NyxErrorStage).toEqual({ Target: 'target', Source: 'source', Sampling: 'sampling', Rendering: 'rendering', Lifecycle: 'lifecycle' })
    expect(LumaKeyMode).toEqual({ None: 'none', Dark: 'dark', Light: 'light' })
    expect(NyxInteraction).toEqual({ None: 'none', Attract: 'attract', Repel: 'repel', Push: 'push', Pull: 'pull' })
  })

  it('continues validating invalid runtime configuration', () => {
    expect(() => new NyxFission({ source: './portrait.jpg', type: 'audio' as MediaType })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'source' }),
    )
  })

  it('exports the nested interaction config type', () => {
    const interaction: InteractionConfig = { type: NyxInteraction.Attract, radius: 100, delay: 200, duration: 300 }
    const config: NyxFissionConfig = { source: 'image.jpg', interaction }
    expect(config.interaction).toEqual(interaction)
  })

  it('exposes signed numeric depth in the public configuration', () => {
    const lumaKey: LumaKeyConfig = { mode: LumaKeyMode.Dark, threshold: 0.1, coherence: 0.25 }
    const config: NyxFissionConfig = { source: 'image.jpg', depth: -0.5, lumaKey }

    expect(config.depth).toBe(-0.5)
    expect(config.lumaKey?.mode).toBe(LumaKeyMode.Dark)
    expect(config.lumaKey?.threshold).toBe(0.1)
    expect(config.lumaKey?.coherence).toBe(0.25)
  })
})
