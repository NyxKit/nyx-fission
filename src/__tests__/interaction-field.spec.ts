import { describe, expect, it } from 'vitest'
import { InteractionField, type InteractionFrame } from '../interaction-field'
import { resolveInteractionConfig } from '../interaction'
import { NyxInteraction } from '../types'
import type { ParticleField } from '../particles'

function setup(type = NyxInteraction.Repel, delay = 500, duration = 300, strength = 1) {
  const field = {
    positions: new Float32Array([-0.25, 0, 0, 0.25, 0, 0]),
    luminance: new Float32Array([0.5, 0.5]),
  } as ParticleField
  const simulation = new InteractionField(field, resolveInteractionConfig({ type, radius: 70, delay, duration, strength }))
  const frame: InteractionFrame = {
    time: 0, active: true, pointer: new Float32Array([110, 100]),
    viewport: new Float32Array([400, 200]), cameraZ: 1, aspect: 2, fov: 90, depth: 0,
  }
  // Projected particles lie at x=175 and x=225; initial pointer affects only the first.
  const step = (time: number, x = frame.pointer[0], active = true) => {
    frame.time = time
    frame.pointer[0] = x
    frame.active = active
    simulation.update(frame)
    return [...simulation.offsets]
  }
  return { simulation, frame, field, step }
}

