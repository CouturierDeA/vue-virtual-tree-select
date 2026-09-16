import type { NodeIndex, TreeIndices, VisibleIndex } from '@/tree-builder-core/indices/treeIndices'

export type VisibleTopology = Pick<
  TreeIndices<unknown>,
  'parent' | 'childStart' | 'childIndex' | 'roots'
> &
  Partial<Pick<TreeIndices<unknown>, 'subtreeSize'>>

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
  if (!Number.isInteger(position) || position < 0) return -1
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
    // A fully visible subtree is a contiguous interval in pre-order storage.
    if (counts[node] === topo.subtreeSize?.[node]) return node + p
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

/** Stream a visible window without repeated root searches or a flattened tree. */
export function* visibleKeysInRange(
  topo: VisibleTopology,
  counts: Int32Array,
  start: VisibleIndex,
  count: number,
): Generator<NodeIndex> {
  if (!Number.isInteger(start) || start < 0 || !(count > 0)) return
  const { childStart, childIndex, roots, subtreeSize } = topo
  type Siblings = { nodes: ArrayLike<number>; cursor: number; end: number }
  const pending: Siblings[] = []
  let group: Siblings = { nodes: roots, cursor: 0, end: roots.length }
  let skip = start
  let remaining = Math.floor(count)
  if (remaining === 0) return

  for (;;) {
    if (group.cursor === group.end) {
      const next = pending.pop()
      if (!next) return
      group = next
      continue
    }
    const node = group.nodes[group.cursor++]!
    const visible = counts[node]
    if (visible <= skip) {
      skip -= visible
      continue
    }
    if (visible === subtreeSize?.[node]) {
      const take = Math.min(visible - skip, remaining)
      for (let i = node + skip; i < node + skip + take; i++) yield i
      remaining -= take
      skip = 0
      if (remaining === 0) return
      continue
    }
    if (skip === 0) {
      yield node
      if (--remaining === 0) return
    } else {
      skip--
    }
    if (visible > 1) {
      // Unary chains need no stack entry: there are no siblings to revisit.
      if (group.cursor < group.end) pending.push(group)
      group = { nodes: childIndex, cursor: childStart[node], end: childStart[node + 1] }
    }
  }
}

export function collectVisibleSlice(
  topo: VisibleTopology,
  counts: Int32Array,
  start: VisibleIndex,
  count: number,
) {
  return Array.from(visibleKeysInRange(topo, counts, start, count))
}
