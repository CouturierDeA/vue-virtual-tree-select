import type { NodeIndex, TreeIndices } from '@/tree-builder-core/indices/treeIndices'
import type { NodeIndexSet } from '@/tree-builder-core/indices/nodeIndexSet'
import type { TreeNodeGuides } from '@/tree-builder-core/types'

export function windowGuides(
  indices: TreeIndices<unknown>,
  counts: Int32Array,
  matched: NodeIndexSet,
  matchAnc: NodeIndexSet,
  index: NodeIndex,
): TreeNodeGuides {
  const depth = indices.depth[index]
  if (depth === 0) return { verticals: [], connector: null }
  const { parent, childStart, childIndex, roots } = indices

  const isOnPath = (nodeIndex: NodeIndex) => matched.has(nodeIndex) || matchAnc.has(nodeIndex)

  const hasVisibleLaterSibling = (node: NodeIndex) => {
    const p = parent[node]
    if (p < 0) {
      let seen = false
      for (let r = 0; r < roots.length; r++) {
        if (roots[r] === node) seen = true
        else if (seen && counts[roots[r]!] > 0) return true
      }
      return false
    }
    let seen = false
    for (let c = childStart[p]; c < childStart[p + 1]; c++) {
      const sibling = childIndex[c]
      if (sibling === node) seen = true
      else if (seen && counts[sibling] > 0) return true
    }
    return false
  }

  const hasOnPathLaterSibling = (node: NodeIndex) => {
    const p = parent[node]
    if (p < 0) {
      let seen = false
      for (let r = 0; r < roots.length; r++) {
        if (roots[r] === node) seen = true
        else if (seen && isOnPath(roots[r]!)) return true
      }
      return false
    }
    let seen = false
    for (let c = childStart[p]; c < childStart[p + 1]; c++) {
      const sibling = childIndex[c]
      if (sibling === node) seen = true
      else if (seen && isOnPath(sibling)) return true
    }
    return false
  }

  const hasOnPathChild = (node: NodeIndex) => {
    for (let c = childStart[node]; c < childStart[node + 1]; c++) {
      if (isOnPath(childIndex[c])) return true
    }
    return false
  }

  const ancestors: NodeIndex[] = []
  let cur = index
  for (let d = depth; d > 0; d--) {
    const p = parent[cur]
    ancestors.push(p)
    cur = p
  }
  const verticals: { draw: boolean; active: boolean }[] = []
  for (let channel = 0; channel <= depth - 2; channel++) {
    const ancestor = ancestors[depth - 2 - channel]!
    verticals.push({ draw: hasVisibleLaterSibling(ancestor), active: hasOnPathLaterSibling(ancestor) })
  }
  const onPath = isOnPath(index)
  const laterSiblingActive = hasOnPathLaterSibling(index)
  const open = counts[index] > 1
  return {
    verticals,
    connector: {
      hasDown: hasVisibleLaterSibling(index),
      upActive: onPath || laterSiblingActive,
      downActive: laterSiblingActive,
      elbowActive: onPath,
      descent: open,
      descentActive: open && hasOnPathChild(index),
    },
  }
}