describe('particle interaction timing', () => {
  it('keeps the original repel displacement at full strength', () => {
    const { step } = setup(NyxInteraction.Repel, 0, 0, 1)
    const distanceRatio = 65 / 70
    const falloff = 1 - distanceRatio ** 2 * (3 - 2 * distanceRatio)
    expect(step(0)[0]).toBeCloseTo(0.01 * 70 * falloff * 0.65)
  })

  it.each([NyxInteraction.Attract, NyxInteraction.Push, NyxInteraction.Pull])('maps the original full %s effect to strength 0.5', (type) => {
    const { step } = setup(type, 0, 0, 0.5)
    const t = 65 / 70
    const falloff = 1 - t * t * (3 - 2 * t)
    const offset = step(0)
    if (type === NyxInteraction.Attract) expect(offset[0]).toBeCloseTo(-65 * 0.01 * falloff * 0.75)
    else expect(offset[2]).toBeCloseTo(0.35 * falloff * (type === NyxInteraction.Push ? -1 : 1))
  })

  it('caps full attraction at the pointer without overshoot', () => {
    const { step } = setup(NyxInteraction.Attract, 0, 0, 1)
    // The first particle projects to x=175, 15px to the right of the pointer.
    expect(step(0, 160)[0]).toBeCloseTo(-0.15)
  })

  it.each([NyxInteraction.Attract, NyxInteraction.Repel, NyxInteraction.Push, NyxInteraction.Pull])('scales %s displacement linearly with strength', (type) => {
    const full = setup(type, 0, 0, 1).step(0)
    const half = setup(type, 0, 0, 0.5).step(0)
    const zero = setup(type, 0, 0, 0).step(0)
    for (let i = 0; i < full.length; i++) expect(half[i]).toBeCloseTo(full[i] * 0.5)
    expect(zero).toEqual([0, 0, 0, 0, 0, 0])
  })
  it.each([NyxInteraction.Attract, NyxInteraction.Repel, NyxInteraction.Push, NyxInteraction.Pull])('holds the old %s effect for 500ms on movement, then returns over 300ms', (type) => {
    const { step } = setup(type)
    step(0)
    const affected = step(300)
    expect(affected.slice(0, 3).some(value => value !== 0)).toBe(true)
    expect(affected.slice(3)).toEqual([0, 0, 0])
    expect(step(400, 290).slice(0, 3)).toEqual(affected.slice(0, 3))
    const newArea = step(700, 290)
    expect(newArea.slice(0, 3)).toEqual(affected.slice(0, 3))
    expect(newArea.slice(3).some(value => value !== 0)).toBe(true)
    expect(step(899, 290).slice(0, 3)).toEqual(affected.slice(0, 3))
    expect(step(900, 290).slice(0, 3)).toEqual(affected.slice(0, 3))
    const returning = step(1050, 290)
    for (let i = 0; i < 3; i++) expect(returning[i]).toBeCloseTo(affected[i] * 0.0625)
    const settled = step(1200, 290)
    expect(settled.slice(0, 3)).toEqual([0, 0, 0])
    expect(settled.slice(3)).toEqual(newArea.slice(3))
  })

  it('also delays and animates returns on canvas exit', () => {
    const { step, simulation } = setup()
    step(0)
    const affected = step(300)
    step(400, 110, false)
    expect(step(899, 110, false)).toEqual(affected)
    expect(step(1050, 110, false)[0]).toBeCloseTo(affected[0] * 0.0625)
    expect(step(1200, 110, false)).toEqual([0, 0, 0, 0, 0, 0])
    expect(simulation.moving).toBe(false)
  })

  it('reacts on entry without applying the return delay first', () => {
    const { step } = setup()
    step(0)
    expect(step(150)[0]).not.toBe(0)
  })

  it('cancels a pending return when the pointer comes back without snapping', () => {
    const { step } = setup()
    step(0)
    const affected = step(300)
    step(400, 290)
    expect(step(600, 110).slice(0, 3)).toEqual(affected.slice(0, 3))
    expect(step(1200, 110).slice(0, 3)).toEqual(affected.slice(0, 3))
  })

  it('delays weakening influence even when both pointer positions are within the radius', () => {
    const { step } = setup(NyxInteraction.Push)
    step(0, 160)
    const peak = step(300, 160)[2]
    step(400, 110)
    expect(step(899, 110)[2]).toBe(peak)
    expect(Math.abs(step(1050, 110)[2])).toBeLessThan(Math.abs(peak))
    expect(step(1200, 110)[2]).not.toBe(0)
  })

  it('does not extend the initial hold on each subsequent pointer movement', () => {
    const { step } = setup(NyxInteraction.Push)
    step(0, 170)
    const peak = step(300, 170)[2]
    step(400, 160)
    step(500, 150)
    step(600, 140)
    step(700, 130)
    step(800, 120)
    step(900, 110)
    expect(Math.abs(step(1050, 110)[2])).toBeLessThan(Math.abs(peak))
  })

  it.each([0, 500])('supports zero duration with %sms return delay', (delay) => {
    const { step } = setup(NyxInteraction.Repel, delay, 0)
    const affected = step(0)
    expect(affected[0]).not.toBe(0)
    const moved = step(100, 290)
    expect(moved[0]).toBe(delay ? affected[0] : 0)
    if (delay) expect(step(599, 290)[0]).toBe(affected[0])
    expect(step(100 + delay, 290)[0]).toBe(0)
  })

  it('uses the intended displacement directions', () => {
    for (const type of [NyxInteraction.Attract, NyxInteraction.Repel, NyxInteraction.Push, NyxInteraction.Pull]) {
      const { step } = setup(type, 0, 0)
      const offset = step(0)
      if (type === NyxInteraction.Attract) expect(offset[0]).toBeLessThan(0)
      if (type === NyxInteraction.Repel) expect(offset[0]).toBeGreaterThan(0)
      if (type === NyxInteraction.Push) expect(offset[2]).toBeLessThan(0)
      if (type === NyxInteraction.Pull) expect(offset[2]).toBeGreaterThan(0)
    }
  })

  it('resets every held displacement for replay, reduced motion, and destruction', () => {
    const { step, simulation } = setup()
    step(0)
    step(300)
    simulation.reset()
    expect([...simulation.offsets]).toEqual([0, 0, 0, 0, 0, 0])
    expect(step(5000, 110, false)).toEqual([0, 0, 0, 0, 0, 0])
    expect(simulation.moving).toBe(false)
  })
})
