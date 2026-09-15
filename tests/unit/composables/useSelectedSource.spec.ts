import { describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import {
  buildIndicesFromNested,
  cascadeAll,
  cascadeCompact,
  createStructure,
  type SelectionHandler,
} from '@/tree-builder-core'
import { useSelectedSource } from '@/composables/tree/useSelectedSource'

describe('useSelectedSource', () => {
  it('uses the fast ancestor check and updates when selection or strategy changes', () => {
    type Node = { id: string; children?: Node[] }
    const nodes: Node[] = [
      {
        id: 'root',
        children: [
          { id: 'branch', children: [{ id: 'leaf' }, { id: 'sibling' }] },
          { id: 'other' },
        ],
      },
    ]
    const tree = createStructure(
      buildIndicesFromNested(nodes, { getChildren: (node) => node.children }),
      (node) => node.id,
    )
    const ancestors = vi.spyOn(tree, 'getAncestorsOf').mockImplementation(() => {
      throw new Error('Selected must not build ancestor arrays for Compact cascade')
    })
    const checked = shallowRef<ReadonlySet<number>>(new Set([1, 2, 3]))
    const selectionStrategy = shallowRef<SelectionHandler<number>>(cascadeCompact)
    const source = useSelectedSource({
      structure: computed(() => tree),
      checked,
      selectionStrategy,
    })
    const previous = source.value
    expect(previous.length).toBe(1)
    expect(previous.rowAt(0).key).toBe('branch')

    checked.value = new Set([1, 2, 3, 4, 0])
    expect(source.value.length).toBe(1)
    expect(source.value.rowAt(0).key).toBe('root')
    expect(previous.rowAt(0).key).toBe('branch')

    selectionStrategy.value = cascadeAll
    expect(source.value.length).toBe(5)
    expect(Array.from({ length: 5 }, (_, i) => source.value.rowAt(i).key)).toEqual([
      'branch',
      'leaf',
      'sibling',
      'other',
      'root',
    ])
    checked.value = new Set()
    expect(source.value.length).toBe(0)
    expect(ancestors).not.toHaveBeenCalled()
  })
})
