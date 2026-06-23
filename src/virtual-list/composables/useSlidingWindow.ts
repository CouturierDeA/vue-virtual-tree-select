import { type ComputedRef, type Ref } from 'vue'
import type { RowIndex } from '@/virtual-list/rowSource'

export function useSlidingWindow(options: {
  windowStart: Ref<number>
  windowEnd: Ref<number>
  topSpacerHeight: Ref<number>
  localStartIndex: ComputedRef<number>
  localEndIndex: ComputedRef<number>
  props: {
    keepWindow: number
    keepAroundVisible: number
    overscan: number
    windowGrowChunk: number
    trimIdleDelayMs: number
  }
  itemCount: () => number
  buildOffsets: () => void
  getMeasuredRangeHeight: (from: RowIndex, to: RowIndex) => number | undefined
  addVisualCompensation: (delta: number) => void
  requestMeasureRange: (from: RowIndex, to: RowIndex) => void
  clearMeasureRange: (from: RowIndex, to: RowIndex) => void
  resetScrollLayout: () => void
  hasPendingScroll: () => boolean
  isSuppressed: () => boolean
}) {
  const {
    windowStart,
    windowEnd,
    topSpacerHeight,
    localStartIndex,
    localEndIndex,
    props,
    itemCount,
    buildOffsets,
    getMeasuredRangeHeight,
    addVisualCompensation,
    requestMeasureRange,
    clearMeasureRange,
    resetScrollLayout,
    hasPendingScroll,
    isSuppressed,
  } = options

  let pendingTrimId: number | undefined

  function windowLen() {
    return windowEnd.value - windowStart.value
  }

  function clampWindowBounds(len: number) {
    windowEnd.value = Math.min(len, windowEnd.value)
    windowStart.value = Math.min(windowStart.value, Math.max(0, windowEnd.value))
  }

  function growWindowToKeepWindow() {
    const len = itemCount()
    if (windowLen() >= props.keepWindow) return
    if (windowEnd.value >= len) return
    windowEnd.value = Math.min(len, windowStart.value + props.keepWindow)
  }

  function recenterWindowAround(targetRowIndex: RowIndex) {
    const len = itemCount()
    const windowSize = props.keepWindow
    const half = Math.floor(windowSize / 2)
    const newStart = Math.max(0, Math.min(targetRowIndex - half, Math.max(0, len - windowSize)))
    const newEnd = Math.min(len, newStart + windowSize)
    if (newStart === windowStart.value && newEnd === windowEnd.value) return
    resetScrollLayout()
    windowStart.value = newStart
    windowEnd.value = newEnd
    buildOffsets()
  }

  function growWindowDown() {
    const len = itemCount()
    if (windowEnd.value >= len) return
    windowEnd.value = Math.min(len, windowEnd.value + props.windowGrowChunk)
    buildOffsets()
  }

  function growWindowUp() {
    if (windowStart.value <= 0) return
    const oldStart = windowStart.value
    const nextStart = Math.max(0, oldStart - props.windowGrowChunk)
    const measuredHeight = getMeasuredRangeHeight(nextStart, oldStart)
    if (measuredHeight === undefined) {
      requestMeasureRange(nextStart, oldStart)
      return
    }

    clearMeasureRange(nextStart, oldStart)
    const coveredBySpacer = Math.min(topSpacerHeight.value, measuredHeight)
    topSpacerHeight.value -= coveredBySpacer
    const uncoveredHeight = measuredHeight - coveredBySpacer
    if (uncoveredHeight > 0.5) {
      addVisualCompensation(-uncoveredHeight)
    }

    windowStart.value = nextStart
    buildOffsets()
  }

  function maybeExpandWindow() {
    if (isSuppressed()) return

    const localStart = localStartIndex.value
    const localEnd = localEndIndex.value
    const currentWindowLen = windowLen()

    if (localStart <= props.keepAroundVisible && windowStart.value > 0) {
      growWindowUp()
    }
    if (currentWindowLen - localEnd <= props.keepAroundVisible && windowEnd.value < itemCount()) {
      growWindowDown()
    }

    if (hasTrimOpportunity()) {
      runTrim()
    }
  }

  function scheduleTrim() {
    if (pendingTrimId !== undefined) return
    if (!hasTrimOpportunity()) return
    if (hasPendingScroll()) return
    pendingTrimId = window.setTimeout(() => {
      pendingTrimId = undefined
      runTrim()
      if (hasTrimOpportunity()) {
        scheduleTrim()
      }
    }, props.trimIdleDelayMs)
  }

  function cancelPendingTrim() {
    if (pendingTrimId === undefined) return
    window.clearTimeout(pendingTrimId)
    pendingTrimId = undefined
  }

  function hasTrimOpportunity() {
    const currentWindowLen = windowLen()
    if (currentWindowLen <= 0) return false
    if (currentWindowLen > props.keepWindow) return true
    const safety = props.overscan + props.keepAroundVisible
    return localStartIndex.value > safety
  }

  function runTrim() {
    if (hasPendingScroll()) return

    const safety = props.overscan + props.keepAroundVisible
    const currentWindowLen = windowLen()

    const spareAtStart = localStartIndex.value - safety
    const spareAtEnd = currentWindowLen - localEndIndex.value - safety

    let trimmed = false
    if (spareAtStart > 0 && (currentWindowLen <= props.keepWindow || spareAtStart > spareAtEnd)) {
      const cut = Math.min(spareAtStart, props.windowGrowChunk)
      const removedHeight = getMeasuredRangeHeight(windowStart.value, windowStart.value + cut)
      if (removedHeight === undefined) return
      topSpacerHeight.value += removedHeight
      windowStart.value = windowStart.value + cut
      trimmed = true
    } else if (currentWindowLen > props.keepWindow && spareAtEnd > 0) {
      const cut = Math.min(spareAtEnd, props.windowGrowChunk)
      windowEnd.value = windowEnd.value - cut
      trimmed = true
    }

    if (!trimmed) return

    buildOffsets()
  }

  return {
    clampWindowBounds,
    growWindowToKeepWindow,
    recenterWindowAround,
    maybeExpandWindow,
    scheduleTrim,
    cancelPendingTrim,
  }
}
