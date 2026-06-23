import type {
  NodeIndex,
  TreeIndices,
  VisibleIndex,
} from '@/tree-builder-core/indices/treeIndices'

export type VisibleTopology = Pick<
  TreeIndices<unknown>,
  'parent' | 'childStart' | 'childIndex' | 'roots'
>

export function buildVisibleCounts(
  topo: VisibleTopology,
  shouldDescend: (index: NodeIndex) => boolean,
  shouldShow?: (index: NodeIndex) => boolean,
) {
  const { parent } = topo
  const n = parent.length
  const counts = new Int32Array(n)
  if (shouldShow) {
    for (let i = 0; i < n; i++) counts[i] = shouldShow(i) ? 1 : 0
  } else {
    counts.fill(1)
  }
  for (let i = n - 1; i >= 1; i--) {
    const p = parent[i]
    if (p >= 0 && shouldDescend(p)) counts[p] += counts[i]
  }
  return counts
}

export function totalVisible(counts: Int32Array, roots: readonly number[]) {
  let total = 0
  for (let r = 0; r < roots.length; r++) total += counts[roots[r]!]
  return total
}

export function applyToggle(
  topo: VisibleTopology,
  counts: Int32Array,
  index: NodeIndex,
  nowOpen: boolean,
) {
  const { parent, childStart, childIndex } = topo
  let next = 1
  if (nowOpen) {
    for (let c = childStart[index]; c < childStart[index + 1]; c++) {
      next += counts[childIndex[c]]
    }
  }
  const delta = next - counts[index]
  if (delta === 0) return 0
  counts[index] = next
  for (let a = parent[index]; a >= 0; a = parent[a]) counts[a] += delta
  return delta
}

export function keyAtVisibleIndex(
  topo: VisibleTopology,
  counts: Int32Array,
  position: VisibleIndex,
): NodeIndex {
  const { childStart, childIndex, roots } = topo
  if (!(position >= 0)) return -1
  let p = position
  let node = -1
  for (let r = 0; r < roots.length; r++) {
    const root = roots[r]!
    const rc = counts[root]
    if (p < rc) {
      node = root
      break
    }
    p -= rc
  }
  if (node < 0) return -1
  for (;;) {
    if (p === 0) return node
    p -= 1
    let moved = false
    for (let c = childStart[node]; c < childStart[node + 1]; c++) {
      const child = childIndex[c]
      const cc = counts[child]
      if (p < cc) {
        node = child
        moved = true
        break
      }
      p -= cc
    }
    if (!moved) return -1
  }
}

export function visibleIndexOf(
  topo: VisibleTopology,
  counts: Int32Array,
  index: NodeIndex,
): VisibleIndex {
  const { parent, childStart, childIndex, roots } = topo
  if (!(index >= 0 && index < parent.length)) return -1
  let position = 0
  let cur = index
  for (;;) {
    const p = parent[cur]
    if (p < 0) {
      for (let r = 0; r < roots.length; r++) {
        if (roots[r] === cur) break
        position += counts[roots[r]!]
      }
      return position
    }
    if (counts[p] === 1) return -1
    position += 1
    for (let c = childStart[p]; c < childStart[p + 1]; c++) {
      const sibling = childIndex[c]
      if (sibling === cur) break
      position += counts[sibling]
    }
    cur = p
  }
}

export function collectVisibleSlice(
  topo: VisibleTopology,
  counts: Int32Array,
  start: VisibleIndex,
  count: number,
) {
  const { childStart, childIndex, roots } = topo
  const end = start + count
  const out: NodeIndex[] = []
  if (count <= 0) return out

  const visit = (node: NodeIndex, nodePos: number) => {
    if (out.length >= count) return
    if (nodePos >= start) out.push(node)
    if (counts[node] === 1) return
    let childPos = nodePos + 1
    for (let c = childStart[node]; c < childStart[node + 1]; c++) {
      if (out.length >= count) return
      const child = childIndex[c]
      const cc = counts[child]
      if (childPos < end && childPos + cc > start) visit(child, childPos)
      childPos += cc
      if (childPos >= end) return
    }
  }

  let pos = 0
  for (let r = 0; r < roots.length && out.length < count; r++) {
    const root = roots[r]!
    const rc = counts[root]
    if (pos < end && pos + rc > start) visit(root, pos)
    pos += rc
    if (pos >= end) break
  }
  return out
}
