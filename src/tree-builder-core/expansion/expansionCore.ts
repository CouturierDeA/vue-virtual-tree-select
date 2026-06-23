import type { StructureShape } from '@/tree-builder-core/types'

export function expandableKeys<K>(
  structure: Pick<StructureShape<K>, 'keys' | 'hasChildren'>,
): Set<K> {
  const out = new Set<K>()
  for (const key of structure.keys()) {
    if (structure.hasChildren(key)) out.add(key)
  }
  return out
}

export function toggledOpen<K>(
  opened: ReadonlySet<K>,
  structure: Pick<StructureShape<K>, 'getDescendantsOf' | 'hasChildren'>,
  key: K,
): Set<K> {
  const next = new Set(opened)
  if (!structure.hasChildren(key)) return next
  if (next.has(key)) {
    next.delete(key)
    for (const descendant of structure.getDescendantsOf(key)) next.delete(descendant)
  } else {
    next.add(key)
  }
  return next
}

export function openedWithPath<K>(
  opened: ReadonlySet<K>,
  structure: Pick<StructureShape<K>, 'getAncestorsOf'>,
  key: K,
): ReadonlySet<K> {
  let next: Set<K> | undefined
  for (const ancestor of structure.getAncestorsOf(key)) {
    if (opened.has(ancestor)) continue
    if (next === undefined) next = new Set(opened)
    next.add(ancestor)
  }
  if (next === undefined) return opened
  return next
}
