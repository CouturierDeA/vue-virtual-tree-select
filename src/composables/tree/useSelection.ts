import { shallowRef, type ComputedRef, type Ref } from 'vue'
import {
  emitKeys,
  toggledSelection,
  type NodeIndex,
  type SelectionHandler,
  type TreeStructure,
} from '@/tree-builder-core'
import { setsEqual } from '@/utils/setsEqual'
import { useSelectedSource } from '@/composables/tree/useSelectedSource'

const notDisabled = () => false

export function useSelection<T, K>(options: {
  structure: ComputedRef<TreeStructure<T, K>>
  selectionStrategy: Ref<SelectionHandler<NodeIndex>>
}) {
  const { structure, selectionStrategy } = options

  const checked = shallowRef<ReadonlySet<NodeIndex>>(new Set())
  const indeterminate = shallowRef<ReadonlySet<NodeIndex>>(new Set())

  const selectedSource = useSelectedSource({ structure, checked, selectionStrategy })

  function applyChecked(
    nextChecked: ReadonlySet<NodeIndex>,
    nextIndeterminate: ReadonlySet<NodeIndex>,
  ) {
    if (setsEqual(nextChecked, checked.value)) return
    checked.value = nextChecked
    indeterminate.value = nextIndeterminate
  }

  function setChecked(key: K, value: boolean) {
    const index = structure.value.toIndex(key)
    if (index === undefined) return
    if (checked.value.has(index) === value) return
    const next = toggledSelection(
      checked.value,
      indeterminate.value,
      structure.value,
      notDisabled,
      selectionStrategy.value,
      index,
    )
    applyChecked(next.checked, next.indeterminate)
  }

  function toggleChecked(key: K) {
    const index = structure.value.toIndex(key)
    if (index === undefined) return
    setChecked(key, !checked.value.has(index))
  }

  function setCheckedKeys(
    keys: readonly K[],
    strategy: SelectionHandler<NodeIndex> = selectionStrategy.value,
  ) {
    const struct = structure.value
    let nextChecked: ReadonlySet<NodeIndex> = new Set<NodeIndex>()
    let nextIndeterminate: ReadonlySet<NodeIndex> = new Set<NodeIndex>()
    for (const index of struct.toIndices(keys)) {
      if (nextChecked.has(index)) continue
      const next = toggledSelection(
        nextChecked,
        nextIndeterminate,
        struct,
        notDisabled,
        strategy,
        index,
      )
      nextChecked = next.checked
      nextIndeterminate = next.indeterminate
    }
    applyChecked(nextChecked, nextIndeterminate)
  }

  function getCheckedKeys(
    strategy: SelectionHandler<NodeIndex> = selectionStrategy.value,
  ) {
    return structure.value.toKeys(emitKeys(checked.value, structure.value, strategy))
  }

  return {
    checked,
    indeterminate,
    selectedSource,
    getCheckedKeys,
    setChecked,
    toggleChecked,
    setCheckedKeys,
  }
}
