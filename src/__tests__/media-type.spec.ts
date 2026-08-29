import { describe, expect, it } from 'vitest'
import { NyxError } from '../errors'
import { inferMediaType } from '../media/type'

describe('inferMediaType', () => {
  it.each(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'])(
    'infers %s as image',
    (extension) => {
      expect(inferMediaType(`/assets/photo.${extension}`)).toBe('image')
    },
  )

  it.each(['mp4', 'webm', 'ogg', 'mov', 'm4v'])(
    'infers %s as video',
    (extension) => {
      expect(inferMediaType(`/assets/clip.${extension}`)).toBe('video')
    },
  )

  it('infers formats case-insensitively and accepts query strings', () => {
    expect(inferMediaType('https://cdn.test/LOOP.MP4?cache=1')).toBe('video')
    expect(inferMediaType('/assets/photo.webp')).toBe('image')
  })

  it('rejects unsupported extensions with MEDIA_TYPE_UNKNOWN', () => {
    expect(() => inferMediaType('/assets/file.pdf')).toThrowError(NyxError)

    try {
      inferMediaType('/assets/file.pdf')
    } catch (error) {
      expect(error).toMatchObject({ code: 'MEDIA_TYPE_UNKNOWN', stage: 'source' })
    }
  })

  it('rejects invalid URLs with MEDIA_TYPE_UNKNOWN', () => {
    expect(() => inferMediaType('%%%')).toThrowError(NyxError)
  })
})
