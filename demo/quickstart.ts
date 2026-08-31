export type QuickstartSource = 'image' | 'video' | 'usermedia'

export function buildQuickstart(source: QuickstartSource, sourceUrl: string): string {
  const typeMember = source === 'image' ? 'Image' : source === 'video' ? 'Video' : 'Usermedia'
  const sourceConfig = source === 'usermedia'
    ? 'type: MediaType.Usermedia'
    : `type: MediaType.${typeMember}, source: ${JSON.stringify(sourceUrl)}`

  return `import { MediaType, NyxFission } from 'nyx-fission'

const particles = new NyxFission({ ${sourceConfig} })
const target = document.querySelector<HTMLCanvasElement>('#particles-canvas')
if (!target) throw new Error('Expected #particles-canvas to exist')
particles.mount(target)`
}
