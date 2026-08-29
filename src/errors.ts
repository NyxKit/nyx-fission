import type { NyxErrorStage } from './types'

export type { NyxErrorStage } from './types'

export type NyxErrorCode =
  | 'INVALID_CONFIG'
  | 'INVALID_TARGET'
  | 'TARGET_NOT_FOUND'
  | 'MEDIA_LOAD_FAILED'
  | 'MEDIA_TYPE_UNKNOWN'
  | 'MEDIA_CORS_FAILED'
  | 'WEBCAM_PERMISSION_DENIED'
  | 'RENDERER_UNAVAILABLE'
  | 'DESTROYED'

export class NyxError extends Error {
  readonly code: NyxErrorCode
  readonly stage: NyxErrorStage
  readonly cause?: unknown

  constructor(
    message: string,
    code: NyxErrorCode,
    stage: NyxErrorStage,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'NyxError'
    this.code = code
    this.stage = stage
    this.cause = cause
  }
}
