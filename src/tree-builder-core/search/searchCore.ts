import type { StructureShape } from '@/tree-builder-core/types'

export function match(texts: readonly string[], q: string): Int32Array {
  const out: number[] = []
  if (q.length > 0) {
    for (let i = 0; i < texts.length; i++) {
      if (texts[i]!.includes(q)) out.push(i)
    }
  }
  return Int32Array.from(out)
}

export function matchAncestors<K>(
  matched: Iterable<K>,
  structure: Pick<StructureShape<K>, 'getAncestorsOf' | 'getParentOf'>,
): Set<K> {
  const ancestors = new Set<K>()
  if (structure.getParentOf) {
    for (const key of matched) {
      let ancestor = structure.getParentOf(key)
      // A visited ancestor already brought its entire path into this result.
      while (ancestor !== undefined && !ancestors.has(ancestor)) {
        ancestors.add(ancestor)
        ancestor = structure.getParentOf(ancestor)
      }
    }
    return ancestors
  }
  // Keep support for custom structures exposing only the original array API.
  for (const key of matched) {
    for (const ancestor of structure.getAncestorsOf(key)) ancestors.add(ancestor)
  }
  return ancestors
}
