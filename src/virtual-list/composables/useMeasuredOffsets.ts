import { computed, shallowRef, triggerRef, type Ref } from 'vue'
import type { RenderKey, RowIndex } from '@/virtual-list/rowSource'

export function useMeasuredOffsets(options: {
  windowStart: Ref<number>
  windowEnd: Ref<number>
  props: { minUnmeasuredRowHeight: number }
  itemCount: () => number
  itemKey: (rowIndex: RowIndex) => RenderKey
  itemKeys?: (from: RowIndex, to: RowIndex) => Iterable<RenderKey>
}) {
  const { windowStart, windowEnd, props, itemCount, itemKey } = options

  const heightsByKey = shallowRef(new Map<RenderKey, number>())
  const offsetsRef = shallowRef<Float64Array>(new Float64Array(1))

  let measuredSum = 0
  let measuredCount = 0

  const windowTotalHeight = computed(
    () => offsetsRef.value[windowEnd.value - windowStart.value] ?? 0,
  )

  const avgRowHeight = computed(() => {
    const windowLen = windowEnd.value - windowStart.value
    if (windowLen > 0) return windowTotalHeight.value / windowLen
    return props.minUnmeasuredRowHeight
  })

  function currentEstimate() {
    if (measuredCount > 0) return Math.round(measuredSum / measuredCount)
    return props.minUnmeasuredRowHeight
  }

  function getHeightAt(localIndex: number) {
    const rowIndex = windowStart.value + localIndex
    if (rowIndex >= itemCount()) return 0
    const measured = heightsByKey.value.get(itemKey(rowIndex))
    if (measured !== undefined) return measured
    return currentEstimate()
  }

  function getMeasuredHeightAt(localIndex: number) {
    const rowIndex = windowStart.value + localIndex
    if (rowIndex >= itemCount()) return undefined
    return heightsByKey.value.get(itemKey(rowIndex))
  }

  function getMeasuredHeightForRow(rowIndex: RowIndex) {
    if (rowIndex < 0 || rowIndex >= itemCount()) return undefined
    return heightsByKey.value.get(itemKey(rowIndex))
  }

  function* keysInRange(from: RowIndex, to: RowIndex) {
    if (options.itemKeys) yield* options.itemKeys(from, to)
    else for (let rowIndex = from; rowIndex < to; rowIndex++) yield itemKey(rowIndex)
  }

  function getMeasuredRangeHeight(from: RowIndex, to: RowIndex) {
    if (to > from && (from < 0 || to > itemCount())) return undefined
    let acc = 0
    for (const key of keysInRange(from, to)) {
      const height = heightsByKey.value.get(key)
      if (height === undefined) return undefined
      acc += height
    }
    return acc
  }

  function fillOffsets(offsets: Float64Array, localStart: number) {
    const len = windowEnd.value - windowStart.value
    const estimate = currentEstimate()
    let acc = offsets[localStart] ?? 0
    let local = localStart
    const from = windowStart.value + localStart
    const to = Math.min(windowEnd.value, itemCount())
    for (const key of keysInRange(from, to)) {
      offsets[local++] = acc
      acc += heightsByKey.value.get(key) ?? estimate
    }
    // Source shrink can temporarily leave the window past the last row.
    offsets.fill(acc, local, len + 1)
  }

  function buildOffsets() {
    const len = windowEnd.value - windowStart.value
    const next = new Float64Array(len + 1)
    fillOffsets(next, 0)
    offsetsRef.value = next
  }

  function rebuildOffsetsFrom(localChangedIndex: number) {
    const len = windowEnd.value - windowStart.value
    if (localChangedIndex < 0 || localChangedIndex >= len) return
    fillOffsets(offsetsRef.value, localChangedIndex)
    triggerRef(offsetsRef)
  }

  function findLocalIndex(targetOffset: number) {
    const len = windowEnd.value - windowStart.value
    if (len === 0) return 0
    const offsets = offsetsRef.value
    let low = 0
    let high = len - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (offsets[mid] <= targetOffset) low = mid
      else high = mid - 1
    }
    return low
  }

  function recordHeightInPlace(rowIndex: RowIndex, nextHeight: number) {
    if (rowIndex >= itemCount() || nextHeight <= 0) return false
    const key = itemKey(rowIndex)
    const previous = heightsByKey.value.get(key)
    if (previous === nextHeight) return false
    if (previous === undefined) {
      measuredCount += 1
      measuredSum += nextHeight
    } else {
      measuredSum += nextHeight - previous
    }
    heightsByKey.value.set(key, nextHeight)
    return true
  }

  function triggerHeightsChanged() {
    triggerRef(heightsByKey)
  }

  function forgetMeasuredHeights() {
    heightsByKey.value = new Map()
  }

  function cleanupMeasuredHeights(keepWindow: number) {
    const old = heightsByKey.value
    if (old.size === 0) return
    const active = new Set<RenderKey>()
    const keepStart = Math.max(0, windowStart.value - keepWindow)
    const keepEnd = Math.min(itemCount(), windowEnd.value + keepWindow)
    for (const key of keysInRange(keepStart, keepEnd)) active.add(key)
    const next = new Map<RenderKey, number>()
    let nextSum = 0
    for (const [key, height] of old) {
      if (active.has(key)) {
        next.set(key, height)
        nextSum += height
      }
    }
    if (next.size !== old.size) {
      heightsByKey.value = next
      measuredCount = next.size
      measuredSum = nextSum
    }
  }

  function maybeCleanupMeasuredHeights(keepWindow: number) {
    if (heightsByKey.value.size <= keepWindow * 4) return
    cleanupMeasuredHeights(keepWindow)
  }

  return {
    offsetsRef,
    windowTotalHeight,
    avgRowHeight,
    getHeightAt,
    getMeasuredHeightAt,
    getMeasuredHeightForRow,
    getMeasuredRangeHeight,
    buildOffsets,
    rebuildOffsetsFrom,
    findLocalIndex,
    recordHeightInPlace,
    triggerHeightsChanged,
    forgetMeasuredHeights,
    maybeCleanupMeasuredHeights,
  }
}
