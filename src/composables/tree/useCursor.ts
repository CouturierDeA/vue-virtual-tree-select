import { computed, shallowRef, type ComputedRef, type Ref } from 'vue'
import {
  matchAt,
  matchPositionOf,
  stepMatch,
  type NodeIndex,
  type OrderedNodeIndexSet,
  type TreeStructure,
} from '@/tree-builder-core'

export function useCursor<T, K>(options: {
  matched: Ref<OrderedNodeIndexSet>
  structure: ComputedRef<TreeStructure<T, K>>
}) {
  const { matched, structure } = options

  const currentIndex = shallowRef<NodeIndex | undefined>(undefined)
  const orderedMatches = computed(() => matched.value)
  const matchCount = computed(() => orderedMatches.value.length)
  const currentMatchIndex = computed(() =>
    matchPositionOf(orderedMatches.value, currentIndex.value),
  )
  const currentKey = computed(() =>
    currentIndex.value === undefined ? undefined : structure.value.toKey(currentIndex.value),
  )

  function step(direction: 1 | -1) {
    const next = stepMatch(
      orderedMatches.value,
      currentMatchIndex.value,
      currentIndex.value,
      direction,
    )
    if (next !== undefined) currentIndex.value = next
  }

  function goToFirst() {
    const first = matchAt(orderedMatches.value, 0)
    if (first !== undefined) currentIndex.value = first
  }

  return {
    currentKey,
    matchCount,
    currentMatchIndex,
    goToPrev: () => step(-1),
    goToNext: () => step(1),
    goToFirst,
  }
}
