import { describe, expect, it } from 'vitest'
import { NyxError } from '../errors'
import { NyxErrorStage } from '../types'

describe('NyxError', () => {
  it('preserves its code, stage, and cause', () => {
    const cause = new Error('cors')
    const error = new NyxError(
      'Media failed to load',
      'MEDIA_CORS_FAILED',
      NyxErrorStage.Source,
      cause,
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Media failed to load')
    expect(error.code).toBe('MEDIA_CORS_FAILED')
    expect(error.stage).toBe('source')
    expect(error.cause).toBe(cause)
  })
})
