import { LumaKeyMode, type LumaKeyConfig } from '../src/index'

export type QuickstartSource = 'image' | 'video' | 'usermedia'
export type QuickstartLumaKey = LumaKeyConfig

export const DEMO_DEPTH_DEFAULT = 0.35
export const DEMO_DEPTH_MIN = -1
export const DEMO_DEPTH_MAX = 1

export function normalizeDemoDepth(depth: number): number {
  if (!Number.isFinite(depth)) return DEMO_DEPTH_DEFAULT
  return Math.min(DEMO_DEPTH_MAX, Math.max(DEMO_DEPTH_MIN, depth))
}

export function commitDemoDepth(input: string | number, currentDepth: number): number {
  const normalizedInput = String(input).trim()
  if (!normalizedInput || normalizedInput === '-') return currentDepth
  const nextDepth = Number(normalizedInput)
  return Number.isFinite(nextDepth) ? normalizeDemoDepth(nextDepth) : currentDepth
}

export function buildQuickstart(source: QuickstartSource, sourceUrl: string, depth: number, lumaKey: QuickstartLumaKey = { mode: LumaKeyMode.None }): string {
  const typeMember = source === 'image' ? 'Image' : source === 'video' ? 'Video' : 'Usermedia'
  const sourceConfig = source === 'usermedia'
    ? 'type: MediaType.Usermedia'
    : `type: MediaType.${typeMember}, source: ${JSON.stringify(sourceUrl)}`
  const threshold = Number.isFinite(lumaKey.threshold) ? Math.min(1, Math.max(0, lumaKey.threshold ?? 0.1)) : 0.1
  const coherence = Number.isFinite(lumaKey.coherence) ? Math.min(1, Math.max(0, lumaKey.coherence ?? 0)) : 0
  const mode = Object.values(LumaKeyMode).includes(lumaKey.mode) ? lumaKey.mode : LumaKeyMode.None
  const lumaKeyConfig = `{ mode: LumaKeyMode.${mode === LumaKeyMode.Dark ? 'Dark' : mode === LumaKeyMode.Light ? 'Light' : 'None'}, threshold: ${String(threshold)}, coherence: ${String(coherence)} }`
  const config = `${sourceConfig}, depth: ${String(normalizeDemoDepth(depth))}, lumaKey: ${lumaKeyConfig}`

  return `import { LumaKeyMode, MediaType, NyxFission } from 'nyx-fission'

const particles = new NyxFission({ ${config} })
const target = document.querySelector<HTMLCanvasElement>('#particles-canvas')
if (!target) throw new Error('Expected #particles-canvas to exist')
particles.mount(target)`
}
