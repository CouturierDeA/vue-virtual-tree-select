import { describe, expect, it } from 'vitest'
import {
  applyToggle,
  buildIndicesFromNested,
  buildVisibleCounts,
  keyAtVisibleIndex,
  visibleKeysInRange,
  windowGuides,
} from '@/tree-builder-core'

// Ten such chains make a two-million-node dataset.
const size = 200_000
const indices = buildIndicesFromNested([{ index: 0 }], {
  getChildren: ({ index }) => (index + 1 < size ? [{ index: index + 1 }] : []),
})

describe('deep visible window', () => {
  it('keeps depths beyond 65535 and avoids empty guide descriptors', () => {
    const counts = buildVisibleCounts(indices, () => true)
    const empty = new Set<number>()
    for (const index of [65_535, 65_536, size - 1]) {
      expect(indices.depth[index]).toBe(index)
      const guides = windowGuides(indices, counts, empty, empty, index)
      expect(guides.verticals).toEqual([])
      expect(guides.connector?.descent).toBe(index < size - 1)
    }
  })

  it('reads a fully visible subtree directly without visiting its children', () => {
    const counts = buildVisibleCounts(indices, () => true)
    const topo = {
      ...indices,
      childStart: new Proxy(indices.childStart, {
        get() {
          throw new Error('Unexpected descent')
        },
      }),
    }
    expect(keyAtVisibleIndex(topo, counts, 190_000)).toBe(190_000)
    expect([...visibleKeysInRange(topo, counts, 190_000, 3)]).toEqual([190_000, 190_001, 190_002])
  })

  it('reads neighboring rows below a deep partially open path without recursion', () => {
    const counts = buildVisibleCounts(indices, () => true)
    applyToggle(indices, counts, 190_000, false)
    expect([...visibleKeysInRange(indices, counts, 180_000, 1000)]).toEqual(
      Array.from({ length: 1000 }, (_, i) => 180_000 + i),
    )
    expect([...visibleKeysInRange(indices, counts, 189_999, 10)]).toEqual([189_999, 190_000])
    applyToggle(indices, counts, 190_000, true)
    expect([...visibleKeysInRange(indices, counts, 199_998, 10)]).toEqual([199_998, 199_999])
  })
})
