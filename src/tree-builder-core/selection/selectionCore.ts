import type {
  ExportContext,
  SelectionContext,
  SelectionHandler,
  StructureShape,
} from '@/tree-builder-core/types'

export type SelectionStructure<K> = Pick<
  StructureShape<K>,
  'getChildrenOf' | 'getDescendantsOf' | 'getAncestorsOf'
>

export function toggledSelection<K>(
  checked: ReadonlySet<K>,
  indeterminate: ReadonlySet<K>,
  structure: SelectionStructure<K>,
  isDisabled: (key: K) => boolean,
  handler: SelectionHandler<K>,
  key: K,
): { checked: Set<K>; indeterminate: Set<K> } {
  const nextChecked = new Set(checked)
  const nextIndeterminate = new Set(indeterminate)
  let ancestors: readonly K[] | undefined
  let descendants: Iterable<K> | undefined
  const context: SelectionContext<K> = {
    key,
    ancestors: () => (ancestors ??= structure.getAncestorsOf(key)),
    descendants: () => (descendants ??= structure.getDescendantsOf(key)),
    childrenOf: (childKey) => structure.getChildrenOf(childKey),
    isChecked: (childKey) => nextChecked.has(childKey),
    isIndeterminate: (childKey) => nextIndeterminate.has(childKey),
    isDisabled: (childKey) => isDisabled(childKey),
    setChecked: (childKey, value) => {
      if (value) nextChecked.add(childKey)
      else nextChecked.delete(childKey)
    },
    setIndeterminate: (childKey, value) => {
      if (value) nextIndeterminate.add(childKey)
      else nextIndeterminate.delete(childKey)
    },
  }
  handler.onToggle(context)
  return { checked: nextChecked, indeterminate: nextIndeterminate }
}

export function emitKeys<K>(
  checked: ReadonlySet<K>,
  structure: Pick<StructureShape<K>, 'getAncestorsOf'>,
  handler: SelectionHandler<K>,
): K[] {
  const context: ExportContext<K> = {
    isChecked: (key) => checked.has(key),
    ancestorsOf: (key) => structure.getAncestorsOf(key),
  }
  const out: K[] = []
  for (const key of checked) {
    if (handler.shouldEmit && !handler.shouldEmit(key, context)) continue
    out.push(key)
  }
  return out
}
