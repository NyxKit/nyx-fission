import { describe, expect, it } from 'vitest'
import { NyxError } from '../errors'
import { inferMediaType, resolveMediaType } from '../media/type'
import { MediaType } from '../types'

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

describe('resolveMediaType', () => {
  it('prefers an explicit image type over a video URL', () => {
    expect(resolveMediaType(MediaType.Image, '/assets/clip.mp4')).toBe(MediaType.Image)
  })

  it('prefers an explicit video type over an image URL', () => {
    expect(resolveMediaType(MediaType.Video, '/assets/photo.jpg')).toBe(MediaType.Video)
  })

  it('preserves an explicit usermedia type over an image URL', () => {
    expect(resolveMediaType(MediaType.Usermedia, '/assets/photo.jpg')).toBe(MediaType.Usermedia)
  })

  it('infers the type when no explicit type is provided', () => {
    expect(resolveMediaType(undefined, '/assets/photo.webp')).toBe('image')
    expect(resolveMediaType(undefined, '/assets/clip.webm')).toBe('video')
  })
})
