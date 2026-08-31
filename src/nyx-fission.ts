/* global HTMLCanvasElement, queueMicrotask, AbortController */

import { NyxEventEmitter } from './events'
import { NyxError } from './errors'
import { FrameSampler } from './frame-sampler'
import { loadMediaSource, type LoadedSource } from './media/source'
import { resolveMediaType } from './media/type'
import { resolveMediaUrl } from './media/url'
import { createParticleField, updateParticleField, type ParticleField } from './particles'
import { ThreeRuntime } from './runtime'
import { resolveCanvas, validateCanvas, type TargetResolution } from './target'
import { resolveTheme } from './themes'
import { MediaType, NyxErrorStage, ThemeName, type NyxEventMap, type NyxFissionConfig } from './types'

type State = 'created' | 'loading' | 'ready' | 'failed' | 'destroyed'
const DYNAMIC_SAMPLE_INTERVAL_MS = 1000 / 30
const mediaTypes: readonly MediaType[] = Object.values(MediaType)
const themeNames: readonly ThemeName[] = Object.values(ThemeName)

function validateConfig(config: NyxFissionConfig): void {
  if (config.type !== undefined && !mediaTypes.includes(config.type)) {
    throw new NyxError(`Unsupported media type: ${String(config.type)}`, 'INVALID_CONFIG', NyxErrorStage.Source)
  }
  if (config.theme !== undefined && !themeNames.includes(config.theme)) {
    throw new NyxError(`Unsupported particle theme: ${String(config.theme)}`, 'INVALID_CONFIG', NyxErrorStage.Sampling)
  }
  if (config.type !== MediaType.Usermedia && !config.source) {
    throw new NyxError('A media source is required', 'INVALID_CONFIG', NyxErrorStage.Source)
  }
}

function lifecycleError(message: string, cause?: unknown): NyxError {
  return new NyxError(message, 'DESTROYED', NyxErrorStage.Lifecycle, cause)
}

function asNyxError(error: unknown, stage: NyxErrorStage.Target | NyxErrorStage.Source | NyxErrorStage.Sampling | NyxErrorStage.Rendering): NyxError {
  if (error instanceof NyxError) return error
  return new NyxError('NyxFission could not initialize', 'MEDIA_LOAD_FAILED', stage, error)
}

export class NyxFission {
  readonly ready: Promise<void>

  private readonly config: NyxFissionConfig
  private readonly events = new NyxEventEmitter<NyxEventMap>()
  private readonly resolveReady: () => void
  private readonly rejectReady: (_error: NyxError) => void
  private readonly loadingReady: Promise<void>
  private state: State = 'created'
  private target: HTMLCanvasElement | undefined
  private targetResolution: TargetResolution | undefined
  private mountRequested = false
  private loadController: AbortController | undefined
  private source: LoadedSource | undefined
  private sampler: FrameSampler | undefined
  private field: ParticleField | undefined
  private runtime: ThreeRuntime | undefined
  private frameWidth = 0
  private frameHeight = 0
  private lastDynamicSampleTime = Number.NEGATIVE_INFINITY
  private errorEmitted = false
  private destroyEmitted = false
  private failureError: NyxError | undefined

  constructor(config: NyxFissionConfig = {}) {
    this.config = { ...config }
    validateConfig(this.config)

    let resolveReady!: () => void
    let rejectReady!: (_error: NyxError) => void
    this.ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    this.resolveReady = resolveReady
    this.rejectReady = rejectReady
    this.loadingReady = new Promise<void>((resolve) => {
      queueMicrotask(() => {
        if (this.state !== 'destroyed') this.events.emit('loading', undefined)
        resolve()
      })
    })
    void this.ready.catch(() => undefined)

    if (this.config.querySelector !== undefined) {
      void this.loadingReady.then(() => this.startAutomaticTargetResolution())
    }
  }

  mount(canvas: HTMLCanvasElement): void {
    if (this.state === 'destroyed') throw lifecycleError('NyxFission has been destroyed')
    if (this.state === 'failed') throw this.failureError
    if (this.target !== undefined || this.mountRequested) {
      throw new NyxError('NyxFission can only be mounted once', 'INVALID_TARGET', NyxErrorStage.Lifecycle)
    }

    this.mountRequested = true
    this.targetResolution?.cancel()
    this.targetResolution = undefined
    void this.loadingReady.then(() => {
      if (this.state === 'destroyed' || this.state === 'failed') return
      try {
        this.initialise(validateCanvas(canvas))
      } catch (error) {
        this.fail(asNyxError(error, NyxErrorStage.Target))
      }
    })
  }

  on<K extends keyof NyxEventMap>(event: K, listener: (_value: NyxEventMap[K]) => void): void {
    this.events.on(event, listener)
  }

  off<K extends keyof NyxEventMap>(event: K, listener: (_value: NyxEventMap[K]) => void): void {
    this.events.off(event, listener)
  }

