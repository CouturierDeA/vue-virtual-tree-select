import type { Ref } from 'vue'
import { fromCounts, type NodeIndexSet, type OrderedNodeIndexSet } from '@/tree-builder-core'
import type {
  TreeProjectionRow,
  TreeProjectionSourceContext,
  ViewPresentationPlan,
} from '@/composables/tree/useTreeProjection'

function createTreeSource<T, K, Row>(
  ctx: TreeProjectionSourceContext<T, K>,
  rowOf: (row: TreeProjectionRow<T, K>) => Row,
) {
  const inner = fromCounts(ctx.structure.indices, ctx.visibleCounts, {
    rowOf: (index) => rowOf(ctx.rowProjectionOf(index)),
    isOpen: ctx.visibility.descend,
  })
  return ctx.toKeyedSource(inner)
}

export type ViewStrategy<Deps = void> = (deps: Deps) => ViewPresentationPlan

export function defineViewStrategy<Deps = void>(strategy: ViewStrategy<Deps>) {
  return strategy
}

export type SearchViewDeps = {
  matched: Readonly<Ref<OrderedNodeIndexSet>>
  matchAncestors: Readonly<Ref<NodeIndexSet>>
}

function searchMarkers(deps: SearchViewDeps) {
  return { marked: deps.matched, markedAncestors: deps.matchAncestors }
}

export const plain = defineViewStrategy<void>(() => ({
  createSource: createTreeSource,
}))

export const filtered = defineViewStrategy<SearchViewDeps>((deps) => ({
  createSource: createTreeSource,
  markers: searchMarkers(deps),
  openAncestors: deps.matchAncestors,
}))

export const compact = defineViewStrategy<SearchViewDeps>((deps) => ({
  createSource: createTreeSource,
  markers: searchMarkers(deps),
  openAncestors: deps.matchAncestors,
  visibility: (openedSet) => ({
    descend: (index) => openedSet.value.has(index) && deps.matchAncestors.value.has(index),
    show: (index) => deps.matched.value.has(index) || deps.matchAncestors.value.has(index),
  }),
}))

export const viewStrategies = { plain, filtered, compact }
export type ViewStrategyName = keyof typeof viewStrategies
