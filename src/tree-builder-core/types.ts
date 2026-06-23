export interface StructureShape<K> {
  keys(): Iterable<K>
  getChildrenOf(key: K): readonly K[]
  getDescendantsOf(key: K): Iterable<K>
  getAncestorsOf(key: K): readonly K[]
  getDepthOf(key: K): number
  subtreeSize(key: K): number
  hasChildren(key: K): boolean
  descend(shouldDescend: (key: K) => boolean): readonly K[]
  filter(keep: (key: K) => boolean): readonly K[]
}

export interface SelectionContext<K> {
  key: K
  ancestors(): readonly K[]
  descendants(): Iterable<K>
  childrenOf(key: K): readonly K[]
  isChecked(key: K): boolean
  isIndeterminate(key: K): boolean
  isDisabled(key: K): boolean
  setChecked(key: K, value: boolean): void
  setIndeterminate(key: K, value: boolean): void
}

export interface ExportContext<K> {
  isChecked(key: K): boolean
  ancestorsOf(key: K): readonly K[]
}

export interface SelectionHandler<K> {
  onToggle(ctx: SelectionContext<K>): void
  shouldEmit?(key: K, ctx: ExportContext<K>): boolean
}

export type TreeNodeGuides = {
  verticals: { draw: boolean; active: boolean }[]
  connector: {
    hasDown: boolean
    upActive: boolean
    downActive: boolean
    elbowActive: boolean
    descent: boolean
    descentActive: boolean
  } | null
}
