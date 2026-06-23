import {
  finalizeIndices,
  type NodeIndex,
  type TreeIndices,
} from '@/tree-builder-core/indices/treeIndices'

/** Adapter for a flat list with parent pointers; a missing or unknown parent id means a root. */
export interface FlatSchema<T, K> {
  getId: (node: T) => K
  getParentId: (node: T) => K | null | undefined
}

/**
 * Bucket children by parent id (source order), then DFS from roots to emit pre-order —
 * the same shape as buildIndicesFromNested. The `seen` guard makes parent cycles terminate.
 */
export function buildIndicesFromFlat<T extends object, K>(
  data: readonly T[],
  schema: FlatSchema<T, K>,
): TreeIndices<T> {
  const { getId, getParentId } = schema

  const known = new Set<K>()
  for (const node of data) known.add(getId(node))

  const childrenByParent = new Map<K, T[]>()
  const rootNodes: T[] = []
  for (const node of data) {
    const parentId = getParentId(node)
    if (parentId == null || !known.has(parentId)) {
      rootNodes.push(node)
      continue
    }
    const bucket = childrenByParent.get(parentId)
    if (bucket) bucket.push(node)
    else childrenByParent.set(parentId, [node])
  }

  const nodes: T[] = []
  const parentList: NodeIndex[] = []
  const depthList: number[] = []
  const roots: NodeIndex[] = []
  const seen = new Set<K>()

  type Frame = { node: T; parent: NodeIndex; depth: number }
  const stack: Frame[] = []
  for (let i = rootNodes.length - 1; i >= 0; i--) {
    stack.push({ node: rootNodes[i] as T, parent: -1, depth: 0 })
  }
  while (stack.length > 0) {
    const frame = stack.pop() as Frame
    const id = getId(frame.node)
    if (seen.has(id)) continue
    seen.add(id)

    const index = nodes.length
    nodes.push(frame.node)
    parentList.push(frame.parent)
    depthList.push(frame.depth)
    if (frame.parent === -1) roots.push(index)

    const kids = childrenByParent.get(id) ?? []
    for (let i = kids.length - 1; i >= 0; i--) {
      stack.push({ node: kids[i] as T, parent: index, depth: frame.depth + 1 })
    }
  }

  return finalizeIndices(nodes, parentList, depthList, roots)
}
