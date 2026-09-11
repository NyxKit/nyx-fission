/* global document, HTMLCanvasElement, CanvasRenderingContext2D, ImageData, DOMException */

import { NyxError } from './errors'
import { NyxErrorStage } from './types'
import type { LoadedSource } from './media/source'

// Keep pixel and downstream particle allocations bounded for high-resolution media.
const MAX_WORKING_DIMENSION = 720

function workingDimensions(width: number, height: number): [number, number] {
  const sourceMax = Math.max(width, height)
  if (sourceMax <= MAX_WORKING_DIMENSION) {
    return [Math.max(1, width), Math.max(1, height)]
  }

  const scale = MAX_WORKING_DIMENSION / sourceMax
  if (width >= height) {
    return [MAX_WORKING_DIMENSION, Math.max(1, Math.round(height * scale))]
  }
  return [Math.max(1, Math.round(width * scale)), MAX_WORKING_DIMENSION]
}

export class FrameSampler {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private disposed = false

  private readonly source: LoadedSource
  private readonly mirror: boolean

  constructor(source: LoadedSource, mirror = false) {
    this.source = source
    this.mirror = mirror
    this.canvas = document.createElement('canvas')
    const context = this.canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new NyxError(
        'Could not create a 2D sampling context',
        'MEDIA_LOAD_FAILED',
         NyxErrorStage.Sampling,
      )
    }
    this.context = context
  }

  sample(): ImageData {
    if (this.disposed) {
      throw new NyxError(
        'Frame sampler has been disposed',
        'DESTROYED',
         NyxErrorStage.Sampling,
      )
    }

    const [width, height] = workingDimensions(this.source.width, this.source.height)
    if (this.width !== width || this.height !== height) {
      this.width = width
      this.height = height
      this.canvas.width = this.width
      this.canvas.height = this.height
    }

    try {
      const source = this.source.getFrameSource()
      if (!this.mirror) {
        this.context.drawImage(source, 0, 0, this.width, this.height)
      } else {
        this.context.save()
        try {
          this.context.translate(this.width, 0)
          this.context.scale(-1, 1)
          this.context.drawImage(source, 0, 0, this.width, this.height)
        } finally {
          this.context.restore()
        }
      }
      // getImageData() has no destination-buffer argument; bounded allocation per dynamic frame is required.
      return this.context.getImageData(0, 0, this.width, this.height)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'SecurityError') {
        throw new NyxError(
          'Media pixels are blocked by cross-origin policy',
          'MEDIA_CORS_FAILED',
           NyxErrorStage.Sampling,
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
