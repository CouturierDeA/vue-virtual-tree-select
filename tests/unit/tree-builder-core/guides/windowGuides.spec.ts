import { describe, expect, it } from 'vitest'
import { buildIndicesFromNested, buildVisibleCounts, windowGuides } from '@/tree-builder-core'

type Node = { id: string; children?: Node[] }

//   A              B
//   ├─ A1          (leaf root)
//   │  ├─ A1x
//   │  └─ A1y
//   └─ A2
const data: Node[] = [
  { id: 'A', children: [{ id: 'A1', children: [{ id: 'A1x' }, { id: 'A1y' }] }, { id: 'A2' }] },
  { id: 'B' },
]

const indices = buildIndicesFromNested(data, { getChildren: (node) => node.children })
const allOpen = buildVisibleCounts(indices, () => true)

const keyOf = (id: string) => indices.nodes.findIndex((node) => node.id === id)

const ancestorsOf = (id: string) => {
  const out = new Set<number>()
  let p = indices.parent[keyOf(id)]
  while (p >= 0) {
    out.add(p)
    p = indices.parent[p]
  }
  return out
}

const guidesAt = (
  id: string,
  matched: ReadonlySet<number> = new Set(),
  matchAnc: ReadonlySet<number> = new Set(),
  counts: Int32Array = allOpen,
) => windowGuides(indices, counts, matched, matchAnc, keyOf(id))

const filteredCounts = (matched: ReadonlySet<number>, matchAnc: ReadonlySet<number>) =>
  buildVisibleCounts(
    indices,
    (index) => matchAnc.has(index),
    (index) => matched.has(index) || matchAnc.has(index),
  )

describe('windowGuides', () => {
  it('a root row has no connector and no vertical channels', () => {
    expect(guidesAt('A')).toEqual({ verticals: [], connector: null })
    expect(guidesAt('B')).toEqual({ verticals: [], connector: null })
  })

  it('a non-last child draws a down-line; the last child does not', () => {
    expect(guidesAt('A1').connector?.hasDown).toBe(true) // A2 follows
    expect(guidesAt('A2').connector?.hasDown).toBe(false) // last child of A
    expect(guidesAt('A1x').connector?.hasDown).toBe(true) // A1y follows
    expect(guidesAt('A1y').connector?.hasDown).toBe(false) // last child of A1
  })

  it('an open parent shows a descent line; a leaf does not', () => {
    expect(guidesAt('A1').connector?.descent).toBe(true) // A1 has children
    expect(guidesAt('A2').connector?.descent).toBe(false) // leaf
  })

  it('a node carries one vertical channel per ancestor level above its parent', () => {
    expect(guidesAt('A1').verticals).toHaveLength(0) // depth 1
    const deep = guidesAt('A1x').verticals // depth 2
    expect(deep).toHaveLength(1)
    expect(deep[0]!.draw).toBe(true) // ancestor A1 still has a later sibling (A2)
  })

  it('without a search nothing is on-path', () => {
    const connector = guidesAt('A1x').connector!
    expect(connector.upActive).toBe(false)
    expect(connector.elbowActive).toBe(false)
    expect(connector.descentActive).toBe(false)
  })

  it('a matched node activates its own elbow; an unrelated node stays inactive', () => {
    const matched = new Set([keyOf('A1x')])
    const matchAnc = ancestorsOf('A1x')
    expect(guidesAt('A1x', matched, matchAnc).connector?.elbowActive).toBe(true)
    expect(guidesAt('A2', matched, matchAnc).connector?.elbowActive).toBe(false)
  })

  it('the descent of an ancestor on the path to a match is active', () => {
    const matched = new Set([keyOf('A1x')])
    const matchAnc = ancestorsOf('A1x')
    expect(guidesAt('A1', matched, matchAnc).connector?.descentActive).toBe(true)
  })

  it('filtered mode only continues lines toward on-path siblings', () => {
    const matched = new Set([keyOf('A1x')])
    const matchAnc = ancestorsOf('A1x')
    const filtered = filteredCounts(matched, matchAnc)
    // full tree: A1's later sibling A2 keeps the vertical drawn
    expect(guidesAt('A1x', matched, matchAnc).verticals[0]!.draw).toBe(true)
    // filtered: A2 is not on-path, so the vertical is dropped
    expect(guidesAt('A1x', matched, matchAnc, filtered).verticals[0]!.draw).toBe(false)
    // and A1x's own down-line drops too (A1y is not on-path)
    expect(guidesAt('A1x', matched, matchAnc).connector?.hasDown).toBe(true)
    expect(guidesAt('A1x', matched, matchAnc, filtered).connector?.hasDown).toBe(false)
  })
})
