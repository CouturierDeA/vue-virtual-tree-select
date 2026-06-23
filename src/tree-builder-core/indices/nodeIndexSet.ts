import type { NodeIndex } from '@/tree-builder-core/indices/treeIndices'

export interface NodeIndexSet extends Iterable<NodeIndex> {
  readonly size: number
  has(index: NodeIndex): boolean
}

export interface OrderedNodeIndexSet extends NodeIndexSet {
  readonly length: number
  at(position: number): NodeIndex | undefined
  positionOf(index: NodeIndex): number
}

export function orderedNodeIndexSet(indices: Int32Array): OrderedNodeIndexSet {
  let lookup: Set<NodeIndex> | undefined

  function ensureLookup() {
    if (lookup) return lookup
    lookup = new Set<NodeIndex>()
    for (let i = 0; i < indices.length; i++) lookup.add(indices[i]!)
    return lookup
  }

  return {
    get size() {
      return indices.length
    },
    get length() {
      return indices.length
    },
    has: (index) => ensureLookup().has(index),
    at: (position) => {
      if (position < 0 || position >= indices.length) return undefined
      return indices[position]
    },
    positionOf: (index) => {
      for (let i = 0; i < indices.length; i++) {
        if (indices[i] === index) return i
      }
      return -1
    },
    *[Symbol.iterator]() {
      for (let i = 0; i < indices.length; i++) yield indices[i]!
    },
  }
}

export const EMPTY_ORDERED_NODE_INDEX_SET = orderedNodeIndexSet(new Int32Array(0))
