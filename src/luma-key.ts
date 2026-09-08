import { NyxError } from './errors'
import {
  LumaKeyMode,
  NyxErrorStage,
  type LumaKeyConfig,
  type ResolvedLumaKeyConfig,
} from './types'

const DEFAULT_THRESHOLD = 0.1
const DEFAULT_COHERENCE = 0
const lumaKeyModes: readonly LumaKeyMode[] = Object.values(LumaKeyMode)

export function resolveLumaKeyConfig(
  config: LumaKeyConfig | undefined,
): ResolvedLumaKeyConfig {
  if (config === undefined) {
    return {
      mode: LumaKeyMode.None,
      threshold: DEFAULT_THRESHOLD,
      coherence: DEFAULT_COHERENCE,
    }
  }
  if (typeof config !== 'object' || config === null) {
    throw new NyxError(
      'Unsupported luma-key mode: undefined',
      'INVALID_CONFIG',
      NyxErrorStage.Sampling,
    )
  }
  if (!lumaKeyModes.includes(config.mode)) {
    throw new NyxError(
      `Unsupported luma-key mode: ${String(config.mode)}`,
      'INVALID_CONFIG',
      NyxErrorStage.Sampling,
    )
  }

  // Only omitted values receive defaults. Explicit null and non-finite values are invalid.
  const threshold =
    config.threshold === undefined ? DEFAULT_THRESHOLD : config.threshold
  const coherence =
    config.coherence === undefined ? DEFAULT_COHERENCE : config.coherence
  for (const [name, value] of [
    ['threshold', threshold],
    ['coherence', coherence],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new NyxError(
        `Luma-key ${name} must be finite and within 0..1`,
        'INVALID_CONFIG',
        NyxErrorStage.Sampling,
      )
    }
  }
  return { mode: config.mode, threshold, coherence }
}
