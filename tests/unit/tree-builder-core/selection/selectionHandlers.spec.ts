import { describe, expect, it } from 'vitest'
import {
  createStructure,
  buildIndicesFromNested,
  cascadeAll,
  cascadeCompact,
  emitKeys,
  independent,
  toggledSelection,
  type SelectionHandler,
} from '@/tree-builder-core'

type Node = { id: string; children?: Node[] }

const data: Node[] = [
  {
    id: 'root',
    children: [{ id: 'a', children: [{ id: 'a1' }, { id: 'a2' }] }, { id: 'b' }],
  },
]

const tree = createStructure(buildIndicesFromNested(data, { getChildren: (node) => node.children }))

function keyOf(id: string): number {
  for (const key of tree.keys()) {
    if (tree.getNode(key).id === id) return key
  }
  return -1
}

function ids(keys: ReadonlySet<number> | readonly number[]): string[] {
  return [...keys].map((key) => tree.getNode(key).id).sort()
}

const empty = new Set<number>()
const notDisabled = () => false

function toggle(
  checked: ReadonlySet<number>,
  indeterminate: ReadonlySet<number>,
  handler: SelectionHandler<number>,
  key: number,
  isDisabled: (key: number) => boolean = notDisabled,
) {
  const next = toggledSelection(checked, indeterminate, tree, isDisabled, handler, key)
  return { ...next, selected: emitKeys(next.checked, tree, handler) }
}

describe('selection handlers', () => {
  describe('cascadeAll', () => {
    it('when checking a parent, then the parent and all its descendants become checked', () => {
      const result = toggle(empty, empty, cascadeAll, keyOf('a'))
      expect(ids(result.checked)).toEqual(['a', 'a1', 'a2'])
    })

    it('when checking a parent with an unchecked sibling, then the grandparent becomes indeterminate', () => {
      const result = toggle(empty, empty, cascadeAll, keyOf('a'))
      expect(ids(result.indeterminate)).toEqual(['root'])
    })

    it('when checking one of two children, then the parent becomes indeterminate, not checked', () => {
      const result = toggle(empty, empty, cascadeAll, keyOf('a1'))
      expect(ids(result.checked)).toEqual(['a1'])
      expect(ids(result.indeterminate)).toEqual(['a', 'root'])
    })

    it('when both children get checked, then the parent rolls up to checked', () => {
      const first = toggle(empty, empty, cascadeAll, keyOf('a1'))
      const second = toggle(
        first.checked,
        first.indeterminate,
        cascadeAll,
        keyOf('a2'),
      )
      expect(ids(second.checked)).toEqual(['a', 'a1', 'a2'])
      expect(ids(second.indeterminate)).toEqual(['root'])
    })

    it('when unchecking one of two checked children, then the parent drops from checked to indeterminate', () => {
      const checkedA = toggle(empty, empty, cascadeAll, keyOf('a'))
      const result = toggle(
        checkedA.checked,
        checkedA.indeterminate,
        cascadeAll,
        keyOf('a1'),
      )
      expect(ids(result.checked)).toEqual(['a2'])
      expect(ids(result.indeterminate)).toEqual(['a', 'root'])
    })

    it('when toggling a leaf on then off, then it ends unchecked with no indeterminate residue', () => {
      const on = toggle(empty, empty, cascadeAll, keyOf('b'))
      expect(ids(on.checked)).toEqual(['b'])
      expect(ids(on.indeterminate)).toEqual(['root'])

      const off = toggle(on.checked, on.indeterminate, cascadeAll, keyOf('b'))
      expect(ids(off.checked)).toEqual([])
      expect(ids(off.indeterminate)).toEqual([])
    })
  })

  describe('independent', () => {
    it('when checking a parent, then descendants are not cascaded', () => {
      const result = toggle(empty, empty, independent, keyOf('a'))
      expect(ids(result.checked)).toEqual(['a'])
    })

    it('when checking a leaf, then ancestors become indeterminate but stay unchecked', () => {
      const result = toggle(empty, empty, independent, keyOf('a1'))
      expect(ids(result.checked)).toEqual(['a1'])
      expect(ids(result.indeterminate)).toEqual(['a', 'root'])
    })

    it('when unchecking the only checked descendant, then ancestor indeterminate clears', () => {
      const on = toggle(empty, empty, independent, keyOf('a1'))
      const off = toggle(on.checked, on.indeterminate, independent, keyOf('a1'))
      expect(ids(off.checked)).toEqual([])
      expect(ids(off.indeterminate)).toEqual([])
    })
  })

  describe('cascadeCompact (emit)', () => {
    it('when a whole subtree is checked, then only its root key is emitted', () => {
      const result = toggle(empty, empty, cascadeCompact, keyOf('root'))
      expect(ids(result.checked)).toEqual(['a', 'a1', 'a2', 'b', 'root'])
      expect(ids(result.selected)).toEqual(['root'])
    })

    it('when a partial subtree is checked, then the highest fully-checked node is emitted', () => {
      const result = toggle(empty, empty, cascadeCompact, keyOf('a'))
      expect(ids(result.checked)).toEqual(['a', 'a1', 'a2'])
      expect(ids(result.selected)).toEqual(['a'])
    })

    it('shares the checked set with cascadeAll but emits only roots, while cascadeAll emits every node', () => {
      const all = toggle(empty, empty, cascadeAll, keyOf('a'))
      const compact = toggle(empty, empty, cascadeCompact, keyOf('a'))
      expect(ids(all.checked)).toEqual(ids(compact.checked))
      expect(ids(all.selected)).toEqual(['a', 'a1', 'a2'])
      expect(ids(compact.selected)).toEqual(['a'])
    })
  })

  describe('disabled descendants', () => {
    it('when a descendant is disabled, then the cascade skips it', () => {
      const isDisabled = (key: number) => tree.getNode(key).id === 'a2'
      const result = toggle(empty, empty, cascadeAll, keyOf('a'), isDisabled)
      expect(result.checked.has(keyOf('a2'))).toBe(false)
      expect(result.checked.has(keyOf('a1'))).toBe(true)
    })
  })
})
