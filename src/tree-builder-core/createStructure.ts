import type { NodeIndex, TreeIndices } from '@/tree-builder-core/indices/treeIndices'
import { applyToggle, buildVisibleCounts } from '@/tree-builder-core/visible/visibleIndexCore'
import { matchAncestors } from '@/tree-builder-core/search/searchCore'
import { expandableKeys, openedWithPath } from '@/tree-builder-core/expansion/expansionCore'

export function createStructure<T, K = T>(
  indices: TreeIndices<T>,
  getKey: (node: T) => K = (node) => node as unknown as K,
) {
  const lens = createKeyLens(indices.nodes, getKey)
  const nav = createIndexNavigation(indices)
  const visible = createVisibleProjectionOps(indices)
  const search = createSearchOps(nav)
  const expansion = createExpansionOps(nav)

  return {
    indices,

    keys: nav.keys,
    descend: nav.descend,
    filter: nav.filter,
    getChildrenOf: nav.getChildrenOf,
    getDescendantsOf: nav.getDescendantsOf,
    getAncestorsOf: nav.getAncestorsOf,
    getDepthOf: nav.getDepthOf,
    subtreeSize: nav.subtreeSize,
    hasChildren: nav.hasChildren,
    getNode: nav.getNode,

    toIndices: lens.toIndices,
    toKeys: lens.toKeys,
    toKey: lens.toKey,
    toIndex: lens.toIndex,

    counts: visible.counts,
    applyToggle: visible.applyToggle,

    matchAncestors: search.matchAncestors,

    expandableKeys: expansion.expandableKeys,
    openedWithPath: expansion.openedWithPath,
  }
}

function createKeyLens<T, K>(nodes: readonly T[], getKey: (node: T) => K) {
  const n = nodes.length
  const nodeAt = createNodeAccessor(nodes)
  let keyIndex: Map<K, NodeIndex> | undefined

  function indexByKey() {
    if (!keyIndex) {
      keyIndex = new Map<K, NodeIndex>()
      for (let index = 0; index < n; index++) keyIndex.set(getKey(nodeAt(index)), index)
    }
    return keyIndex
  }

  function toIndices(keys: readonly K[]) {
    const map = indexByKey()
    const out: NodeIndex[] = []
    for (const key of keys) {
      const index = map.get(key)
      if (index !== undefined) out.push(index)
    }
    return out
  }

  function toKeys(indexes: Iterable<NodeIndex>) {
    return Array.from(indexes, (index) => getKey(nodeAt(index)))
  }

  function toKey(index: NodeIndex) {
    return getKey(nodeAt(index))
  }

  function toIndex(key: K) {
    return indexByKey().get(key)
  }

  return { toIndices, toKeys, toKey, toIndex }
}

function createIndexNavigation<T>(indices: TreeIndices<T>) {
  const { nodes, parent, depth, subtreeSize, childStart, childIndex, roots } = indices
  const n = nodes.length
  const nodeAt = createNodeAccessor(nodes)

  function getChildrenOf(index: NodeIndex) {
    const out: NodeIndex[] = []
    for (let c = childStart[index]; c < childStart[index + 1]; c++) out.push(childIndex[c])
    return out
  }

  function getAncestorsOf(index: NodeIndex) {
    const out: NodeIndex[] = []
    let p = parent[index]
    while (p >= 0) {
      out.push(p)
      p = parent[p]
    }
    return out
  }

  function getDescendantsOf(index: NodeIndex) {
    const out: NodeIndex[] = []
    const end = index + subtreeSize[index]
    for (let i = index + 1; i < end; i++) out.push(i)
    return out
  }

  function descend(shouldDescend: (index: NodeIndex) => boolean) {
    const out: NodeIndex[] = []
    const stack: NodeIndex[] = []
    for (let i = roots.length - 1; i >= 0; i--) stack.push(roots[i])
    while (stack.length > 0) {
      const index = stack.pop() as NodeIndex
      out.push(index)
      if (!shouldDescend(index)) continue
      for (let c = childStart[index + 1] - 1; c >= childStart[index]; c--) {
        stack.push(childIndex[c])
      }
    }
    return out
  }

  function filter(keep: (index: NodeIndex) => boolean) {
    const out: NodeIndex[] = []
    for (let i = 0; i < n; i++) {
      if (keep(i)) out.push(i)
    }
    return out
  }

  return {
    keys: () => nodes.keys(),
    descend,
    filter,
    getChildrenOf,
    getDescendantsOf,
    getAncestorsOf,
    getDepthOf: (index: NodeIndex) => depth[index],
    subtreeSize: (index: NodeIndex) => subtreeSize[index],
    hasChildren: (index: NodeIndex) => childStart[index + 1] > childStart[index],
    getNode: nodeAt,
  }
}

type IndexNavigation<T> = ReturnType<typeof createIndexNavigation<T>>

function createNodeAccessor<T>(nodes: readonly T[]) {
  return (index: NodeIndex) => {
    if (index < 0 || index >= nodes.length) {
      throw new RangeError(`Node index out of bounds: ${index}`)
    }
    return nodes[index] as T
  }
}

function createVisibleProjectionOps(indices: TreeIndices<unknown>) {
  return {
    counts: (
      shouldDescend: (index: NodeIndex) => boolean,
      shouldShow?: (index: NodeIndex) => boolean,
    ) =>
      buildVisibleCounts(indices, shouldDescend, shouldShow),
    applyToggle: (counts: Int32Array, index: NodeIndex, nowOpen: boolean) =>
      applyToggle(indices, counts, index, nowOpen),
  }
}

function createSearchOps(nav: Pick<IndexNavigation<unknown>, 'getAncestorsOf'>) {
  return {
    matchAncestors: (matched: Iterable<NodeIndex>) => matchAncestors(matched, nav),
  }
}

function createExpansionOps(
  nav: Pick<
    IndexNavigation<unknown>,
    'keys' | 'getDescendantsOf' | 'getAncestorsOf' | 'hasChildren'
  >,
) {
  return {
    expandableKeys: () => expandableKeys(nav),
    openedWithPath: (opened: ReadonlySet<NodeIndex>, index: NodeIndex) =>
      openedWithPath(opened, nav, index),
  }
}

export type TreeStructure<T, K = T> = ReturnType<typeof createStructure<T, K>>
