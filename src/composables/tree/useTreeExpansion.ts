import { ref, triggerRef, type ComputedRef, type ShallowRef } from 'vue'
import {
  emitKeys,
  toggledSelection,
  type NodeIndex,
  type SelectionHandler,
  type TreeStructure,
} from '@/tree-builder-core'
import { setsEqual } from '@/utils/setsEqual'

const EMPTY_DESCENDANTS: readonly NodeIndex[] = []

export function useTreeExpansion<T, K>(options: {
  structure: ComputedRef<TreeStructure<T, K>>
  openedSet: ShallowRef<ReadonlySet<NodeIndex>>
  visibleCounts: ShallowRef<Int32Array>
  refreshVisibleRows: () => void
}) {
  const { structure, openedSet, visibleCounts, refreshVisibleRows } = options

  const expandAll = ref(false)

  function commitOpenedSet(next: ReadonlySet<NodeIndex>, updateVisibleRows = refreshVisibleRows) {
    const changed = !setsEqual(next, openedSet.value)
    if (!changed) return false
    openedSet.value = next
    updateVisibleRows()
    return changed
  }

  function applyOpeningStrategy(
    indices: NodeIndex[],
    strategy: SelectionHandler<NodeIndex> | undefined,
  ) {
    if (strategy === undefined) return new Set(indices)

    const struct = structure.value
    indices.sort((a, b) => a - b)

    const expansionStructure = {
      getChildrenOf: (index: NodeIndex) => struct.getChildrenOf(index),
      getAncestorsOf: (index: NodeIndex) => struct.getAncestorsOf(index),
      getDescendantsOf: () => EMPTY_DESCENDANTS,
    }

    let nextOpened = new Set<NodeIndex>()
    let nextIndeterminate = new Set<NodeIndex>()

    for (const index of indices) {
      if (nextOpened.has(index)) continue

      const next = toggledSelection(
        nextOpened,
        nextIndeterminate,
        expansionStructure,
        () => false,
        strategy,
        index,
      )
      nextOpened = next.checked
      nextIndeterminate = next.indeterminate
    }
    return new Set(emitKeys(nextOpened, struct, strategy))
  }

  function openedAncestorPaths(indices: Iterable<NodeIndex>) {
    const struct = structure.value
    const next = new Set<NodeIndex>()
    for (const index of indices) {
      for (const ancestor of struct.getAncestorsOf(index)) next.add(ancestor)
    }
    return next
  }

  function setOpenedKeys(
    keys: readonly K[],
    strategy?: SelectionHandler<NodeIndex>,
  ) {
    const indices = structure.value.toIndices(keys)
    const openedByStrategy = applyOpeningStrategy(indices, strategy)
    return commitOpenedSet(openedAncestorPaths(openedByStrategy))
  }

  function openAncestors(indices: Iterable<NodeIndex>) {
    const changed = commitOpenedSet(new Set(indices))
    if (!changed) refreshVisibleRows()
    return changed
  }

  function syncVisibleRows(ancestorsToOpen?: Iterable<NodeIndex>) {
    if (expandAll.value || ancestorsToOpen === undefined) {
      refreshVisibleRows()
      return false
    }

    return openAncestors(ancestorsToOpen)
  }

  function openPathTo(key: K) {
    const index = structure.value.toIndex(key)
    if (index === undefined) return false
    return commitOpenedSet(structure.value.openedWithPath(openedSet.value, index))
  }

  function openPathsTo(keys: readonly K[]) {
    const struct = structure.value
    const next = new Set(openedSet.value)
    const before = next.size

    for (const index of struct.toIndices(keys)) {
      for (const ancestor of struct.getAncestorsOf(index)) next.add(ancestor)
    }

    if (next.size === before) return false
    return commitOpenedSet(next)
  }

  function toggleOpened(key: K) {
    const index = structure.value.toIndex(key)
    if (index === undefined) return false
    const nowOpen = !openedSet.value.has(index)
    if (!nowOpen) expandAll.value = false
    const next = new Set(openedSet.value)
    if (nowOpen) next.add(index)
    else next.delete(index)

    return commitOpenedSet(next, () => {
      structure.value.applyToggle(visibleCounts.value, index, nowOpen)
      triggerRef(visibleCounts)
    })
  }

  function onExpandAll(on: boolean) {
    expandAll.value = on
    return commitOpenedSet(on ? structure.value.expandableKeys() : new Set<NodeIndex>())
  }

  function isOpened(index: NodeIndex) {
    return openedSet.value.has(index)
  }

  return {
    expandAll,
    isOpened,
    setOpenedKeys,
    syncVisibleRows,
    openPathTo,
    openPathsTo,
    toggleOpened,
    onExpandAll,
  }
}
