import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useMeasuredOffsets } from '@/virtual-list/composables/useMeasuredOffsets'

for (const bulk of [false, true]) {
  describe(`measured offsets with bulk traversal ${bulk}`, () => {
    it('keeps measurements, partial rebuilds, and source shrink consistent', () => {
      let count = 10
      const windowStart = ref(2)
      const windowEnd = ref(6)
      const itemKey = vi.fn((index: number) => `row:${index}`)
      const itemKeys = vi.fn(function* (from: number, to: number) {
        for (let i = from; i < to; i++) yield `row:${i}`
      })
      const state = useMeasuredOffsets({
        windowStart,
        windowEnd,
        props: { minUnmeasuredRowHeight: 10 },
        itemCount: () => count,
        itemKey,
        itemKeys: bulk ? itemKeys : undefined,
      })
      state.buildOffsets()
      expect([...state.offsetsRef.value]).toEqual([0, 10, 20, 30, 40])
      if (bulk) {
        expect(itemKey).not.toHaveBeenCalled()
        expect(itemKeys).toHaveBeenCalledTimes(1)
      }
      state.recordHeightInPlace(2, 12)
      state.recordHeightInPlace(3, 20)
      state.recordHeightInPlace(4, 16)
      expect(state.getMeasuredRangeHeight(2, 5)).toBe(48)
      expect(state.getMeasuredRangeHeight(2, 6)).toBeUndefined()
      state.buildOffsets()
      expect([...state.offsetsRef.value]).toEqual([0, 12, 32, 48, 64])
      state.recordHeightInPlace(3, 8)
      state.rebuildOffsetsFrom(1)
      expect([...state.offsetsRef.value]).toEqual([0, 12, 20, 36, 48])
      count = 4
      state.buildOffsets()
      expect([...state.offsetsRef.value]).toEqual([0, 12, 20, 20, 20])
      expect(state.getMeasuredRangeHeight(2, 5)).toBeUndefined()
      windowStart.value = 4
      state.buildOffsets()
      expect([...state.offsetsRef.value]).toEqual([0, 0, 0])
      windowEnd.value = 4
      state.buildOffsets()
      expect([...state.offsetsRef.value]).toEqual([0])
    })
  })
}
