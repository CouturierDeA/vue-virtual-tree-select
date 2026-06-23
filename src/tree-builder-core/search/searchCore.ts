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
  structure: Pick<StructureShape<K>, 'getAncestorsOf'>,
): Set<K> {
  const ancestors = new Set<K>()
  for (const key of matched) {
    for (const ancestor of structure.getAncestorsOf(key)) ancestors.add(ancestor)
  }
  return ancestors
}
