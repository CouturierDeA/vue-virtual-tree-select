import { describe, expect, it } from 'vitest'
import {
  buildIndicesFromNested,
  buildVisibleCounts,
  fromCounts,
  applyToggle,
} from '@/tree-builder-core'

type Node = { id: string; children?: Node[] }

// a single deep chain: R › C › G › L
const data: Node[] = [
  { id: 'R', children: [{ id: 'C', children: [{ id: 'G', children: [{ id: 'L' }] }] }] },
]

const indices = buildIndicesFromNested(data, { getChildren: (node) => node.children })
const keyOf = (id: string) => indices.nodes.findIndex((node) => node.id === id)

function sourceFor(openIds: string[]) {
  const opened = new Set(openIds.map(keyOf))
  const counts = buildVisibleCounts(indices, (key) => opened.has(key))
  return fromCounts(indices, () => counts, {
    rowOf: (key) => indices.nodes[key]!,
    isOpen: (key) => opened.has(key),
  })
}

describe('fromCounts row source', () => {
  describe('fallbackFor (nearest visible ancestor of a hidden node)', () => {
    it('returns the collapsed ancestor that is itself still visible', () => {
      // C is collapsed → G and L are hidden; scrolling to L lands on C
      const source = sourceFor(['R'])
      expect(source.fallbackFor!(keyOf('L'))).toBe(keyOf('C'))
    })

    it('walks up to the deepest visible ancestor when several are collapsed', () => {
      // R collapsed → only R is visible
      const source = sourceFor([])
      expect(source.fallbackFor!(keyOf('L'))).toBe(keyOf('R'))
    })

    it('returns undefined for an out-of-range key', () => {
      const source = sourceFor(['R', 'C', 'G'])
      expect(source.fallbackFor!(999)).toBeUndefined()
      expect(source.fallbackFor!(-1)).toBeUndefined()
    })
  })

  describe('visible-window wiring', () => {
    it('reports only the visible rows and maps positions to keys', () => {
      const source = sourceFor(['R', 'C', 'G']) // all open → R, C, G, L visible
      expect(source.length).toBe(4)
      expect(source.keyAt(0)).toBe(keyOf('R'))
      expect(source.keyAt(3)).toBe(keyOf('L'))
      expect(source.indexOf(keyOf('L'))).toBe(3)
    })

    it('a hidden key has no visible index', () => {
      const source = sourceFor(['R']) // C collapsed → G, L hidden
      expect(source.length).toBe(2) // R, C
      expect(source.indexOf(keyOf('G'))).toBe(-1)
    })
  })
})

it('range traversal sees counts changed in place or replaced, and maps object keys', async () => {
  const { keyMappedRowSource } = await import('@/virtual-list/rowSource')
  let counts = buildVisibleCounts(indices, () => true)
  const inner = fromCounts(indices, () => counts, {
    rowOf: (index) => indices.nodes[index]!,
    isOpen: () => true,
  })
  const source = keyMappedRowSource(inner, {
    toOuterKey: (index) => indices.nodes[index]!,
    toInnerKey: (node) => indices.nodes.indexOf(node),
  })
  expect([...source.keysInRange!(1, 10)]).toEqual(indices.nodes.slice(1))
  applyToggle(indices, counts, 1, false)
  expect([...source.keysInRange!(1, 10)]).toEqual([indices.nodes[1]])
  applyToggle(indices, counts, 1, true)
  expect([...source.keysInRange!(1, 2)]).toEqual(indices.nodes.slice(1, 3))
  counts = buildVisibleCounts(indices, () => false)
  expect([...source.keysInRange!(0, 10)]).toEqual([indices.nodes[0]])
})
