import { LumaKeyMode } from '../src/index'

export type QuickstartSource = 'image' | 'video' | 'usermedia'
export type QuickstartLumaKey = LumaKeyMode

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

export function buildQuickstart(source: QuickstartSource, sourceUrl: string, depth: number, lumaKey: QuickstartLumaKey = LumaKeyMode.None, lumaKeyThreshold = 0.1): string {
  const typeMember = source === 'image' ? 'Image' : source === 'video' ? 'Video' : 'Usermedia'
  const sourceConfig = source === 'usermedia'
    ? 'type: MediaType.Usermedia'
    : `type: MediaType.${typeMember}, source: ${JSON.stringify(sourceUrl)}`
  const lumaKeyMember = lumaKey === LumaKeyMode.Dark ? 'Dark' : lumaKey === LumaKeyMode.Light ? 'Light' : 'None'
  const config = `${sourceConfig}, depth: ${String(normalizeDemoDepth(depth))}, lumaKey: LumaKeyMode.${lumaKeyMember}, lumaKeyThreshold: ${String(Math.min(1, Math.max(0, lumaKeyThreshold)))}`

  return `import { LumaKeyMode, MediaType, NyxFission } from 'nyx-fission'

const particles = new NyxFission({ ${config} })
const target = document.querySelector<HTMLCanvasElement>('#particles-canvas')
if (!target) throw new Error('Expected #particles-canvas to exist')
particles.mount(target)`
}
