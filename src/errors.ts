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

export type NyxErrorStage =
  | 'target'
  | 'source'
  | 'sampling'
  | 'rendering'
  | 'lifecycle'

export class NyxError extends Error {
  constructor(
    message: string,
    public readonly code: NyxErrorCode,
    public readonly stage: NyxErrorStage,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'NyxError'
  }
}
