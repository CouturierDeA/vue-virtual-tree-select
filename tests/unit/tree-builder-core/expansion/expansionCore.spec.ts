import { describe, expect, it } from 'vitest'
import {
  buildIndicesFromNested,
  createStructure,
  expandableKeys,
  openedWithPath,
  toggledOpen,
} from '@/tree-builder-core'

type Node = { id: string; children?: Node[] }

const data: Node[] = [
  { id: 'A', children: [{ id: 'A1', children: [{ id: 'A1x' }, { id: 'A1y' }] }, { id: 'A2' }] },
  { id: 'B' },
]

const tree = createStructure(buildIndicesFromNested(data, { getChildren: (node) => node.children }))

const keyOf = (id: string) => {
  for (const key of tree.keys()) if (tree.getNode(key).id === id) return key
  return -1
}

const ids = (keys: ReadonlySet<number>) => [...keys].map((key) => tree.getNode(key).id).sort()

describe('expansion', () => {
  describe('toggledOpen', () => {
    it('opening a collapsed parent adds it to the opened set', () => {
      expect(ids(toggledOpen(new Set(), tree, keyOf('A')))).toEqual(['A'])
    })

    it('closing a parent also drops its already-opened descendants', () => {
      const opened = new Set([keyOf('A'), keyOf('A1')])
      expect(ids(toggledOpen(opened, tree, keyOf('A')))).toEqual([])
    })

    it('toggling a leaf is a no-op', () => {
      expect(ids(toggledOpen(new Set(), tree, keyOf('A1x')))).toEqual([])
    })
  })

  it('expandableKeys are exactly the nodes that have children', () => {
    expect(ids(expandableKeys(tree))).toEqual(['A', 'A1'])
  })

  it('openedWithPath opens every ancestor of a node', () => {
    expect(ids(openedWithPath(new Set(), tree, keyOf('A1x')))).toEqual(['A', 'A1'])
  })
})
