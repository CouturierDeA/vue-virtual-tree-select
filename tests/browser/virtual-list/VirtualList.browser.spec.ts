import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import VirtualList from '@/virtual-list/VirtualList.vue'
import { fromArray, type RowSource } from '@/virtual-list/rowSource'

type Item = { id: number; label: string }

const ROW = 30
const COUNT = 600
const VIEWPORT = 300

function mountList() {
  const source = sourceFor(COUNT)
  return mount(VirtualList, {
    attachTo: document.body,
    props: {
      source,
      maxHeight: VIEWPORT,
      minUnmeasuredRowHeight: ROW,
      premeasureRows: 0,
    },
    slots: {
      default: (scope: { item: unknown }) =>
        h('div', { style: `height:${ROW}px;box-sizing:border-box` }, (scope.item as Item).label),
    },
  })
}

type Wrapper = ReturnType<typeof mountList>

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
const settle = async () => {
  await frame()
  await frame()
}

function renderedIndices(wrapper: Wrapper) {
  return wrapper
    .findAll('[data-qa-id="virtual-list-window"] [data-vl-idx]')
    .map((node) => Number(node.attributes('data-vl-idx')))
}

function sourceFor(
  count: number,
  fallbackFor?: (key: string | number) => string | number | undefined,
): RowSource<Item> {
  const ids = Array.from({ length: count }, (_, i) => i)
  return sourceFromIds(ids, fallbackFor)
}

function sourceFromIds(
  ids: number[],
  fallbackFor?: (key: string | number) => string | number | undefined,
): RowSource<Item> {
  const items: Item[] = ids.map((id) => ({ id, label: `row ${id}` }))
  return fromArray(items, {
    keyOf: (item) => item.id,
    rowOf: (item) => item,
    indexOf: (key) => items.findIndex((item) => item.id === key),
    fallbackFor,
  })
}

function mountObjectKeyList() {
  const nodes: Item[] = Array.from({ length: COUNT }, (_, i) => ({ id: i, label: `row ${i}` }))
  const byRef = new Map(nodes.map((node, index) => [node, index] as const))
  const source: RowSource<Item, Item> = {
    get length() {
      return nodes.length
    },
    keyAt: (rowIndex) => nodes[rowIndex]!,
    rowAt: (rowIndex) => nodes[rowIndex]!,
    indexOf: (key) => byRef.get(key) ?? -1,
  }
  const wrapper = mount(VirtualList, {
    attachTo: document.body,
    props: {
      source,
      maxHeight: VIEWPORT,
      minUnmeasuredRowHeight: ROW,
      premeasureRows: 0,
    },
    slots: {
      default: (scope: { item: unknown }) =>
        h('div', { style: `height:${ROW}px;box-sizing:border-box` }, (scope.item as Item).label),
    },
  })
  return { wrapper, nodes }
}

