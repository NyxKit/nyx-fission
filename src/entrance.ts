/* global Document, MediaQueryList, window, document */

import { NyxError } from './errors'
import {
  EntranceAnimationType,
  NyxErrorStage,
  type EntranceConfig,
  type EntranceEvent,
} from './types'

export function resolveEntranceConfig(
  config: EntranceConfig = {},
): Required<EntranceConfig> {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw invalidConfig()
  }
  const resolved = {
    type: config.type === undefined ? EntranceAnimationType.None : config.type,
    autoStart: config.autoStart === undefined ? true : config.autoStart,
    duration: config.duration === undefined ? 1000 : config.duration,
    delay: config.delay === undefined ? 0 : config.delay,
  }
  if (
    !Object.values(EntranceAnimationType).includes(resolved.type) ||
    typeof resolved.autoStart !== 'boolean' ||
    !Number.isFinite(resolved.duration) ||
    resolved.duration < 0 ||
    !Number.isFinite(resolved.delay) ||
    resolved.delay < 0 ||
    !Number.isFinite(resolved.duration + resolved.delay)
  ) {
    throw invalidConfig()
  }
  return resolved
}

function invalidConfig(): NyxError {
  return new NyxError(
    'Invalid entrance configuration: use a supported type, boolean autoStart, and finite nonnegative duration/delay in milliseconds',
    'INVALID_CONFIG',
    NyxErrorStage.Rendering,
  )
}

interface Run {
  promise: Promise<void>
  resolve: () => void
  reject: (_error: unknown) => void
  elapsed: number
  started: boolean
  animated: boolean
}

/** One entrance clock, advanced by the renderer and completed only after a draw. */
export class EntranceController {
  readonly config: Required<EntranceConfig>
  visible: boolean
  progress = 1
  private run: Run | undefined
  private failure: unknown
  private cancelled = false
  private initialized = false
  private lastTime: number | undefined
  private ownerDocument: Document | undefined
  private motionQuery: MediaQueryList | undefined
  private reduceMotion = false
  private onStart: ((_event: EntranceEvent) => void) | undefined
  private onComplete: ((_event: EntranceEvent) => void) | undefined

  constructor(
    config?: EntranceConfig,
    onStart?: (_event: EntranceEvent) => void,
    onComplete?: (_event: EntranceEvent) => void,
  ) {
    this.config = resolveEntranceConfig(config)
    this.visible =
      this.config.autoStart && this.config.type === EntranceAnimationType.None
    this.onStart = onStart
    this.onComplete = onComplete
  }

  connect(ownerDocument: Document = document): void {
    this.disconnect()
    this.ownerDocument = ownerDocument
    const view =
      ownerDocument.defaultView ??
      (typeof window === 'undefined' ? undefined : window)
    this.motionQuery = view?.matchMedia?.('(prefers-reduced-motion: reduce)')
    this.reduceMotion = this.motionQuery?.matches ?? false
    ownerDocument.addEventListener('visibilitychange', this.resetClock)
    this.motionQuery?.addEventListener('change', this.updateMotion)
  }

  disconnect(): void {
    this.ownerDocument?.removeEventListener('visibilitychange', this.resetClock)
    this.motionQuery?.removeEventListener('change', this.updateMotion)
    this.ownerDocument = undefined
    this.motionQuery = undefined
    this.lastTime = undefined
  }

  private resetClock = (): void => {
    this.lastTime = undefined
  }
  private updateMotion = (): void => {
    this.reduceMotion = this.motionQuery?.matches ?? false
  }

  ready(): void {
    this.initialized = true
    if (
      this.config.autoStart &&
      this.config.type !== EntranceAnimationType.None &&
      !this.cancelled
    ) {
      void this.play().catch(() => undefined)
    }
  }

  play(): Promise<void> {
    if (this.cancelled) return Promise.reject(this.failure)
    if (this.run) return this.run.promise
    if (
      this.initialized &&
      this.config.type === EntranceAnimationType.None &&
      this.visible
    ) {
      return Promise.resolve()
    }
    let resolve!: () => void
    let reject!: (_error: unknown) => void
    const promise = new Promise<void>((yes, no) => {
      resolve = yes
      reject = no
    })
    // A queued request may outlive the consumer during loading/unmounting.
    void promise.catch(() => undefined)
    this.run = {
      promise,
      resolve,
      reject,
      elapsed: 0,
      started: false,
      animated: false,
    }
    this.visible = false
    this.progress = 0
    this.lastTime = undefined
    return promise
  }

  /** The returned identity prevents callbacks from completing a newer run. */
  advance(time: number): object | undefined {
    const run = this.run
    if (!run || this.cancelled) return undefined
    if (this.ownerDocument?.hidden) {
      this.lastTime = undefined
      return undefined
    }
    if (this.lastTime !== undefined) {
      run.elapsed += Math.max(0, time - this.lastTime)
    }
    this.lastTime = time
    const immediate =
      this.reduceMotion || this.config.type === EntranceAnimationType.None
    const delay = immediate ? 0 : this.config.delay
    if (run.elapsed < delay) return undefined
    this.visible = true
    this.progress =
      immediate || this.config.duration === 0
        ? 1
        : Math.min(1, (run.elapsed - delay) / this.config.duration)
    if (!run.started) {
      run.started = true
      run.animated = !immediate && this.config.duration > 0
      this.onStart?.({ type: this.config.type, animated: run.animated })
    }
    return this.run === run && !this.cancelled ? run : undefined
  }

  afterRender(token: object | undefined): void {
    const run = this.run
    if (!run || token !== run || this.progress < 1 || this.cancelled) return
    this.run = undefined
    this.lastTime = undefined
    run.resolve()
    this.onComplete?.({ type: this.config.type, animated: run.animated })
  }

  cancel(error: unknown): void {
    if (this.cancelled) return
    this.cancelled = true
    this.failure = error
    const run = this.run
    this.run = undefined
    this.disconnect()
    this.onStart = undefined
    this.onComplete = undefined
    run?.reject(error)
  }
}
