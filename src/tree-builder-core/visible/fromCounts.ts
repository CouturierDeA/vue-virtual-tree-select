import type { RowSource } from '@/virtual-list/rowSource'
import type { NodeIndex } from '@/tree-builder-core/indices/treeIndices'
import {
  keyAtVisibleIndex,
  totalVisible,
  visibleIndexOf,
  type VisibleTopology,
} from '@/tree-builder-core/visible/visibleIndexCore'

export function fromCounts<Row>(
  topo: VisibleTopology,
  getCounts: () => Int32Array,
  adapter: {
    rowOf: (index: NodeIndex) => Row
    isOpen: (index: NodeIndex) => boolean
  },
): RowSource<Row, NodeIndex> {
  const { rowOf, isOpen } = adapter
  const { parent, roots } = topo
  return {
    get length() {
      return totalVisible(getCounts(), roots)
    },
    keyAt: (index) => keyAtVisibleIndex(topo, getCounts(), index),
    rowAt: (index) => rowOf(keyAtVisibleIndex(topo, getCounts(), index)),
    indexOf: (key) => visibleIndexOf(topo, getCounts(), key),
    fallbackFor: (key) => nearestVisibleAncestor(parent, isOpen, key),
  }
}

function nearestVisibleAncestor(
  parent: Int32Array,
  isOpen: (index: NodeIndex) => boolean,
  index: NodeIndex,
): NodeIndex | undefined {
  if (!(index >= 0 && index < parent.length)) return undefined
  const path: NodeIndex[] = []
  let cur = parent[index]
  while (cur >= 0) {
    path.push(cur)
    cur = parent[cur]
  }
  let result: number | undefined
  for (let i = path.length - 1; i >= 0; i--) {
    if (i === path.length - 1 || isOpen(path[i + 1]!)) result = path[i]
    else break
  }
  return result
}
