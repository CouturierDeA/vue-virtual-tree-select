import { computed, type ComputedRef, type Ref } from 'vue'

export function useVisibleRange(options: {
  windowStart: Ref<number>
  windowEnd: Ref<number>
  scrollTop: Ref<number>
  scrollOriginOffset: ComputedRef<number>
  viewportHeight: Ref<number>
  windowTotalHeight: ComputedRef<number>
  avgRowHeight: ComputedRef<number>
  offsetsRef: Ref<Float64Array>
  findLocalIndex: (targetOffset: number) => number
  itemCount: () => number
  props: { overscan: number }
}) {
  const {
    windowStart,
    windowEnd,
    scrollTop,
    scrollOriginOffset,
    viewportHeight,
    windowTotalHeight,
    avgRowHeight,
    offsetsRef,
    findLocalIndex,
    itemCount,
    props,
  } = options

  const localStartIndex = computed(() => {
    if (windowEnd.value === windowStart.value) return 0
    if (windowTotalHeight.value === 0) return 0
    const localScrollTop = Math.max(0, scrollTop.value - scrollOriginOffset.value)
    return Math.max(0, findLocalIndex(localScrollTop) - props.overscan)
  })

  const localEndIndex = computed(() => {
    const len = windowEnd.value - windowStart.value
    if (len === 0) return 0
    if (windowTotalHeight.value === 0) {
      return Math.min(len, Math.max(1, props.overscan * 2 + 1))
    }
    const localScrollTop = Math.max(0, scrollTop.value - scrollOriginOffset.value)
    const last = findLocalIndex(localScrollTop + viewportHeight.value)
    return Math.min(len, last + props.overscan + 1)
  })

  const startIndex = computed(() => windowStart.value + localStartIndex.value)
  const endIndex = computed(() => windowStart.value + localEndIndex.value)
  const offsetTop = computed(() => offsetsRef.value[localStartIndex.value] ?? 0)

  const estTotalHeight = computed(() => itemCount() * avgRowHeight.value)
  const globalOffset = computed(
    () =>
      windowStart.value * avgRowHeight.value +
      Math.max(0, scrollTop.value - scrollOriginOffset.value),
  )

  return {
    localStartIndex,
    localEndIndex,
    startIndex,
    endIndex,
    offsetTop,
    estTotalHeight,
    globalOffset,
  }
}
