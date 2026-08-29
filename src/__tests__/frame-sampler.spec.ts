/* global document, ImageData, HTMLElement, HTMLImageElement, DOMException, HTMLVideoElement */

import { describe, expect, it, vi } from 'vitest'
import { NyxError } from '../errors'
import { FrameSampler } from '../frame-sampler'

describe('FrameSampler', () => {
  it('draws the current source and returns the complete image data', () => {
    const imageData = { data: new Uint8ClampedArray(8), width: 2, height: 1 } as ImageData
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => imageData),
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    }
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      canvas as unknown as HTMLElement,
    )
    const source = {
      kind: 'image' as const,
      element: {} as HTMLImageElement,
      width: 2,
      height: 1,
      getFrameSource: () => source.element,
      dispose: vi.fn(),
    }

    const sampler = new FrameSampler(source)

    expect(sampler.sample()).toBe(imageData)
    expect(sampler.sample()).toBe(imageData)
    expect(canvas.width).toBe(2)
    expect(canvas.height).toBe(1)
    expect(context.drawImage).toHaveBeenCalledTimes(2)
    expect(context.drawImage).toHaveBeenCalledWith(source.element, 0, 0, 2, 1)
    expect(context.getImageData).toHaveBeenCalledWith(0, 0, 2, 1)
    expect(document.createElement).toHaveBeenCalledOnce()
  })

  it('maps canvas security errors to MEDIA_CORS_FAILED', () => {
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => {
        throw new DOMException('tainted', 'SecurityError')
      }),
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    }
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      canvas as unknown as HTMLElement,
    )
    const source = {
      kind: 'video' as const,
      element: {} as HTMLVideoElement,
      width: 1,
      height: 1,
      getFrameSource: () => source.element,
      dispose: vi.fn(),
    }

    const sampler = new FrameSampler(source)

    expect(() => sampler.sample()).toThrowError(
      expect.objectContaining({ code: 'MEDIA_CORS_FAILED', stage: 'sampling' }),
    )
  })

  it('rejects sampling after disposal with a typed terminal error', () => {
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(),
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    }
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      canvas as unknown as HTMLElement,
    )
    const source = {
      kind: 'image' as const,
      element: {} as HTMLImageElement,
      width: 1,
      height: 1,
      getFrameSource: () => source.element,
      dispose: vi.fn(),
    }
    const sampler = new FrameSampler(source)
    sampler.dispose()

    expect(() => sampler.sample()).toThrowError(NyxError)
    expect(() => sampler.sample()).toThrowError(
      expect.objectContaining({ code: 'DESTROYED', stage: 'sampling' }),
    )
    expect(context.drawImage).not.toHaveBeenCalled()
  })
})
