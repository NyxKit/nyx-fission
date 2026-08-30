export type QuickstartSource = 'image' | 'video' | 'usermedia'

export function buildQuickstart(source: QuickstartSource, sourceUrl: string): string {
  const sourceConfig = source === 'usermedia'
    ? "type: 'usermedia'"
    : `source: ${JSON.stringify(sourceUrl)}`

  return `import { NyxFission } from 'nyx-fission'

const particles = new NyxFission({ ${sourceConfig} })
const target = document.querySelector<HTMLCanvasElement>('#particles-canvas')
if (!target) throw new Error('Expected #particles-canvas to exist')
particles.mount(target)`
}
