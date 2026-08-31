import { NyxError } from './errors'
import { NyxErrorStage } from './types'

export const MAX_PARTICLE_DEPTH = 1_000_000

export function isValidParticleDepth(depth: number): boolean {
  return Number.isFinite(depth) && Number.isFinite(Math.fround(depth)) && Math.abs(depth) <= MAX_PARTICLE_DEPTH
}

export function validateParticleDepth(depth: number, stage: NyxErrorStage): void {
  if (!isValidParticleDepth(depth)) {
    throw new NyxError(`Particle depth must be finite and no greater than ${MAX_PARTICLE_DEPTH} in magnitude: ${String(depth)}`, 'INVALID_CONFIG', stage)
  }
}
