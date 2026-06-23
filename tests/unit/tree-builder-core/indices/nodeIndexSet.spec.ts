import { describe, expect, it } from 'vitest'
import { orderedNodeIndexSet } from '@/tree-builder-core'

describe('orderedNodeIndexSet', () => {
  it('keeps ordered access and membership on node indices', () => {
    const matches = orderedNodeIndexSet(new Int32Array([7, 3, 11]))

    expect(matches.length).toBe(3)
    expect(matches.size).toBe(3)
    expect(matches.at(0)).toBe(7)
    expect(matches.at(2)).toBe(11)
    expect(matches.has(3)).toBe(true)
    expect(matches.has(4)).toBe(false)
  })

  it('finds positions without requiring an Array.from copy', () => {
    const matches = orderedNodeIndexSet(new Int32Array([7, 3, 11]))

    expect(matches.positionOf(7)).toBe(0)
    expect(matches.positionOf(11)).toBe(2)
    expect(matches.positionOf(99)).toBe(-1)
    expect([...matches]).toEqual([7, 3, 11])
  })
})
