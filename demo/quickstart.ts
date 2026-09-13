import {
  EntranceAnimationType,
  LumaKeyMode,
  NyxInteraction,
  ThemeName,
  type EntranceConfig,
  type InteractionConfig,
  type LumaKeyConfig,
} from '../src/index'

export type QuickstartSource = 'image' | 'video' | 'usermedia'
export type QuickstartLumaKey = LumaKeyConfig

export const DEMO_DEPTH_DEFAULT = 0.35
export const DEMO_DEPTH_MIN = -1
export const DEMO_DEPTH_MAX = 1

export function normalizeDemoDepth(depth: number): number {
  if (!Number.isFinite(depth)) return DEMO_DEPTH_DEFAULT
  return Math.min(DEMO_DEPTH_MAX, Math.max(DEMO_DEPTH_MIN, depth))
}

export function commitDemoDepth(
  input: string | number,
  currentDepth: number,
): number {
  const normalizedInput = String(input).trim()
  if (!normalizedInput || normalizedInput === '-') return currentDepth
  const nextDepth = Number(normalizedInput)
  return Number.isFinite(nextDepth)
    ? normalizeDemoDepth(nextDepth)
    : currentDepth
}

export function buildQuickstart(
  source: QuickstartSource,
  sourceUrl: string,
  depth: number,
  lumaKey: QuickstartLumaKey = { mode: LumaKeyMode.None },
  entrance?: EntranceConfig,
  interaction?: InteractionConfig,
  theme: ThemeName = ThemeName.Nyx,
): string {
  const typeMember =
    source === 'image' ? 'Image' : source === 'video' ? 'Video' : 'Usermedia'
  const threshold = Number.isFinite(lumaKey.threshold)
    ? Math.min(1, Math.max(0, lumaKey.threshold ?? 0.1))
    : 0.1
  const coherence = Number.isFinite(lumaKey.coherence)
    ? Math.min(1, Math.max(0, lumaKey.coherence ?? 0))
    : 0
  const mode = Object.values(LumaKeyMode).includes(lumaKey.mode)
    ? lumaKey.mode
    : LumaKeyMode.None
  const modeMember =
    mode === LumaKeyMode.Dark
      ? 'Dark'
      : mode === LumaKeyMode.Light
        ? 'Light'
        : 'None'
  const themeMember =
    Object.entries(ThemeName).find(([, value]) => value === theme)?.[0] ?? 'Nyx'
  const entranceMember =
    Object.entries(EntranceAnimationType).find(
      ([, value]) => value === entrance?.type,
    )?.[0] ?? 'None'
  const interactionMember =
    Object.entries(NyxInteraction).find(
      ([, value]) => value === interaction?.type,
    )?.[0] ?? 'None'
  const imports = [
    ...(entrance ? ['EntranceAnimationType'] : []),
    ...(interaction ? ['NyxInteraction'] : []),
    'LumaKeyMode',
    'MediaType',
    'NyxFission',
    'ThemeName',
  ]
  const config = [
    `  type: MediaType.${typeMember},`,
    ...(source === 'usermedia'
      ? []
      : [`  source: ${JSON.stringify(sourceUrl)},`]),
    `  theme: ThemeName.${themeMember},`,
    `  depth: ${normalizeDemoDepth(depth)},`,
    '  lumaKey: {',
    `    mode: LumaKeyMode.${modeMember},`,
    `    threshold: ${threshold},`,
    `    coherence: ${coherence},`,
    '  },',
    ...(entrance
      ? [
          '  entrance: {',
          `    type: EntranceAnimationType.${entranceMember},`,
          `    autoStart: ${entrance.autoStart !== false},`,
          `    duration: ${entrance.duration ?? 1000},`,
          `    delay: ${entrance.delay ?? 0},`,
          '  },',
        ]
      : []),
    ...(interaction
      ? [
          '  interaction: {',
          `    type: NyxInteraction.${interactionMember},`,
          `    radius: ${interaction.radius ?? 100},`,
          `    strength: ${interaction.strength ?? 1},`,
          `    delay: ${interaction.delay ?? 0},`,
          `    duration: ${interaction.duration ?? 300},`,
          '  },',
        ]
      : []),
  ]

  return [
    'import {',
    ...imports.map((name) => `  ${name},`),
    "} from 'nyx-fission'",
    '',
    'const particles = new NyxFission({',
    ...config,
    '})',
    '',
    'const target = document.querySelector<HTMLCanvasElement>(',
    "  '#particles-canvas',",
    ')',
    "if (!target) throw new Error('Expected #particles-canvas to exist')",
    '',
    'particles.mount(target)',
    ...(entrance?.autoStart === false
      ? [
          'await particles.ready',
          '',
          '// Call from your button handler or section-visibility callback:',
          'await particles.playEntrance()',
        ]
      : []),
  ].join('\n')
}
