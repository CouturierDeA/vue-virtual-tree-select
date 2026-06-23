import { computed, shallowRef, triggerRef, type Ref } from 'vue'
import type { RenderKey, RowIndex } from '@/virtual-list/rowSource'

export function useMeasuredOffsets(options: {
  windowStart: Ref<number>
  windowEnd: Ref<number>
  props: { minUnmeasuredRowHeight: number }
  itemCount: () => number
  itemKey: (rowIndex: RowIndex) => RenderKey
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

  function getMeasuredRangeHeight(from: RowIndex, to: RowIndex) {
    let acc = 0
    for (let rowIndex = from; rowIndex < to; rowIndex++) {
      const height = getMeasuredHeightForRow(rowIndex)
      if (height === undefined) return undefined
      acc += height
    }
    return acc
  }

  function buildOffsets() {
    const len = windowEnd.value - windowStart.value
    const next = new Float64Array(len + 1)
    let acc = 0
    for (let i = 0; i < len; i++) {
      next[i] = acc
      acc += getHeightAt(i)
    }
    next[len] = acc
    offsetsRef.value = next
  }

  function rebuildOffsetsFrom(localChangedIndex: number) {
    const offsets = offsetsRef.value
    const len = windowEnd.value - windowStart.value
    if (localChangedIndex < 0 || localChangedIndex >= len) return
    let acc = offsets[localChangedIndex] ?? 0
    for (let i = localChangedIndex; i < len; i++) {
      offsets[i] = acc
      acc += getHeightAt(i)
    }
    offsets[len] = acc
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
    for (let g = keepStart; g < keepEnd; g++) active.add(itemKey(g))
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
