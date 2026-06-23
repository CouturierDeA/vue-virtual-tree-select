import { nextTick, type Ref } from 'vue'
import type { RowIndex } from '@/virtual-list/rowSource'

export type AnchorSnapshot<Key> = {
  key: Key
  rowIndex: RowIndex
  topOffset: number
}

export function useRowAnchor<Key>(options: {
  viewportRef: Readonly<Ref<HTMLElement | null>>
  windowNodesRef: Readonly<Ref<HTMLElement[] | null>>
  offsetsRef: Ref<Float64Array>
  windowStart: Ref<number>
  windowEnd: Ref<number>
  itemCount: () => number
  keyOf: (rowIndex: RowIndex) => Key
  keyOfRenderedNode: (node: HTMLElement) => Key | undefined
  findIndexByKey: (key: Key) => RowIndex
  resolveFallback: (key: Key) => Key | undefined
  setScrollTop: (value: number) => void
  getScrollOffsetBase: () => number
  recenter: (rowIndex: RowIndex) => void
}) {
  const {
    viewportRef,
    windowNodesRef,
    offsetsRef,
    windowStart,
    windowEnd,
    itemCount,
    keyOf,
    keyOfRenderedNode,
    findIndexByKey,
    resolveFallback,
    setScrollTop,
    getScrollOffsetBase,
    recenter,
  } = options

  function resolveAnchorIndex(anchor: AnchorSnapshot<Key>) {
    const direct = findIndexByKey(anchor.key)
    if (direct >= 0) return { index: direct, viaFallback: false }
    const fallback = resolveFallback(anchor.key)
    if (fallback !== undefined) {
      const fallbackIndex = findIndexByKey(fallback)
      if (fallbackIndex >= 0) return { index: fallbackIndex, viaFallback: true }
    }
    return { index: anchor.rowIndex, viaFallback: false }
  }

  function resolveAnchorIndexFast(anchor: AnchorSnapshot<Key>) {
    const i = anchor.rowIndex
    if (i >= 0 && i < itemCount() && Object.is(keyOf(i), anchor.key)) {
      return { index: i, viaFallback: false }
    }
    return resolveAnchorIndex(anchor)
  }

  function getRenderedNodeByKey(key: Key) {
    const nodes = windowNodesRef.value ?? []
    for (const node of nodes) {
      const nodeKey = keyOfRenderedNode(node)
      if (nodeKey !== undefined && Object.is(nodeKey, key)) return node
    }
    return undefined
  }

  function captureAnchor() {
    const el = viewportRef.value
    if (!el) return undefined
    const viewportRect = el.getBoundingClientRect()
    let best: AnchorSnapshot<Key> | undefined
    let bestTop = Infinity
    const nodes = windowNodesRef.value ?? []
    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      if (rect.bottom < viewportRect.top || rect.top > viewportRect.bottom) continue
      if (rect.top >= bestTop) continue
      const idxRaw = node.dataset.vlIdx
      if (!idxRaw) continue
      const rowIndex = Number(idxRaw)
      if (rowIndex < 0 || rowIndex >= itemCount()) continue
      const key = keyOfRenderedNode(node) ?? keyOf(rowIndex)
      bestTop = rect.top
      best = {
        key,
        rowIndex,
        topOffset: rect.top - viewportRect.top,
      }
    }
    return best
  }

  function restoreAnchor(anchor: AnchorSnapshot<Key> | undefined) {
    const el = viewportRef.value
    if (!el || !anchor) return

    const node = getRenderedNodeByKey(anchor.key)
    if (node) {
      const viewportRect = el.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      const delta = nodeRect.top - viewportRect.top - anchor.topOffset
      if (Math.abs(delta) > 0.5) {
        setScrollTop(el.scrollTop + delta)
      }
      return
    }

    const { index: indexNow, viaFallback } = resolveAnchorIndexFast(anchor)
    const pinOffset = viaFallback ? 0 : anchor.topOffset
    if (indexNow < windowStart.value || indexNow >= windowEnd.value) {
      recenter(indexNow)
      nextTick(() => {
        const localIdx = indexNow - windowStart.value
        if (localIdx < 0 || localIdx >= windowEnd.value - windowStart.value) return
        const top = getScrollOffsetBase() + (offsetsRef.value[localIdx] ?? 0)
        setScrollTop(Math.max(0, top - pinOffset))
      })
      return
    }

    const localIdx = indexNow - windowStart.value
    const top = getScrollOffsetBase() + (offsetsRef.value[localIdx] ?? 0)
    setScrollTop(Math.max(0, top - pinOffset))
  }

  return { captureAnchor, restoreAnchor, resolveAnchorIndexFast }
}
