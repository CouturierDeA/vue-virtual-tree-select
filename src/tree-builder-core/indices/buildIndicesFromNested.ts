import {
  finalizeIndices,
  type NodeIndex,
  type TreeIndices,
} from '@/tree-builder-core/indices/treeIndices'

/** Adapter for already-nested data: each node yields its children directly. */
export interface NestedSchema<T> {
  getChildren: (node: T) => readonly T[] | undefined
}

/** Stack DFS emitting nodes in pre-order (parent before descendants), then finalises the index arrays. */
export function buildIndicesFromNested<T extends object>(
  data: readonly T[],
  schema: NestedSchema<T>,
): TreeIndices<T> {
  const getChildren = schema.getChildren
  const nodes: T[] = []
  const parentList: NodeIndex[] = []
  const depthList: number[] = []
  const roots: NodeIndex[] = []

  type Frame = { node: T; parent: NodeIndex; depth: number }
  const stack: Frame[] = []
  for (let i = data.length - 1; i >= 0; i--) {
    const node = data[i]
    if (node === undefined) continue
    stack.push({ node, parent: -1, depth: 0 })
  }
  while (stack.length > 0) {
    const frame = stack.pop() as Frame
    const index = nodes.length
    nodes.push(frame.node)
    parentList.push(frame.parent)
    depthList.push(frame.depth)
    if (frame.parent === -1) roots.push(index)
    const kids = getChildren(frame.node) ?? []
    for (let i = kids.length - 1; i >= 0; i--) {
      stack.push({ node: kids[i] as T, parent: index, depth: frame.depth + 1 })
    }
  }

  return finalizeIndices(nodes, parentList, depthList, roots)
}
