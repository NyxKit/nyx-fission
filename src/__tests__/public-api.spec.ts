import { describe, expect, it } from 'vitest'
import { NyxFission } from '../index'

describe('public package API', () => {
  it('exports NyxFission as a constructible class', () => {
    expect(typeof NyxFission).toBe('function')
  })
})
