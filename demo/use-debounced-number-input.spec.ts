import { effectScope, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { commitDemoDepth } from './quickstart'
import {
  commitUnitInterval,
  useDebouncedNumberInput,
} from './use-debounced-number-input'

let scope: EffectScope

beforeEach(() => {
  scope = effectScope()
  vi.useFakeTimers()
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

function depthControl() {
  const value = ref(0.35)
  const control = scope.run(() =>
    useDebouncedNumberInput(value, commitDemoDepth),
  )!
  return { value, ...control }
}

describe('debounced numeric input', () => {
  it('restarts the delay on each edit and commits only the latest value', () => {
    const control = depthControl()
    control.update('0.4')
    vi.advanceTimersByTime(200)
    control.update('0.6')
    vi.advanceTimersByTime(249)
    expect(control.input.value).toBe('0.6')
    expect(control.value.value).toBe(0.35)
    vi.advanceTimersByTime(1)
    expect(control.value.value).toBe(0.6)
  })

  it('cancels the scheduled commit when committing immediately', () => {
    const control = depthControl()
    control.update('0.7')
    control.commit()
    expect(control.value.value).toBe(0.7)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels pending work when its Vue scope is disposed', () => {
    const control = depthControl()
    control.update('0.9')
    scope.stop()
    vi.advanceTimersByTime(250)
    expect(control.value.value).toBe(0.35)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['', '-', 'invalid'])(
    'retains the committed depth for incomplete input %j',
    (input) => {
      const control = depthControl()
      control.update(input)
      control.commit()
      expect(control.value.value).toBe(0.35)
      expect(control.input.value).toBe('0.35')
    },
  )

  it.each([
    ['', 0],
    ['-2', 0],
    ['2', 1],
    ['0.6', 0.6],
    ['invalid', 0.3],
    ['Infinity', 0.3],
  ])('preserves luma parsing for %j', (input, expected) => {
    const value = ref(0.3)
    const control = scope.run(() =>
      useDebouncedNumberInput(value, commitUnitInterval),
    )!
    control.update(input)
    control.commit()
    expect(value.value).toBe(expected)
    expect(control.input.value).toBe(String(expected))
  })
})
