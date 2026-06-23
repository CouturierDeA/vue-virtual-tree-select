import type { Ref } from 'vue'

const PIXEL_EPSILON = 0.5

export function useScrollLayout(options: {
  viewportRef: Readonly<Ref<HTMLElement | null>>
  windowStart: Ref<number>
  scrollTop: Ref<number>
  topSpacerHeight: Ref<number>
  scrollCompensation: Ref<number>
  isScrollActive: () => boolean
  runAfterScrollIdle: (task: () => void) => void
  setScrollTop: (value: number) => void
  clearMeasureRange: () => void
}) {
  const {
    viewportRef,
    windowStart,
    scrollTop,
    topSpacerHeight,
    scrollCompensation,
    isScrollActive,
    runAfterScrollIdle,
    setScrollTop,
    clearMeasureRange,
  } = options

  function resetScrollLayout() {
    topSpacerHeight.value = 0
    scrollCompensation.value = 0
    clearMeasureRange()
  }

  function flushScrollCompensation() {
    const delta = scrollCompensation.value
    if (Math.abs(delta) <= PIXEL_EPSILON) {
      scrollCompensation.value = 0
      return
    }

    const el = viewportRef.value
    if (!el) return
    scrollCompensation.value = 0
    setScrollTop(el.scrollTop - delta)
  }

  function scheduleScrollCompensationFlush() {
    runAfterScrollIdle(flushScrollCompensation)
  }

  function addVisualCompensation(delta: number) {
    if (Math.abs(delta) <= PIXEL_EPSILON) return
    scrollCompensation.value += delta
    scheduleScrollCompensationFlush()
  }

  function correctScrollTopBy(delta: number) {
    if (Math.abs(delta) <= PIXEL_EPSILON) return

    const el = viewportRef.value
    if (!el) return
    if (isScrollActive()) {
      addVisualCompensation(-delta)
      return
    }

    setScrollTop(el.scrollTop + delta)
  }

  function normalizeTopBoundary() {
    if (scrollTop.value > PIXEL_EPSILON) return

    if (windowStart.value === 0) {
      topSpacerHeight.value = 0
      scrollCompensation.value = 0
      clearMeasureRange()
      return
    }

    if (scrollCompensation.value < -PIXEL_EPSILON) {
      flushScrollCompensation()
    }
  }

  function consumeNegativeCompensation(amount: number) {
    if (amount <= 0) return false
    if (scrollCompensation.value >= -PIXEL_EPSILON) return false

    scrollCompensation.value = Math.min(0, scrollCompensation.value + amount)
    return true
  }

  return {
    resetScrollLayout,
    addVisualCompensation,
    correctScrollTopBy,
    normalizeTopBoundary,
    consumeNegativeCompensation,
  }
}
