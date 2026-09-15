import { computed, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import {
  createExportContext,
  type NodeIndex,
  type SelectionHandler,
  type TreeStructure,
} from '@/tree-builder-core'
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
    const context = createExportContext(checkedSet, struct)

    function accept(index: NodeIndex) {
      return shouldEmit ? shouldEmit(index, context) : true
    }

    return fromFilteredSet(checkedSet, {
      accept,
      keyOf: (index) => struct.toKey(index),
      rowOf: (index) => ({ key: struct.toKey(index), node: struct.getNode(index) }),
    })
  })
}
