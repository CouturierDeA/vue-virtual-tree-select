import { computed, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import {
  windowGuides,
  type NodeIndex,
  type NodeIndexSet,
  type TreeStructure,
  type TreeNodeGuides,
} from '@/tree-builder-core'
import { keyMappedRowSource, type RowSource } from '@/virtual-list/rowSource'
import { useTreeExpansion } from '@/composables/tree/useTreeExpansion'

export type VisibilityPredicates = {
  descend: (index: NodeIndex) => boolean
  show?: (index: NodeIndex) => boolean
}

export type TreeProjectionVisibility = (
  openedSet: Readonly<Ref<ReadonlySet<NodeIndex>>>,
) => VisibilityPredicates

type ViewMarkers = {
  marked?: Readonly<Ref<NodeIndexSet>>
  markedAncestors?: Readonly<Ref<NodeIndexSet>>
}

export type TreeProjectionRow<T, K> = {
  index: NodeIndex
  node: T
  key: K
  depth: number
  opened: boolean
  canExpand: boolean
  marked: boolean
  markedAncestor: boolean
  guides?: TreeNodeGuides
}

export type TreeProjectionSourceContext<T, K> = {
  structure: TreeStructure<T, K>
  visibleCounts: () => Int32Array
  visibility: VisibilityPredicates
  rowProjectionOf: (index: NodeIndex) => TreeProjectionRow<T, K>
  toKeyedSource<Row>(source: RowSource<Row, NodeIndex>): RowSource<Row, K>
}

/**
 * Live presentation plan produced by a view strategy. It is ref-backed, not a snapshot:
 * markers/visibility read `.value` lazily at render/refresh so search updates do not recreate
 * predicates (and so do not trigger a redundant counts rebuild).
 */
export type ViewPresentationPlan = {
  createSource: <T, K, Row>(
    ctx: TreeProjectionSourceContext<T, K>,
    rowOf: (row: TreeProjectionRow<T, K>) => Row,
  ) => RowSource<Row, K>
  markers?: ViewMarkers
  visibility?: TreeProjectionVisibility
  openAncestors?: Readonly<Ref<NodeIndexSet>>
}

export function useTreeProjection<T, K>(options: {
  structure: ComputedRef<TreeStructure<T, K>>
  plan: Readonly<Ref<ViewPresentationPlan>>
}) {
  const { structure, plan } = options
  const EMPTY_INDEX_SET: NodeIndexSet = new Set<NodeIndex>()

  const openedSet = shallowRef<ReadonlySet<NodeIndex>>(new Set())
  const visibleCounts = shallowRef(new Int32Array(0))
  const activePlan = computed<ViewPresentationPlan>(() => plan.value)
  const defaultVisibility: VisibilityPredicates = {
    descend: (index) => openedSet.value.has(index),
  }

  const visibility = computed<VisibilityPredicates>(
    () => activePlan.value.visibility?.(openedSet) ?? defaultVisibility,
  )

  function refresh() {
    const { descend, show } = visibility.value
    visibleCounts.value = structure.value.counts(descend, show)
  }

  const expansion = useTreeExpansion({
    structure,
    openedSet,
    visibleCounts,
    refreshVisibleRows: refresh,
  })

  function syncVisibleRows() {
    return expansion.syncVisibleRows(activePlan.value.openAncestors?.value)
  }

  function getOpenedKeys() {
    return structure.value.toKeys(openedSet.value)
  }

  function markersOf(plan: ViewPresentationPlan) {
    return {
      marked: plan.markers?.marked?.value ?? EMPTY_INDEX_SET,
      markedAncestors: plan.markers?.markedAncestors?.value ?? EMPTY_INDEX_SET,
    }
  }

  function rowProjectionOf(index: NodeIndex, plan: ViewPresentationPlan): TreeProjectionRow<T, K> {
    const struct = structure.value
    const { marked, markedAncestors } = markersOf(plan)

    return {
      index,
      node: struct.getNode(index),
      key: struct.toKey(index),
      depth: struct.getDepthOf(index),
      opened: expansion.isOpened(index),
      canExpand: struct.hasChildren(index),
      marked: marked.has(index),
      markedAncestor: markedAncestors.has(index),
      guides: windowGuides(struct.indices, visibleCounts.value, marked, markedAncestors, index),
    }
  }

  function toKeyedSource<Row>(source: RowSource<Row, NodeIndex>) {
    const struct = structure.value
    return keyMappedRowSource<Row, NodeIndex, K>(source, {
      toOuterKey: (index) => struct.toKey(index),
      toInnerKey: (key) => struct.toIndex(key),
    })
  }

  function getSource<Row>(rowOf: (row: TreeProjectionRow<T, K>) => Row) {
    const plan = activePlan.value
    return plan.createSource(
      {
        structure: structure.value,
        visibleCounts: () => visibleCounts.value,
        visibility: visibility.value,
        rowProjectionOf: (index) => rowProjectionOf(index, plan),
        toKeyedSource,
      },
      rowOf,
    )
  }

  watch([structure, visibility], refresh, { immediate: true })
  watch(() => activePlan.value.openAncestors?.value, () => syncVisibleRows())

  return {
    expandAll: expansion.expandAll,
    openedIndices: openedSet,
    getSource,
    getOpenedKeys,
    setOpenedKeys: expansion.setOpenedKeys,
    openPathTo: expansion.openPathTo,
    openPathsTo: expansion.openPathsTo,
    toggleOpened: expansion.toggleOpened,
    onExpandAll: expansion.onExpandAll,
  }
}
