type NyxEventListener<T> = (payload: T) => void

export class NyxEventEmitter<T extends Record<string, unknown>> {
  private readonly listeners = new Map<
    keyof T,
    Set<NyxEventListener<T[keyof T]>>
  >()

  on<K extends keyof T>(event: K, listener: NyxEventListener<T[K]>): void {
    let listeners = this.listeners.get(event)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(event, listeners)
    }

    listeners.add(listener as NyxEventListener<T[keyof T]>)
  }

  off<K extends keyof T>(event: K, listener: NyxEventListener<T[K]>): void {
    this.listeners.get(event)?.delete(listener as NyxEventListener<T[keyof T]>)
  }

  emit<K extends keyof T>(event: K, payload: T[K]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(payload)
      } catch {
        // Listener failures must not interrupt lifecycle cleanup.
      }
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
