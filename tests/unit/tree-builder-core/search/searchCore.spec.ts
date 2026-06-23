import { describe, expect, it } from 'vitest'
import { match, matchAncestors, buildIndicesFromNested, createStructure } from '@/tree-builder-core'

describe('search core', () => {
  describe('match', () => {
    const texts = ['apple', 'banana', 'grape']

    it('returns the indices whose text contains the query', () => {
      expect(Array.from(match(texts, 'ap'))).toEqual([0, 2]) // apple, grape
      expect(Array.from(match(texts, 'an'))).toEqual([1]) // banana
    })

    it('an empty query matches nothing', () => {
      expect(Array.from(match(texts, ''))).toEqual([])
    })

    it('matching is case-sensitive (callers normalise case)', () => {
      expect(Array.from(match(['Apple'], 'apple'))).toEqual([])
    })
  })

  describe('matchAncestors', () => {
    type Node = { id: string; children?: Node[] }
    const data: Node[] = [
      { id: 'R', children: [{ id: 'C', children: [{ id: 'G', children: [{ id: 'L' }] }] }] },
    ]
    const tree = createStructure(
      buildIndicesFromNested(data, { getChildren: (node) => node.children }),
    )
    const keyOf = (id: string) => {
      for (const key of tree.keys()) if (tree.getNode(key).id === id) return key
      return -1
    }
    const ids = (keys: ReadonlySet<number>) => [...keys].map((key) => tree.getNode(key).id).sort()

    it('collects the full ancestor chain of a match', () => {
      expect(ids(matchAncestors(new Set([keyOf('L')]), tree))).toEqual(['C', 'G', 'R'])
    })

    it('is empty when nothing matches', () => {
      expect(matchAncestors(new Set(), tree).size).toBe(0)
    })

    it('merges ancestors across matches without duplicates', () => {
      const result = matchAncestors(new Set([keyOf('G'), keyOf('L')]), tree)
      expect(ids(result)).toEqual(['C', 'G', 'R'])
    })
  })
})
