import { describe, expect, it } from 'vitest'
import { buildIndicesFromNested, buildIndicesFromFlat, type TreeIndices } from '@/tree-builder-core'

type Nested = { id: string; children?: Nested[] }
type Flat = { id: string; parentId: string | null }

// The same logical tree, expressed both ways. Sibling order matches so the two
// adapters must assign identical pre-order keys.
const nested: Nested[] = [
  {
    id: 'a',
    children: [{ id: 'a1' }, { id: 'a2', children: [{ id: 'a2x' }, { id: 'a2y' }] }],
  },
  { id: 'b', children: [{ id: 'b1' }] },
  { id: 'c' },
]

const flat: Flat[] = [
  { id: 'a', parentId: null },
  { id: 'a1', parentId: 'a' },
  { id: 'a2', parentId: 'a' },
  { id: 'a2x', parentId: 'a2' },
  { id: 'a2y', parentId: 'a2' },
  { id: 'b', parentId: null },
  { id: 'b1', parentId: 'b' },
  { id: 'c', parentId: null },
]

function structure<T>(indices: TreeIndices<T>) {
  return {
    parent: Array.from(indices.parent),
    depth: Array.from(indices.depth),
    subtreeSize: Array.from(indices.subtreeSize),
    childStart: Array.from(indices.childStart),
    childIndex: Array.from(indices.childIndex),
    roots: indices.roots,
  }
}

describe('tree-builder adapters', () => {
  it('nested and flat adapters produce identical index structure for the same tree', () => {
    const ni = buildIndicesFromNested(nested, { getChildren: (n) => n.children })
    const fi = buildIndicesFromFlat(flat, {
      getId: (n) => n.id,
      getParentId: (n) => n.parentId,
    })

    expect(fi.nodes.map((n) => n.id)).toEqual(ni.nodes.map((n) => n.id))
    expect(structure(fi)).toEqual(structure(ni))
  })

  it('flat adapter treats unknown/absent parent ids as roots', () => {
    const orphans: Flat[] = [
      { id: 'x', parentId: 'missing' },
      { id: 'y', parentId: null },
      { id: 'y1', parentId: 'y' },
    ]
    const fi = buildIndicesFromFlat(orphans, {
      getId: (n) => n.id,
      getParentId: (n) => n.parentId,
    })
    expect(fi.nodes.map((n) => n.id)).toEqual(['x', 'y', 'y1'])
    expect(fi.roots).toEqual([0, 1])
    expect(Array.from(fi.parent)).toEqual([-1, -1, 1])
  })

  it('flat adapter terminates on a parent cycle instead of looping', () => {
    const cyclic: Flat[] = [
      { id: 'p', parentId: 'q' },
      { id: 'q', parentId: 'p' },
    ]
    const fi = buildIndicesFromFlat(cyclic, {
      getId: (n) => n.id,
      getParentId: (n) => n.parentId,
    })
    // Both reference each other, so neither is a root → nothing is reachable.
    expect(fi.nodes).toEqual([])
    expect(fi.roots).toEqual([])
  })
})
