import { describe, expect, it } from 'vitest'
import { NyxFission } from '../index'

describe('public package API', () => {
  it('exports NyxFission as a constructible class', () => {
    const instance = new NyxFission({
      source: 'fixture.png',
      type: 'image',
    })

    expect(instance).toBeInstanceOf(NyxFission)
  })
})
