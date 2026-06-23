import { computed, nextTick, ref, watch, type Ref } from 'vue'
import {
  createStructure,
  type NodeIndex,
  type SelectionHandler,
  type TreeIndices,
} from '@/tree-builder-core'
import { useSearch } from '@/composables/tree/useSearch'
import { useSelection } from '@/composables/tree/useSelection'
import { useCursor } from '@/composables/tree/useCursor'
import {
  type TreeProjectionRow,
  type ViewPresentationPlan,
  useTreeProjection,
} from '@/composables/tree/useTreeProjection'
import { viewStrategies, type ViewStrategyName } from '@/composables/tree/viewStrategies'

type SearchViewMode = 'tree' | 'tree-filter'

export function useTreeSelect<T extends object, K = T>(options: {
  indices: Ref<TreeIndices<T>>
  getKey: (node: T) => K
  getSearchText: (node: T) => string
  scrollToKey: (key: K, align: 'center') => void
  selectionStrategy: Ref<SelectionHandler<NodeIndex>>
  runsSearchInWorker?: boolean
}) {
  const { indices, getKey, getSearchText, scrollToKey, selectionStrategy } = options

  const structure = computed(() => createStructure(indices.value, getKey))

  const query = ref('')
  const searchViewMode = ref<SearchViewMode>('tree')

  const hasQuery = computed(() => query.value.trim().length > 0)

  const { runSearch, searchMatched, searchMatchAncestors } = useSearch({
    structure,
    query,
    getSearchText,
    worker: options.runsSearchInWorker,
  })

  const viewStrategyName = computed<ViewStrategyName>(() => {
    if (!hasQuery.value) return 'plain'
    if (searchViewMode.value === 'tree-filter') return 'compact'
    return 'filtered'
  })

  const searchDeps = { matched: searchMatched, matchAncestors: searchMatchAncestors }
  const viewByStrategy: Record<ViewStrategyName, () => ViewPresentationPlan> = {
    plain: () => viewStrategies.plain(),
    filtered: () => viewStrategies.filtered(searchDeps),
    compact: () => viewStrategies.compact(searchDeps),
  }
  const plan = computed(() => viewByStrategy[viewStrategyName.value]())

  const projection = useTreeProjection({
    structure,
    plan,
  })

  const {
    checked,
    indeterminate,
    selectedSource,
    getCheckedKeys,
    setChecked,
    toggleChecked,
    setCheckedKeys,
  } = useSelection({
    structure,
    selectionStrategy,
  })

  function toggleOpened(key: K) {
    projection.toggleOpened(key)
  }

  function setOpenedKeys(
    keys: readonly K[],
    strategy: SelectionHandler<NodeIndex> = selectionStrategy.value,
  ) {
    return projection.setOpenedKeys(keys, strategy)
  }

  function onExpandAll(on: boolean) {
    projection.onExpandAll(on)
  }

  watch(structure, () => onExpandAll(false))

  const cursor = useCursor({ matched: searchMatched, structure })
  const { currentKey, matchCount, currentMatchIndex } = cursor

  function buildRowVM(row: TreeProjectionRow<T, K>) {
    return {
      node: row.node,
      key: row.key,
      depth: row.depth,
      checked: checked.value.has(row.index),
      indeterminate: indeterminate.value.has(row.index),
      opened: row.opened,
      matched: row.marked,
      matchAncestor: row.markedAncestor,
      active: row.key === currentKey.value,
      canExpand: row.canExpand,
      disabled: false,
      guides: row.guides,
    }
  }

  const source = computed(() => projection.getSource(buildRowVM))

  const rowCount = computed(() => source.value.length)

  function scrollToCurrent() {
    const key = currentKey.value
    if (key === undefined) return
    void nextTick(() => scrollToKey(key, 'center'))
  }

  function openBranchTo() {
    const key = currentKey.value
    if (key === undefined) return
    projection.openPathTo(key)
    void nextTick(scrollToCurrent)
  }

  function goToPrev() {
    cursor.goToPrev()
    openBranchTo()
  }

  function goToNext() {
    cursor.goToNext()
    openBranchTo()
  }

  function goToFirst() {
    cursor.goToFirst()
    openBranchTo()
  }

  watch(searchViewMode, async () => {
    if (currentKey.value === undefined) return
    await nextTick()
    openBranchTo()
  })

  watch(searchMatched, goToFirst)

  function onQuery(value: string) {
    query.value = value
    runSearch()
  }

  return {
    structure,
    source,
    rowCount,
    query,
    onQuery,
    searchViewMode,
    expandAll: projection.expandAll,
    onExpandAll,
    currentMatchIndex,
    matchCount,
    goToPrev,
    goToNext,
    selectedSource,
    getCheckedKeys,
    setCheckedKeys,
    openedIndices: projection.openedIndices,
    getOpenedKeys: projection.getOpenedKeys,
    setOpenedKeys,
    toggleChecked,
    toggleOpened,
    setChecked,
  }
}
