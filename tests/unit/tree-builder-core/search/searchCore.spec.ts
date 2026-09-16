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

describe('shared ancestor paths', () => {
  type Nested = { id: string; children?: Nested[] }
  const tree = createStructure(
    buildIndicesFromNested<Nested>(
      [
        { id: 'a', children: [{ id: 'b', children: [{ id: 'c' }, { id: 'd' }] }, { id: 'e' }] },
        { id: 'f', children: [{ id: 'g' }] },
      ],
      { getChildren: (node) => node.children },
    ),
  )

  it('matches the original set and insertion order for every subset in either order', () => {
    const keys = [...tree.keys()]
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      const matches = keys.filter((key) => mask & (1 << key))
      for (const ordered of [matches, [...matches].reverse()]) {
        const original = matchAncestors(ordered, { getAncestorsOf: tree.getAncestorsOf })
        expect([...tree.matchAncestors(ordered)]).toEqual([...original])
        expect([...matchAncestors(ordered, tree)]).toEqual([...original])
      }
    }
  })

  it('recomputes paths per query and excludes a match unless it is another match ancestor', () => {
    expect([...tree.matchAncestors([2, 3, 2])]).toEqual([1, 0])
    expect([...tree.matchAncestors([6])]).toEqual([5])
    expect([...tree.matchAncestors([0, 5])]).toEqual([])
    expect(tree.getParentOf(0)).toBeUndefined()
    expect(tree.getParentOf(2)).toBe(1)
  })

  it('supports generic keys and calls parent accessors with their receiver', () => {
    const navigation = {
      parents: new Map([
        ['leaf', 'branch'],
        ['branch', ''],
      ]),
      getParentOf(key: string) {
        return this.parents.get(key)
      },
      getAncestorsOf(): string[] {
        throw new Error('Ancestor arrays must not be built')
      },
    }
    expect([...matchAncestors(['leaf', 'branch', 'leaf'], navigation)]).toEqual(['branch', ''])
  })

  it('visits shared deep paths linearly without creating ancestor arrays', () => {
    const size = 200_000
    let parentReads = 0
    const navigation = {
      getParentOf(index: number) {
        if (++parentReads > size * 2) throw new Error('Repeated ancestor path')
        return index > 0 ? index - 1 : undefined
      },
      getAncestorsOf(): number[] {
        throw new Error('Ancestor arrays must not be built')
      },
    }
    function* matches() {
      for (let index = 0; index < size; index++) yield index
    }
    const result = matchAncestors(matches(), navigation)
    expect(result.size).toBe(size - 1)
    expect(result.has(0)).toBe(true)
    expect(result.has(size - 1)).toBe(false)
    expect(parentReads).toBe(size * 2 - 1)
  })
})
