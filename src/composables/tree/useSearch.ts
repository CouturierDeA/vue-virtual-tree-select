import { onScopeDispose, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import { createSearch } from '@/composables/tree/createSearch'
import {
  EMPTY_ORDERED_NODE_INDEX_SET,
  orderedNodeIndexSet,
  type NodeIndexSet,
  type OrderedNodeIndexSet,
  type TreeStructure,
} from '@/tree-builder-core'

const normalize = (raw: string) => raw.trim().toLowerCase()

export function useSearch<T, K>(options: {
  structure: ComputedRef<TreeStructure<T, K>>
  query: Ref<string>
  getSearchText: (node: T) => string
  worker?: boolean
}) {
  const { structure, query, getSearchText } = options
  const search = createSearch(!!options.worker)

  const searchMatched = shallowRef<OrderedNodeIndexSet>(EMPTY_ORDERED_NODE_INDEX_SET)
  const searchMatchAncestors = shallowRef<NodeIndexSet>(new Set())

  function runSearch() {
    const normalized = normalize(query.value)
    if (normalized.length === 0) {
      searchMatched.value = EMPTY_ORDERED_NODE_INDEX_SET
      searchMatchAncestors.value = new Set()
      search.query(normalized, () => {})
      return
    }
    search.query(normalized, (indices) => {
      const newValue = orderedNodeIndexSet(indices)
      searchMatched.value = newValue
      searchMatchAncestors.value = structure.value.matchAncestors(newValue)
    })
  }

  watch(
    structure,
    (struct) => {
      const texts: string[] = []
      for (const index of struct.keys()) {
        texts[index] = normalize(getSearchText(struct.getNode(index)))
      }
      search.index(texts)
      if (normalize(query.value).length > 0) runSearch()
    },
    { immediate: true },
  )
  onScopeDispose(() => search.dispose())

  return { runSearch, searchMatched, searchMatchAncestors }
}
