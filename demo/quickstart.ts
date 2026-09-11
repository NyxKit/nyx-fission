import { EntranceAnimationType, LumaKeyMode, NyxInteraction, type EntranceConfig, type InteractionConfig, type LumaKeyConfig } from '../src/index'

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

export function buildQuickstart(source: QuickstartSource, sourceUrl: string, depth: number, lumaKey: QuickstartLumaKey = { mode: LumaKeyMode.None }, entrance?: EntranceConfig, interaction?: InteractionConfig): string {
  const typeMember = source === 'image' ? 'Image' : source === 'video' ? 'Video' : 'Usermedia'
  const sourceConfig = source === 'usermedia'
    ? 'type: MediaType.Usermedia'
    : `type: MediaType.${typeMember}, source: ${JSON.stringify(sourceUrl)}`
  const threshold = Number.isFinite(lumaKey.threshold) ? Math.min(1, Math.max(0, lumaKey.threshold ?? 0.1)) : 0.1
  const coherence = Number.isFinite(lumaKey.coherence) ? Math.min(1, Math.max(0, lumaKey.coherence ?? 0)) : 0
  const mode = Object.values(LumaKeyMode).includes(lumaKey.mode) ? lumaKey.mode : LumaKeyMode.None
  const lumaKeyConfig = `{ mode: LumaKeyMode.${mode === LumaKeyMode.Dark ? 'Dark' : mode === LumaKeyMode.Light ? 'Light' : 'None'}, threshold: ${String(threshold)}, coherence: ${String(coherence)} }`
  const entranceMember = Object.entries(EntranceAnimationType).find(([, value]) => value === entrance?.type)?.[0] ?? 'None'
  const entranceConfig = entrance ? `, entrance: { type: EntranceAnimationType.${entranceMember}, autoStart: ${entrance.autoStart !== false}, duration: ${entrance.duration ?? 1000}, delay: ${entrance.delay ?? 0} }` : ''
  const interactionMember = Object.entries(NyxInteraction).find(([, value]) => value === interaction?.type)?.[0] ?? 'None'
  const interactionConfig = interaction ? `, interaction: { type: NyxInteraction.${interactionMember}, radius: ${interaction.radius ?? 100}, strength: ${interaction.strength ?? 1}, delay: ${interaction.delay ?? 0}, duration: ${interaction.duration ?? 300} }` : ''
  const config = `${sourceConfig}, depth: ${String(normalizeDemoDepth(depth))}, lumaKey: ${lumaKeyConfig}${entranceConfig}${interactionConfig}`

  return `import { ${entrance ? 'EntranceAnimationType, ' : ''}${interaction ? 'NyxInteraction, ' : ''}LumaKeyMode, MediaType, NyxFission } from 'nyx-fission'

const particles = new NyxFission({ ${config} })
const target = document.querySelector<HTMLCanvasElement>('#particles-canvas')
if (!target) throw new Error('Expected #particles-canvas to exist')
particles.mount(target)${entrance?.autoStart === false ? '\nawait particles.ready\n\n// Call from your button handler or section-visibility callback:\nawait particles.playEntrance()' : ''}`
}