  destroy(): void {
    if (this.state === 'destroyed') return
    this.state = 'destroyed'
    this.targetResolution?.cancel()
    this.targetResolution = undefined
    this.loadController?.abort()
    this.loadController = undefined
    this.runtime?.dispose()
    this.sampler?.dispose()
    this.source?.dispose()
    this.runtime = undefined
    this.sampler = undefined
    this.source = undefined
    this.field = undefined
    this.target = undefined
    this.rejectReady(lifecycleError('NyxFission has been destroyed'))
    if (!this.destroyEmitted) {
      this.destroyEmitted = true
      this.events.emit('destroy', undefined)
    }
    this.events.clear()
  }

  private initialise(canvas: HTMLCanvasElement): void {
    if (this.state === 'destroyed' || this.state === 'failed') return
    if (this.target !== undefined) return
    this.target = canvas
    void this.loadingReady.then(() => {
      if (this.state === 'destroyed' || this.state === 'failed') return
      this.state = 'loading'
      void this.load(canvas)
    })
  }

  private startAutomaticTargetResolution(): void {
    if (this.state === 'destroyed' || this.state === 'failed' || this.mountRequested) return
    const targetResolution = resolveCanvas(this.config)
    this.targetResolution = targetResolution
    targetResolution.promise.then(
      (canvas) => {
        if (this.targetResolution === targetResolution) this.initialise(canvas)
      },
      (error: unknown) => {
        if (this.targetResolution === targetResolution) this.fail(asNyxError(error, NyxErrorStage.Target))
      },
    )
  }

  private async load(canvas: HTMLCanvasElement): Promise<void> {
    const loadController = new AbortController()
    this.loadController = loadController
    try {
      const sourceUrl = this.config.source ? resolveMediaUrl(this.config.source) : ''
      const type = resolveMediaType(this.config.type, sourceUrl)
      const source = await loadMediaSource(this.config.source, type, loadController.signal)
      if (this.state === 'destroyed') {
        source.dispose()
        return
      }
      this.source = source
      this.sampler = new FrameSampler(source)
      this.renderFirstFrame(canvas)
      this.runtime?.start((time) => this.renderFrame(time))
      this.state = 'ready'
      this.resolveReady()
      this.events.emit('ready', undefined)
    } catch (error) {
      this.fail(asNyxError(error, this.stageFor(error)))
    } finally {
      if (this.loadController === loadController) this.loadController = undefined
    }
  }

  private renderFirstFrame(canvas: HTMLCanvasElement): void {
    const sampler = this.sampler
    if (!sampler) throw new NyxError('Frame sampler is unavailable', 'MEDIA_LOAD_FAILED', NyxErrorStage.Sampling)
    const frame = sampler.sample()
    this.frameWidth = frame.width
    this.frameHeight = frame.height
     this.field = createParticleField(frame, resolveTheme(this.config.theme ?? ThemeName.Nyx))
    this.runtime = new ThreeRuntime(canvas, this.field, (error) => this.handleRuntimeError(error))
  }

  private renderFrame(time = 0): void {
    try {
      const sampler = this.sampler
      const runtime = this.runtime
      const source = this.source
      if (!sampler || !runtime || !this.field || !source) return
      if (source.kind === 'image') return
      if (time - this.lastDynamicSampleTime < DYNAMIC_SAMPLE_INTERVAL_MS) return
      this.lastDynamicSampleTime = time
      const frame = sampler.sample()
      if (frame.width !== this.frameWidth || frame.height !== this.frameHeight) {
        this.frameWidth = frame.width
        this.frameHeight = frame.height
         this.field = createParticleField(frame, resolveTheme(this.config.theme ?? ThemeName.Nyx))
        runtime.setField(this.field)
      } else {
        updateParticleField(this.field, frame)
        runtime.setField(this.field)
      }
    } catch (error) {
      this.fail(asNyxError(error, NyxErrorStage.Sampling))
    }
  }

  private stageFor(error: unknown): NyxErrorStage.Target | NyxErrorStage.Source | NyxErrorStage.Sampling | NyxErrorStage.Rendering {
    if (error instanceof NyxError) return error.stage === NyxErrorStage.Target || error.stage === NyxErrorStage.Source || error.stage === NyxErrorStage.Sampling || error.stage === NyxErrorStage.Rendering ? error.stage : NyxErrorStage.Source
    return this.sampler ? NyxErrorStage.Sampling : NyxErrorStage.Source
  }

  private handleRuntimeError(error: unknown): void {
    this.fail(asNyxError(error, NyxErrorStage.Rendering))
  }

  private fail(error: NyxError): void {
    if (this.state === 'destroyed' || this.state === 'failed') return
    this.state = 'failed'
    this.failureError = error
    this.targetResolution?.cancel()
    this.targetResolution = undefined
    this.loadController?.abort()
    this.loadController = undefined
    this.runtime?.dispose()
    this.sampler?.dispose()
    this.source?.dispose()
    this.runtime = undefined
    this.sampler = undefined
    this.source = undefined
    this.field = undefined
    this.target = undefined
    this.rejectReady(error)
    if (!this.errorEmitted) {
      this.errorEmitted = true
      this.events.emit('error', { error, stage: error.stage })
    }
  }
}
