import { describe, expect, it } from 'vitest'
import {
  MediaType,
  NyxErrorStage,
  NyxEvent,
  NyxFission,
  LumaKey,
  ThemeName,
  type NyxFissionConfig,
} from '../index'

describe('public string enums', () => {
  it('exposes the documented string values at runtime', () => {
    expect(MediaType).toEqual({ Image: 'image', Video: 'video', Usermedia: 'usermedia' })
    expect(ThemeName).toEqual({ Grayscale: 'grayscale', Discodip: 'discodip', Pastel: 'pastel', Nyx: 'nyx' })
    expect(NyxEvent).toEqual({ Loading: 'loading', Ready: 'ready', Error: 'error', Destroy: 'destroy' })
    expect(NyxErrorStage).toEqual({ Target: 'target', Source: 'source', Sampling: 'sampling', Rendering: 'rendering', Lifecycle: 'lifecycle' })
    expect(LumaKey).toEqual({ None: 'none', Dark: 'dark', Light: 'light' })
  })

  it('continues validating invalid runtime configuration', () => {
    expect(() => new NyxFission({ source: './portrait.jpg', type: 'audio' as MediaType })).toThrowError(
      expect.objectContaining({ code: 'INVALID_CONFIG', stage: 'source' }),
    )
  })

  it('exposes signed numeric depth in the public configuration', () => {
    const config: NyxFissionConfig = { source: 'image.jpg', depth: -0.5, lumaKey: LumaKey.Dark, lumaKeyThreshold: 0.1 }

    expect(config.depth).toBe(-0.5)
    expect(config.lumaKey).toBe(LumaKey.Dark)
    expect(config.lumaKeyThreshold).toBe(0.1)
  })
})
