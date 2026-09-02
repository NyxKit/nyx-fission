/* global window, HTMLCanvasElement */

export interface HeroPreviewInstance {
  readonly ready: Promise<unknown>
  mount(_target: HTMLCanvasElement): void
  destroy(): void
}

interface HeroPreviewLifecycleOptions {
  target: HTMLCanvasElement | null
  create: () => HeroPreviewInstance
  prefersReducedMotion?: () => boolean
  onInstanceChange?: (_instance: HeroPreviewInstance | null) => void
}

export function createHeroPreviewLifecycle({
  target,
  create,
  prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  onInstanceChange,
}: HeroPreviewLifecycleOptions) {
  let current: HeroPreviewInstance | null = null

  const setCurrent = (instance: HeroPreviewInstance | null) => {
    current = instance
    onInstanceChange?.(instance)
  }

  const mount = () => {
    if (!target || prefersReducedMotion() || current) return

    let nextInstance: HeroPreviewInstance | null = null
    try {
      const createdInstance = create()
      nextInstance = createdInstance
      setCurrent(createdInstance)
      void createdInstance.ready.catch(() => {
        if (current === createdInstance) {
          createdInstance.destroy()
          setCurrent(null)
        }
      })
      createdInstance.mount(target)
    } catch {
      nextInstance?.destroy()
      setCurrent(null)
    }
  }

  const dispose = () => {
    if (!current) return
    current.destroy()
    setCurrent(null)
  }

  return {
    mount,
    dispose,
    get instance() {
      return current
    },
  }
}
