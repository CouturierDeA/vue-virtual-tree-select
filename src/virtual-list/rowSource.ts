export type RowIndex = number

/** Stable primitive used for Vue :key and measured-height cache. Never an object. */
export type RenderKey = string | number | symbol

export interface RowSource<Row, Key = unknown> {
  readonly length: number
  keyAt(rowIndex: RowIndex): Key
  rowAt(rowIndex: RowIndex): Row
  indexOf(key: Key): RowIndex
  fallbackFor?(key: Key): Key | undefined
}

export function keyMappedRowSource<
  Row,
  InnerKey = unknown,
  OuterKey = unknown,
>(
  inner: RowSource<Row, InnerKey>,
  mapping: {
    toOuterKey: (key: InnerKey) => OuterKey
    toInnerKey: (key: OuterKey) => InnerKey | undefined
  },
): RowSource<Row, OuterKey> {
  const { toOuterKey, toInnerKey } = mapping
  return {
    get length() {
      return inner.length
    },
    keyAt: (rowIndex) => toOuterKey(inner.keyAt(rowIndex)),
    rowAt: (rowIndex) => inner.rowAt(rowIndex),
    indexOf: (key) => {
      const innerKey = toInnerKey(key)
      if (innerKey === undefined) return -1
      return inner.indexOf(innerKey)
    },
    fallbackFor: (key) => {
      const innerKey = toInnerKey(key)
      if (innerKey === undefined) return undefined
      const fallback = inner.fallbackFor?.(innerKey)
      return fallback === undefined ? undefined : toOuterKey(fallback)
    },
  }
}

export function fromArray<T, Row, Key = unknown>(
  items: readonly T[],
  adapter: {
    keyOf: (item: T, rowIndex: RowIndex) => Key
    rowOf: (item: T, rowIndex: RowIndex) => Row
    indexOf?: (key: Key) => RowIndex
    fallbackFor?: (key: Key) => Key | undefined
  },
): RowSource<Row, Key> {
  const { keyOf, rowOf, indexOf, fallbackFor } = adapter
  return {
    get length() {
      return items.length
    },
    keyAt: (rowIndex) => keyOf(items[rowIndex]!, rowIndex),
    rowAt: (rowIndex) => rowOf(items[rowIndex]!, rowIndex),
    indexOf:
      indexOf ??
      ((key) => {
        for (let i = 0; i < items.length; i++) {
          if (keyOf(items[i]!, i) === key) return i
        }
        return -1
      }),
    fallbackFor,
  }
}

export function fromFilteredSet<T, Row, Key = unknown>(
  items: ReadonlySet<T>,
  adapter: {
    accept?: (item: T) => boolean
    keyOf: (item: T, rowIndex: RowIndex) => Key
    rowOf: (item: T, rowIndex: RowIndex) => Row
    indexOf?: (key: Key) => RowIndex
    fallbackFor?: (key: Key) => Key | undefined
  },
): RowSource<Row, Key> {
  const { accept = () => true, keyOf, rowOf, indexOf, fallbackFor } = adapter
  let cachedLength: number | undefined
  let cursor: IterableIterator<T> | undefined
  let cursorRowIndex = -1
  let cursorItem: T | undefined

  function resetCursor() {
    cursor = items.values()
    cursorRowIndex = -1
    cursorItem = undefined
  }

  function nextAccepted() {
    if (cursor === undefined) resetCursor()
    while (true) {
      const next = cursor!.next()
      if (next.done) return undefined
      if (accept(next.value)) return next.value
    }
  }

  function itemAt(rowIndex: RowIndex) {
    if (rowIndex < 0) return undefined
    if (rowIndex < cursorRowIndex || cursor === undefined) resetCursor()

    while (cursorRowIndex < rowIndex) {
      const next = nextAccepted()
      if (next === undefined) return undefined
      cursorRowIndex++
      cursorItem = next
    }

    return cursorItem
  }

  return {
    get length() {
      if (cachedLength !== undefined) return cachedLength
      let count = 0
      for (const item of items) {
        if (accept(item)) count++
      }
      cachedLength = count
      return count
    },
    keyAt: (rowIndex) => keyOf(itemAt(rowIndex)!, rowIndex),
    rowAt: (rowIndex) => rowOf(itemAt(rowIndex)!, rowIndex),
    indexOf:
      indexOf ??
      ((key) => {
        let rowIndex = 0
        for (const item of items) {
          if (!accept(item)) continue
          if (keyOf(item, rowIndex) === key) return rowIndex
          rowIndex++
        }
        return -1
      }),
    fallbackFor,
  }
}
