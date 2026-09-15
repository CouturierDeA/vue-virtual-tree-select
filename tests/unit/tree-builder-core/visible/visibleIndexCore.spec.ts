import { describe, expect, it } from 'vitest'
import {
  buildIndicesFromNested,
  createStructure,
  applyToggle,
  buildVisibleCounts,
  collectVisibleSlice,
  keyAtVisibleIndex,
  totalVisible,
  visibleIndexOf,
  visibleKeysInRange,
} from '@/tree-builder-core'

interface NestedNode {
  id: string
  children: NestedNode[]
}

const node = (id: string, children: NestedNode[] = []): NestedNode => ({ id, children })

const data: NestedNode[] = [
  node('a', [node('a1'), node('a2', [node('a2x'), node('a2y')])]),
  node('b'),
  node('c', [node('c1', [node('c1a'), node('c1b')]), node('c2')]),
]

const indices = buildIndicesFromNested(data, { getChildren: (item: NestedNode) => item.children })
const tree = createStructure(indices)
const togglable = Array.from(tree.keys()).filter((key) => tree.hasChildren(key))

const openedFromMask = (mask: number) => {
  const opened = new Set<number>()
  togglable.forEach((key, bit) => {
    if (mask & (1 << bit)) opened.add(key)
  })
  return opened
}

const groundTruth = (opened: Set<number>) => tree.descend((key) => opened.has(key))

describe('visibleIndexCore', () => {
  it('total + per-position queries match descend for every opened combination', () => {
    for (let mask = 0; mask < 1 << togglable.length; mask++) {
      const opened = openedFromMask(mask)
      const counts = buildVisibleCounts(indices, (key) => opened.has(key))
      const visible = groundTruth(opened)

      expect(totalVisible(counts, indices.roots)).toBe(visible.length)

      for (let pos = 0; pos < visible.length; pos++) {
        expect(keyAtVisibleIndex(indices, counts, pos)).toBe(visible[pos])
      }
      for (const key of visible) {
        expect(visibleIndexOf(indices, counts, key)).toBe(visible.indexOf(key))
      }
    }
  })

  it('collectVisibleSlice matches descend.slice for arbitrary windows', () => {
    for (let mask = 0; mask < 1 << togglable.length; mask++) {
      const opened = openedFromMask(mask)
      const counts = buildVisibleCounts(indices, (key) => opened.has(key))
      const visible = groundTruth(opened)

      for (let start = 0; start <= visible.length; start++) {
        for (let count = 0; count <= visible.length - start + 1; count++) {
          // Also exercise traversal without the optional pre-order shortcut.
          const { parent, childStart, childIndex, roots } = indices
          expect([
            ...visibleKeysInRange({ parent, childStart, childIndex, roots }, counts, start, count),
          ]).toEqual(visible.slice(start, start + count))
          expect(collectVisibleSlice(indices, counts, start, count)).toEqual(
            visible.slice(start, start + count),
          )
        }
      }
    }
  })

  it('applyToggle on a visible key is equivalent to a full rebuild', () => {
    for (let mask = 0; mask < 1 << togglable.length; mask++) {
      const opened = openedFromMask(mask)
      const visible = new Set(groundTruth(opened))
      for (const key of togglable) {
        if (!visible.has(key)) continue
        const counts = buildVisibleCounts(indices, (k) => opened.has(k))
        const nowOpen = !opened.has(key)

        applyToggle(indices, counts, key, nowOpen)

        const next = new Set(opened)
        if (nowOpen) next.add(key)
        else next.delete(key)
        const rebuilt = buildVisibleCounts(indices, (k) => next.has(k))

        expect(Array.from(counts)).toEqual(Array.from(rebuilt))
        expect(totalVisible(counts, indices.roots)).toBe(groundTruth(next).length)
      }
    }
  })
})

it('skips fully filtered subtrees and roots in range traversal', () => {
  const shown = new Set([0, 2, 4, 6, 10])
  const counts = buildVisibleCounts(
    indices,
    () => true,
    (index) => shown.has(index),
  )
  const expected = [0, 2, 4, 6, 10]
  for (let start = 0; start <= expected.length; start++) {
    expect([...visibleKeysInRange(indices, counts, start, 3)]).toEqual(
      expected.slice(start, start + 3),
    )
  }
})

it('rejects invalid positions even in a fully visible subtree', () => {
  const counts = buildVisibleCounts(indices, () => true)
  for (const position of [-1, 0.5, NaN, Infinity, indices.nodes.length]) {
    expect(keyAtVisibleIndex(indices, counts, position)).toBe(-1)
  }
})
