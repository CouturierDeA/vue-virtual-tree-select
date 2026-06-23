import { useResizeObserver } from '@/composables/useResizeObserver'
import type { RowIndex } from '@/virtual-list/rowSource'
import type { Ref } from 'vue'

export function useRowMeasurement(options: {
  viewportRef: Readonly<Ref<HTMLElement | null>>
  offsetsRef: Ref<Float64Array>
  windowStart: Ref<number>
  windowEnd: Ref<number>
  findLocalIndex: (targetOffset: number) => number
  getScrollOffsetBase: () => number
  recordHeightInPlace: (rowIndex: RowIndex, nextHeight: number) => boolean
  triggerHeightsChanged: () => void
  rebuildOffsetsFrom: (localChangedIndex: number) => void
  correctScrollTopBy: (delta: number) => void
  applyPendingScroll: () => void
  onMeasurementsApplied?: () => void
}) {
  const {
    viewportRef,
    offsetsRef,
    windowStart,
    windowEnd,
    findLocalIndex,
    getScrollOffsetBase,
    recordHeightInPlace,
    triggerHeightsChanged,
    rebuildOffsetsFrom,
    correctScrollTopBy,
    applyPendingScroll,
    onMeasurementsApplied,
  } = options

  const windowObserverApi = useResizeObserver(null, (entries) => {
    const measurements: { rowIndex: RowIndex; height: number }[] = []
    for (const entry of entries) {
      const target = entry.target as HTMLElement
      const raw = target.dataset.vlIdx
      if (!raw) continue
      const rowIndex = Number(raw)
      if (!Number.isInteger(rowIndex)) continue
      const blockSize = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
      const height = Math.ceil(blockSize)
      if (height <= 0) continue
      measurements.push({ rowIndex, height })
    }
    if (!measurements.length) return

    requestAnimationFrame(() => {
      const el = viewportRef.value
      if (!el) return

      const windowLen = windowEnd.value - windowStart.value
      const offsets = offsetsRef.value
      const localScrollTop = Math.max(0, el.scrollTop - getScrollOffsetBase())
      const anchorLocal = findLocalIndex(localScrollTop)
      const anchorWithin = localScrollTop - (offsets[anchorLocal] ?? 0)

      let minChangedLocal = Infinity
      let anyChanged = false

      for (const { rowIndex, height } of measurements) {
        if (recordHeightInPlace(rowIndex, height)) {
          anyChanged = true
          const localIdx = rowIndex - windowStart.value
          if (localIdx >= 0 && localIdx < windowLen && localIdx < minChangedLocal) {
            minChangedLocal = localIdx
          }
        }
      }

      if (!anyChanged) {
        applyPendingScroll()
        onMeasurementsApplied?.()
        return
      }

      triggerHeightsChanged()
      if (minChangedLocal !== Infinity) {
        rebuildOffsetsFrom(minChangedLocal)

        if (minChangedLocal < anchorLocal) {
          const target =
            getScrollOffsetBase() + (offsetsRef.value[anchorLocal] ?? 0) + anchorWithin
          if (Math.abs(target - el.scrollTop) > 0.5) {
            correctScrollTopBy(target - el.scrollTop)
          }
        }
      }

      applyPendingScroll()
      onMeasurementsApplied?.()
    })
  })

  return { windowObserverApi }
}
