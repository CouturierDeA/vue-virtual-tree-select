/**
 * Dense pre-order node index (0..n-1). This is an internal storage address,
 * not the public node key used by application code.
 */
export type NodeIndex = number

/**
 * Position inside a visible row projection. This is distinct from NodeIndex:
 * closing/opening branches changes visible positions, but not node indices.
 */
export type VisibleIndex = number

/**
 * Tree as dense pre-order indices over flat typed arrays — cache-friendly,
 * int-indexed, zero-copy transferable to a worker. Adapters own the input shape.
 */
export interface TreeIndices<T> {
  nodes: T[]
  parent: Int32Array // parent NodeIndex, -1 for roots
  depth: Uint16Array
  subtreeSize: Int32Array
  // Children in CSR form: children of index are childIndex[childStart[index] .. childStart[index + 1]).
  childStart: Int32Array // length n + 1
  childIndex: Int32Array
  roots: NodeIndex[]
}

/**
 * Derive subtreeSize and the children CSR from a valid pre-order (parent before
 * its descendants). Adapters supply nodes/parent/depth/roots; this fills the rest.
 */
export function finalizeIndices<T>(
  nodes: T[],
  parentList: NodeIndex[],
  depthList: number[],
  roots: NodeIndex[],
): TreeIndices<T> {
  const n = nodes.length
  const parent = Int32Array.from(parentList)
  const depth = Uint16Array.from(depthList)

  // Pre-order keeps children after their parent, so one reverse sweep folds each subtree in.
  const subtreeSize = new Int32Array(n).fill(1)

  for (let i = n - 1; i >= 1; i--) {
    const p = parent[i]
    if (p >= 0) subtreeSize[p] += subtreeSize[i]
  }

  // CSR: count children per parent, prefix-sum to offsets, then scatter in source order.
  const childStart = new Int32Array(n + 1)
  for (let i = 0; i < n; i++) {
    if (parent[i] >= 0) childStart[parent[i] + 1]++
  }
  for (let i = 0; i < n; i++) childStart[i + 1] += childStart[i]
  const childIndex = new Int32Array(n > 0 ? childStart[n] : 0)
  const cursor = Int32Array.from(childStart)
  for (let i = 0; i < n; i++) {
    const p = parent[i]
    if (p >= 0) {
      childIndex[cursor[p]] = i
      cursor[p]++
    }
  }

  return { nodes, parent, depth, subtreeSize, childStart, childIndex, roots }
}
