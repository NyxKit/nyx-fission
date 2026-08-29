/* global document */

import { describe, expect, it } from 'vitest'
import { NyxError } from '../errors'
import { resolveMediaUrl } from '../media/url'

describe('resolveMediaUrl', () => {
  it('resolves relative source against the document base', () => {
    expect(resolveMediaUrl('./media/a.jpg', 'https://site.test/app/')).toBe(
      'https://site.test/app/media/a.jpg',
    )
  })

  it('resolves relative source against document.baseURI by default', () => {
    const originalBase = document.baseURI
    const base = document.createElement('base')
    base.href = 'https://site.test/media/'
    document.head.append(base)

    expect(resolveMediaUrl('clip.mp4')).toBe('https://site.test/media/clip.mp4')

    base.remove()
    expect(document.baseURI).toBe(originalBase)
  })

  it('resolves root-relative and absolute sources', () => {
    expect(resolveMediaUrl('/media/a.jpg', 'https://site.test/app/')).toBe(
      'https://site.test/media/a.jpg',
    )
    expect(resolveMediaUrl('https://cdn.test/a.jpg', 'https://site.test/app/')).toBe(
      'https://cdn.test/a.jpg',
    )
  })

  it('converts invalid source input into INVALID_CONFIG', () => {
    expect(() => resolveMediaUrl('https://[invalid')).toThrowError(NyxError)

    try {
      resolveMediaUrl('https://[invalid')
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_CONFIG', stage: 'source' })
    }
  })
})
