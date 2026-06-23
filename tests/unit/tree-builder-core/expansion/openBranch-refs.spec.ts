import { describe, expect, it } from 'vitest'
import { createStructure, buildIndicesFromNested } from '@/tree-builder-core'

type Node = { id: string; children?: Node[] }

const data: Node[] = [
  { id: '03', children: [{ id: '0310', children: [{ id: '0314' }] }] },
  { id: '37', children: [{ id: '3750', children: [{ id: '3753' }] }] },
  { id: '45', children: [{ id: '4510', children: [{ id: '4511', children: [{ id: '4511x' }] }] }] },
]

function buildTree() {
  return createStructure(buildIndicesFromNested(data, { getChildren: (n) => n.children }))
}

function keyOf(tree: ReturnType<typeof buildTree>, id: string): number {
  for (const key of tree.keys()) {
    if (tree.getNode(key).id === id) return key
  }
  return -1
}

describe('openBranch / descend', () => {
  it('ancestors of a deep node are descend-reachable keys resolving to the ancestor chain', () => {
    const tree = buildTree()
    const deep = keyOf(tree, '0314')
    const ancestors = tree.getAncestorsOf(deep)
    const all = tree.descend(() => true)
    for (const ancestor of ancestors) {
      expect(all).toContain(ancestor)
    }
    expect(ancestors.map((a) => tree.getNode(a).id)).toEqual(['0310', '03'])
  })

  it('after accumulated openBranch (like goNext), descend still finds every opened branch', () => {
    const tree = buildTree()
    let opened: ReadonlySet<number> = new Set()
    opened = tree.openedWithPath(opened, keyOf(tree, '0314'))
    opened = tree.openedWithPath(opened, keyOf(tree, '3753'))
    opened = tree.openedWithPath(opened, keyOf(tree, '4511x'))

    const visibleIds = tree.descend((k) => opened.has(k)).map((k) => tree.getNode(k).id)
    expect(visibleIds).toContain('0314')
    expect(visibleIds).toContain('3753')
    expect(visibleIds).toContain('4511x')
  })
})
