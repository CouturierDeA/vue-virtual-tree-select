import { expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import VirtualList from '@/virtual-list/VirtualList.vue'
import VirtualScrollbar from '@/ui/VirtualScrollbar.vue'
import TreeRow from '@/ui/TreeRow.vue'
import TreeGuides from '@/ui/TreeGuides.vue'
import {
  buildIndicesFromNested,
  buildVisibleCounts,
  fromCounts,
  windowGuides,
} from '@/tree-builder-core'

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))

it('drags the scrollbar through two million deeply nested nodes with bounded guide DOM', async () => {
  const total = 2_000_000
  const chainLength = total / 10
  const indices = buildIndicesFromNested(
    Array.from({ length: 10 }, () => ({ depth: 0 })),
    {
      getChildren: ({ depth }) => (depth + 1 < chainLength ? [{ depth: depth + 1 }] : []),
    },
  )
  const counts = buildVisibleCounts(indices, () => true)
  const empty = new Set<number>()
  const source = fromCounts(indices, () => counts, { rowOf: (index) => index, isOpen: () => true })
  const range = vi.spyOn(source, 'keysInRange')
  const wrapper = mount(VirtualList, {
    attachTo: document.body,
    props: { source, maxHeight: 300, minUnmeasuredRowHeight: 40, premeasureRows: 0 },
    slots: {
      default: ({ item }: { item: unknown }) => {
        const index = item as number
        return h(
          TreeRow,
          {
            depth: indices.depth[index],
            guides: windowGuides(indices, counts, empty, empty, index),
            style: 'height:40px',
          },
          () => String(index),
        )
      },
      scrollbar: (scope: {
        size: number
        position: number
        viewport: number
        seek: (fraction: number) => void
      }) =>
        h(VirtualScrollbar, {
          size: scope.size,
          position: scope.position,
          viewport: scope.viewport,
          onSeek: scope.seek,
        }),
    },
  })
  try {
    await frame()
    await frame()
    for (const target of [50_000, 190_000, 1_950_000, 0]) {
      const thumb = wrapper.get('[data-qa-id="virtual-scrollbar-thumb"]').element
      const track = wrapper.get('[data-qa-id="virtual-scrollbar"]').element
      const thumbRect = thumb.getBoundingClientRect()
      const trackRect = track.getBoundingClientRect()
      const startY = thumbRect.y + thumbRect.height / 2
      const travel = trackRect.height - thumbRect.height
      const endY = trackRect.y + thumbRect.height / 2 + (travel * target) / (total - 1)
      thumb.dispatchEvent(
        new PointerEvent('pointerdown', { clientY: startY, pointerId: 1, bubbles: true }),
      )
      thumb.dispatchEvent(
        new PointerEvent('pointermove', { clientY: endY, pointerId: 1, bubbles: true }),
      )
      thumb.dispatchEvent(
        new PointerEvent('pointerup', { clientY: endY, pointerId: 1, bubbles: true }),
      )
      await vi.waitFor(
        () => {
          const rows = wrapper.findAll('[data-qa-id="virtual-list-window"] [data-vl-idx]')
          // Fractional CSS-pixel rounding can shift a seek by several rows at this scale.
          const tolerance = Math.ceil((total - 1) / travel / 32)
          const positions = rows.map((row) => Number(row.attributes('data-vl-idx')))
          expect(
            Math.min(...positions.map((position) => Math.abs(position - target))),
          ).toBeLessThanOrEqual(tolerance)
        },
        { timeout: 3000 },
      )
      const rows = wrapper.findAll('[data-qa-id="tree-row"]')
      expect(rows.length).toBeLessThan(100)
      expect(wrapper.findAll('.tree-guides__col').length).toBeLessThanOrEqual(rows.length)
      expect(wrapper.findAll('.tree-guides__line--vertical')).toHaveLength(0)
    }
    expect(range).toHaveBeenCalled()
  } finally {
    wrapper.unmount()
  }
}, 30_000)

it('keeps a sparse guide in its original horizontal channel', () => {
  const wrapper = mount(TreeGuides, {
    attachTo: document.body,
    props: {
      indent: '84px',
      guides: {
        verticals: [{ offset: 2, active: true }],
        connector: {
          hasDown: false,
          upActive: false,
          downActive: false,
          elbowActive: false,
          descent: false,
          descentActive: false,
        },
      },
    },
  })
  try {
    const columns = wrapper.findAll('.tree-guides__col')
    expect(columns).toHaveLength(2)
    const vertical = columns[0]!.element.getBoundingClientRect()
    const connector = columns[1]!.element.getBoundingClientRect()
    expect(connector.x - vertical.x).toBe(36)
    expect(wrapper.findAll('.tree-guides__line--vertical.tree-guides__line--on')).toHaveLength(1)
  } finally {
    wrapper.unmount()
  }
})
