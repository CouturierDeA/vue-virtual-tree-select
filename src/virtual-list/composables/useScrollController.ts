import { ref, type Ref } from 'vue'
import type { RowIndex } from '@/virtual-list/rowSource'

type ScrollAlign = 'auto' | 'center' | 'end' | 'start' | 'nearest'

type PendingScroll = {
  rowIndex: RowIndex
  align: ScrollAlign
}

export function useScrollController(options: {
  viewportRef: Readonly<Ref<HTMLElement | null>>
  offsetsRef: Ref<Float64Array>
  getHeightAt: (localIndex: number) => number
  getMeasuredHeightAt: (localIndex: number) => number | undefined
  viewportHeight: Ref<number>
  windowStart: Ref<number>
  windowEnd: Ref<number>
  itemCount: () => number
  props: { keepAroundVisible: number }
  recenter: (rowIndex: RowIndex) => void
  getScrollOffsetBase: () => number
  suppressMs?: number
  scrollIdleMs?: number
}) {
  const {
    viewportRef,
    offsetsRef,
    getHeightAt,
    getMeasuredHeightAt,
    viewportHeight,
    windowStart,
    windowEnd,
    itemCount,
    props,
    recenter,
    getScrollOffsetBase,
    suppressMs = 80,
    scrollIdleMs = 180,
  } = options

  const scrollTop = ref(0)
  const pendingScroll = ref<PendingScroll | undefined>(undefined)
  const deferredIdleTasks: Array<() => void> = []
  let suppressUntil = 0
  let scrollIdleId: number | undefined
  let scrollActive = false

  function isSuppressed() {
    return performance.now() < suppressUntil
  }

  function suppressNext() {
    suppressUntil = performance.now() + suppressMs
  }

  function hasPendingScroll() {
    return !!pendingScroll.value
  }

  function flushIdleTasks() {
    let index = 0
    while (index < deferredIdleTasks.length) {
      const task = deferredIdleTasks[index]
      index += 1
      task?.()
    }
    deferredIdleTasks.length = 0
  }

  function markScrollActivity() {
    scrollActive = true
    if (scrollIdleId !== undefined) window.clearTimeout(scrollIdleId)
    scrollIdleId = window.setTimeout(() => {
      scrollIdleId = undefined
      scrollActive = false
      flushIdleTasks()
    }, scrollIdleMs)
  }

  function isScrollActive() {
    return scrollActive
  }

  function runAfterScrollIdle(task: () => void) {
    if (!scrollActive) {
      task()
      return
    }
    deferredIdleTasks.push(task)
  }

  function syncFromViewport() {
    const el = viewportRef.value
    if (!el) return
    scrollTop.value = el.scrollTop
  }

  function setScrollTop(value: number) {
    const el = viewportRef.value
    if (!el) return
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
    const clamped = Math.max(0, Math.min(value, maxScrollTop))
    suppressNext()
    el.scrollTop = clamped
    scrollTop.value = clamped
  }

  function applyScrollForIndex(rowIndex: RowIndex, align: ScrollAlign) {
    const el = viewportRef.value
    if (!el) return
    const localIdx = rowIndex - windowStart.value
    const offsets = offsetsRef.value
    const itemTop = getScrollOffsetBase() + (offsets[localIdx] ?? 0)
    const itemHeight = getHeightAt(localIdx)

    let next = itemTop
    const viewHeight = viewportHeight.value
    if (align === 'center') {
      next = itemTop - (viewHeight - itemHeight) / 2
    } else if (align === 'end') {
      next = itemTop - viewHeight + itemHeight
    } else if (align === 'nearest' || align === 'auto') {
      const top = el.scrollTop
      const bottom = top + viewHeight
      const itemBottom = itemTop + itemHeight
      if (itemTop >= top && itemBottom <= bottom) return
      next = itemTop < top ? itemTop : itemBottom - viewHeight
    }

    setScrollTop(next)
  }

  function applyPendingScroll() {
    const request = pendingScroll.value
    if (!request) return
    if (request.rowIndex < windowStart.value || request.rowIndex >= windowEnd.value) {
      pendingScroll.value = undefined
      return
    }
    const localIdx = request.rowIndex - windowStart.value
    applyScrollForIndex(request.rowIndex, request.align)
    if (getMeasuredHeightAt(localIdx) !== undefined) {
      pendingScroll.value = undefined
    }
  }

  function scrollToItem(rowIndex: RowIndex, align: ScrollAlign = 'auto') {
    if (rowIndex < 0 || rowIndex >= itemCount()) return

    const inWindow =
      rowIndex >= windowStart.value + props.keepAroundVisible &&
      rowIndex < windowEnd.value - props.keepAroundVisible

    pendingScroll.value = { rowIndex, align }
    if (!inWindow) {
      recenter(rowIndex)
    }
    applyPendingScroll()
  }

  function scrollToIndex(rowIndex: RowIndex) {
    scrollToItem(rowIndex, 'auto')
  }

  function scrollToOffset(offset: number) {
    const el = viewportRef.value
    if (!el) return
    const max = Math.max(0, el.scrollHeight - el.clientHeight)
    setScrollTop(Math.max(0, Math.min(offset, max)))
  }

  function onScrollbarSeek(fraction: number) {
    const target = Math.round(fraction * Math.max(0, itemCount() - 1))
    scrollToItem(target, 'start')
  }

  function disposeScrollController() {
    if (scrollIdleId !== undefined) window.clearTimeout(scrollIdleId)
    scrollIdleId = undefined
    deferredIdleTasks.length = 0
  }

  return {
    scrollTop,
    isSuppressed,
    isScrollActive,
    hasPendingScroll,
    markScrollActivity,
    runAfterScrollIdle,
    syncFromViewport,
    setScrollTop,
    applyPendingScroll,
    scrollToItem,
    scrollToIndex,
    scrollToOffset,
    onScrollbarSeek,
    disposeScrollController,
  }
}
