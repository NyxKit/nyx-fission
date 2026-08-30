/* global document, HTMLCanvasElement, CanvasRenderingContext2D, ImageData, DOMException */

import { NyxError } from './errors'
import type { LoadedSource } from './media/source'

// Keep pixel and downstream particle allocations bounded for high-resolution media.
const MAX_WORKING_DIMENSION = 720

export class FrameSampler {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private disposed = false

  private readonly source: LoadedSource

  constructor(source: LoadedSource) {
    this.source = source
    this.canvas = document.createElement('canvas')
    const context = this.canvas.getContext('2d')
    if (!context) {
      throw new NyxError(
        'Could not create a 2D sampling context',
        'MEDIA_LOAD_FAILED',
        'sampling',
      )
    }
    this.context = context
  }

  sample(): ImageData {
    if (this.disposed) {
      throw new NyxError(
        'Frame sampler has been disposed',
        'DESTROYED',
        'sampling',
      )
    }

    const scale = Math.min(
      1,
      MAX_WORKING_DIMENSION / Math.max(this.source.width, this.source.height),
    )
    const width = Math.max(1, Math.round(this.source.width * scale))
    const height = Math.max(1, Math.round(this.source.height * scale))
    if (this.width !== width || this.height !== height) {
      this.width = width
      this.height = height
      this.canvas.width = this.width
      this.canvas.height = this.height
    }

    try {
      this.context.drawImage(
        this.source.getFrameSource(),
        0,
        0,
        this.width,
        this.height,
      )
      return this.context.getImageData(0, 0, this.width, this.height)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'SecurityError') {
        throw new NyxError(
          'Media pixels are blocked by cross-origin policy',
          'MEDIA_CORS_FAILED',
          'sampling',
          cause,
        )
      }
      throw cause
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.canvas.width = 0
    this.canvas.height = 0
  }
}
