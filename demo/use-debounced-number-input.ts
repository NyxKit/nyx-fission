/* global window */

import { onScopeDispose, ref, type Ref } from 'vue'

type NumberParser = (_input: string, _current: number) => number
const DEFAULT_APPLY_DELAY_MS = 250

export function commitUnitInterval(input: string, current: number): number {
  const next = Number(input)
  return Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : current
}

export function useDebouncedNumberInput(
  value: Ref<number>,
  parse: NumberParser,
  delayMs = DEFAULT_APPLY_DELAY_MS,
) {
  const input = ref(String(value.value))
  let timer: number | undefined

  const cancelPendingCommit = () => {
    if (timer === undefined) return
    window.clearTimeout(timer)
    timer = undefined
  }

  const commit = () => {
    cancelPendingCommit()
    const next = parse(input.value, value.value)
    input.value = String(next)
    value.value = next
  }

  const update = (nextInput: string) => {
    input.value = nextInput
    cancelPendingCommit()
    timer = window.setTimeout(commit, delayMs)
  }

  onScopeDispose(cancelPendingCommit)
  return { input, update, commit }
}
