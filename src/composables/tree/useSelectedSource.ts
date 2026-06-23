import { computed, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import type { NodeIndex, SelectionHandler, TreeStructure } from '@/tree-builder-core'
import { fromFilteredSet } from '@/virtual-list/rowSource'

export function useSelectedSource<T, K>(options: {
  structure: ComputedRef<TreeStructure<T, K>>
  checked: ShallowRef<ReadonlySet<NodeIndex>>
  selectionStrategy: Ref<SelectionHandler<NodeIndex>>
}) {
  const { structure, checked, selectionStrategy } = options

  return computed(() => {
    const struct = structure.value
    const checkedSet = checked.value
    const strategy = selectionStrategy.value
    const shouldEmit = strategy.shouldEmit

    function accept(index: NodeIndex) {
      if (!shouldEmit) return true
      return shouldEmit(index, {
        isChecked: (key) => checkedSet.has(key),
        ancestorsOf: (key) => struct.getAncestorsOf(key),
      })
    }

    return fromFilteredSet(checkedSet, {
      accept,
      keyOf: (index) => struct.toKey(index),
      rowOf: (index) => ({ key: struct.toKey(index), node: struct.getNode(index) }),
    })
  })
}