describe('VirtualList (real layout)', () => {
  let wrapper: Wrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('renders only a small window of rows while representing the full scroll height', async () => {
    wrapper = mountList()
    await settle()

    const indices = renderedIndices(wrapper)
    expect(indices.length).toBeGreaterThan(0)
    expect(indices.length).toBeLessThan(80) // « 600 total
    expect(indices).toContain(0) // top row is mounted
    expect(indices).not.toContain(500) // a far row is not

    const viewport = wrapper.get('[data-qa-id="vl-viewport"]').element as HTMLElement
    expect(viewport.scrollHeight).toBeGreaterThan(COUNT * ROW * 0.8) // full extent is scrollable
  })

  it('scrolling down mounts deeper rows and unmounts the top', async () => {
    wrapper = mountList()
    await settle()
    const viewport = wrapper.get('[data-qa-id="vl-viewport"]').element as HTMLElement

    viewport.scrollTop = 300 * ROW // ≈ row 300
    viewport.dispatchEvent(new Event('scroll'))

    await vi.waitFor(() => {
      const indices = renderedIndices(wrapper!)
      expect(indices).not.toContain(0)
      expect(indices.some((index) => index >= 280 && index <= 320)).toBe(true)
    })
  })

  it('scrollToItem brings a far row into the window', async () => {
    wrapper = mountList()
    await settle()
    ;(wrapper.vm as unknown as { scrollToItem(index: number, align: string): void }).scrollToItem(
      450,
      'center',
    )

    await vi.waitFor(() => {
      expect(renderedIndices(wrapper!)).toContain(450)
    })
  })

  it('keeps numeric row keys intact when restoring through fallbackFor', async () => {
    wrapper = mountList()
    await settle();
    (wrapper.vm as unknown as { scrollToItem(index: number, align: string): void }).scrollToItem(
      450,
      'start',
    )

    await vi.waitFor(() => {
      expect(renderedIndices(wrapper!)).toContain(450)
    })

    const ids = Array.from({ length: COUNT }, (_, i) => (i >= 400 ? i + 1_000 : i))
    await wrapper.setProps({
      source: sourceFromIds(ids, (key) =>
        typeof key === 'number' && key >= 400 && key < 1_000 ? 300 : undefined,
      ),
    })

    await vi.waitFor(() => {
      expect(renderedIndices(wrapper!)).toContain(300)
    })
  })

  it('supports object reference keys without leaking "[object Object]" identity', async () => {
    const mounted = mountObjectKeyList()
    wrapper = mounted.wrapper
    await settle()

    const debugIds = mounted.wrapper
      .findAll('[data-qa-id="virtual-list-window"] [data-vl-id]')
      .map((node) => node.attributes('data-vl-id'))
    expect(debugIds.length).toBeGreaterThan(0)
    expect(debugIds.every((id) => id !== '[object Object]')).toBe(true)

    ;(
      mounted.wrapper.vm as unknown as { scrollToKey(key: unknown, align: string): void }
    ).scrollToKey(mounted.nodes[450], 'center')

    await vi.waitFor(() => {
      expect(renderedIndices(mounted.wrapper)).toContain(450)
    })
  })
})

describe('VirtualList height guard (scroll-height GC)', () => {
  let wrapper: Wrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const GUARD_COUNT = 10_000
  const MAX_SCROLL = 120_000
  const SOFT = (MAX_SCROLL * 2) / 3
  const FULL_HEIGHT = GUARD_COUNT * ROW

  function mountGuardList() {
    return mount(VirtualList, {
      attachTo: document.body,
      props: {
        source: sourceFor(GUARD_COUNT),
        maxHeight: VIEWPORT,
        minUnmeasuredRowHeight: ROW,
        premeasureRows: 0,
        maxScrollHeight: MAX_SCROLL,
      },
      slots: {
        default: (scope: { item: unknown }) =>
          h('div', { style: `height:${ROW}px;box-sizing:border-box` }, (scope.item as Item).label),
      },
    })
  }

  const spacerHeight = (w: Wrapper) =>
    parseFloat((w.get('[data-qa-id="vl-spacer"]').element as HTMLElement).style.height) || 0
  const viewportEl = (w: Wrapper) => w.get('[data-qa-id="vl-viewport"]').element as HTMLElement

  it('GC on idle: scrolling deep then pausing recenters the window back to a window-local spacer', async () => {
    wrapper = mountGuardList()
    await settle()
    const viewport = viewportEl(wrapper)

    for (let step = 0; step < 60; step += 1) {
      viewport.scrollTop += 3000
      viewport.dispatchEvent(new Event('scroll'))
      await frame()
    }
    expect(Math.max(...renderedIndices(wrapper)), 'travelled deep into the list').toBeGreaterThan(
      2_000,
    )

    // Full height is GUARD_COUNT*ROW = 300K px. On pause the idle GC recenters the
    // window, so the local scroll surface drops back below the soft threshold.
    await vi.waitFor(
      () => {
        expect(spacerHeight(wrapper!)).toBeLessThan(SOFT)
      },
      { timeout: 2_000 },
    )
  })

  it('GC on hard reset: continuous fast scrolling keeps the spacer far below the full height', async () => {
    wrapper = mountGuardList()
    await settle()
    const viewport = viewportEl(wrapper)

    let maxSpacer = 0
    for (let step = 0; step < 80; step += 1) {
      viewport.scrollTop += 6000
      viewport.dispatchEvent(new Event('scroll'))
      await frame()
      maxSpacer = Math.max(maxSpacer, spacerHeight(wrapper))
    }

    // The surface crossed the guard band but the hard reset recenters it, so it
    // never grows toward the full 300K px height.
    expect(maxSpacer, 'the journey crossed the guard band').toBeGreaterThan(SOFT)
    expect(maxSpacer, 'the hard guard kept it far below the full height').toBeLessThan(
      FULL_HEIGHT * 0.6,
    )
  })
})
