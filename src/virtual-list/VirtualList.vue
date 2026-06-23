<template>
  <div class="virtual-list-wrap">
    <div
      ref="viewportRef"
      class="virtual-list"
      :class="{ 'virtual-list--custom-bar': hasScrollbarSlot }"
      data-qa-id="vl-viewport"
      :style="{ maxHeight: cssMaxHeight }"
      @scroll.passive="handleScroll"
      @touchstart.passive="handleTouchStart"
      @touchmove.passive="handleTouchMove"
      @wheel.passive="handleWheelIntent"
    >
      <div
        class="virtual-list__spacer"
        data-qa-id="vl-spacer"
        :style="{ height: `${spacerHeight}px` }"
      >
        <div
          class="virtual-list__window"
          data-qa-id="virtual-list-window"
          :style="{ transform: `translateY(${windowTranslateY}px)` }"
        >
          <div
            v-for="row in windowRows"
            :key="row.renderKey"
            v-resize-observer="windowObserverApi"
            v-row-key="row.key"
            :data-vl-idx="row.rowIndex"
            :data-vl-id="row.debugId"
            ref="windowNodesRef"
          >
            <slot :item="row.mapped" :index="row.rowIndex" />
          </div>
        </div>

        <div v-if="bufferAboveRows.length" class="virtual-list__buffer" aria-hidden="true">
          <div
            v-for="row in bufferAboveRows"
            :key="`above-${row.debugId}`"
            v-resize-observer="windowObserverApi"
            v-row-key="row.key"
            :data-vl-idx="row.rowIndex"
            :data-vl-id="row.debugId"
          >
            <slot :item="row.mapped" :index="row.rowIndex" />
          </div>
        </div>

        <div v-if="premeasureAboveRows.length" class="virtual-list__buffer" aria-hidden="true">
          <div
            v-for="row in premeasureAboveRows"
            :key="`premeasure-${row.debugId}`"
            v-resize-observer="windowObserverApi"
            v-row-key="row.key"
            :data-vl-idx="row.rowIndex"
            :data-vl-id="row.debugId"
          >
            <slot :item="row.mapped" :index="row.rowIndex" />
          </div>
        </div>

        <div v-if="bufferBelowRows.length" class="virtual-list__buffer" aria-hidden="true">
          <div
            v-for="row in bufferBelowRows"
            :key="`below-${row.debugId}`"
            v-resize-observer="windowObserverApi"
            v-row-key="row.key"
            :data-vl-idx="row.rowIndex"
            :data-vl-id="row.debugId"
          >
            <slot :item="row.mapped" :index="row.rowIndex" />
          </div>
        </div>
      </div>
    </div>

    <slot
      name="scrollbar"
      :size="estTotalHeight"
      :position="globalOffset"
      :viewport="viewportHeight"
      :seek="onScrollbarSeek"
    />
  </div>
</template>

<script setup lang="ts" generic="Row, Key = unknown">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
  type ObjectDirective,
} from 'vue'
import { useResizeObserver } from '@/composables/useResizeObserver'
import { vResizeObserver } from '@/directives/vResizeObserver'
import type { RenderKey, RowIndex, RowSource } from '@/virtual-list/rowSource'
import { useMeasuredOffsets } from '@/virtual-list/composables/useMeasuredOffsets'
import { useSlidingWindow } from '@/virtual-list/composables/useSlidingWindow'
import { useVisibleRange } from '@/virtual-list/composables/useVisibleRange'
import { useScrollController } from '@/virtual-list/composables/useScrollController'
import { useRowAnchor } from '@/virtual-list/composables/useRowAnchor'
import { useRowMeasurement } from '@/virtual-list/composables/useRowMeasurement'
import { useScrollLayout } from '@/virtual-list/composables/useScrollLayout'
import { useScrollIntentHandlers } from '@/virtual-list/composables/useScrollIntentHandlers'

const props = withDefaults(
  defineProps<{
    /** Core row index/key adapter for the virtual list. */
    source: RowSource<Row, Key>
    /** CSS max-height for the scroll viewport. */
    maxHeight?: string | number
    /** Extra rendered rows before and after the visible range. */
    overscan?: number
    /** Target size of the measured local row window. */
    keepWindow?: number
    /** Grow the local window when visible rows get this close to its edge. */
    keepAroundVisible?: number
    /** Number of rows added to the local window at once. */
    windowGrowChunk?: number
    /** Delay before pruning unused rows after scrolling settles. */
    trimIdleDelayMs?: number
    /** Minimal height used before a row has a real measurement. */
    minUnmeasuredRowHeight?: number
    /** Hidden rows rendered around the viewport so their real heights are known early. */
    premeasureRows?: number
    /** Local scroll-height cap; browsers usually become unreliable around 15-17M px. */
    maxScrollHeight?: number
    /** Stable primitive key used for Vue rendering and height cache. */
    getRenderKey?: (key: Key, rowIndex: RowIndex) => RenderKey
    /** Optional id used only in DOM/debug output. */
    getDebugId?: (key: Key, rowIndex: RowIndex, renderKey: RenderKey) => string
  }>(),
  {
    maxHeight: 360,
    overscan: 8,
    keepWindow: 1000,
    keepAroundVisible: 100,
    windowGrowChunk: 250,
    trimIdleDelayMs: 150,
    minUnmeasuredRowHeight: 1,
    premeasureRows: 5,
    maxScrollHeight: 12_000_000,
  },
)

const slots = defineSlots<{
  default(props: { item: Row; index: number }): unknown
  scrollbar?(props: {
    size: number
    position: number
    viewport: number
    seek: (fraction: number) => void
  }): unknown
}>()

const hasScrollbarSlot = computed(() => !!slots.scrollbar)

const cssMaxHeight = computed(() =>
  typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight,
)

const viewportRef = useTemplateRef('viewportRef')
const windowNodesRef = useTemplateRef('windowNodesRef')
const viewportHeight = ref(0)
const viewportWidth = ref(0)

const windowStart = ref(0)
const windowEnd = ref(0)
const topSpacerHeight = ref(0)
const scrollCompensation = ref(0)
const premeasureStart = ref(0)
const premeasureEnd = ref(0)
const renderedKeys = new WeakMap<HTMLElement, Key>()

const vRowKey: ObjectDirective<HTMLElement, Key> = {
  mounted: (el, binding) => renderedKeys.set(el, binding.value),
  updated: (el, binding) => renderedKeys.set(el, binding.value),
  beforeUnmount: (el) => renderedKeys.delete(el),
}

function itemCount() {
  return props.source.length
}

const renderIds = new WeakMap<object, number>()
let nextRenderId = 0

function defaultRenderKey(key: Key): RenderKey {
  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol') {
    return key
  }
  if (key === null || (typeof key !== 'object' && typeof key !== 'function')) {
    return String(key)
  }
  const obj = key as object
  let id = renderIds.get(obj)
  if (id === undefined) renderIds.set(obj, (id = nextRenderId++))
  return id
}

function keyOf(rowIndex: RowIndex) {
  return props.source.keyAt(rowIndex)
}

function renderKeyFor(key: Key, rowIndex: RowIndex): RenderKey {
  return props.getRenderKey ? props.getRenderKey(key, rowIndex) : defaultRenderKey(key)
}

function itemKey(rowIndex: RowIndex) {
  return renderKeyFor(keyOf(rowIndex), rowIndex)
}

function mappedAt(rowIndex: RowIndex) {
  return props.source.rowAt(rowIndex)
}

function findIndexByKey(key: Key) {
  return props.source.indexOf(key)
}

const {
  offsetsRef,
  windowTotalHeight,
  avgRowHeight,
  getHeightAt,
  getMeasuredHeightAt,
  getMeasuredRangeHeight,
  buildOffsets,
  rebuildOffsetsFrom,
  findLocalIndex,
  recordHeightInPlace,
  triggerHeightsChanged,
  forgetMeasuredHeights,
  maybeCleanupMeasuredHeights,
} = useMeasuredOffsets({
  windowStart,
  windowEnd,
  props,
  itemCount,
  itemKey,
})

const scrollOriginOffset = computed(() => topSpacerHeight.value + scrollCompensation.value)
const spacerHeight = computed(() => Math.max(0, topSpacerHeight.value + windowTotalHeight.value))
const windowTranslateY = computed(() => scrollOriginOffset.value + offsetTop.value)

function getScrollOffsetBase() {
  return scrollOriginOffset.value
}

function clearPremeasureRange(from?: RowIndex, to?: RowIndex) {
  if (from !== undefined && to !== undefined) {
    if (from > premeasureStart.value || to < premeasureEnd.value) return
  }
  premeasureStart.value = 0
  premeasureEnd.value = 0
}

function requestMeasureRange(from: RowIndex, to: RowIndex) {
  if (from >= to) return
  if (premeasureStart.value === premeasureEnd.value) {
    premeasureStart.value = from
    premeasureEnd.value = to
    return
  }
  premeasureStart.value = Math.min(premeasureStart.value, from)
  premeasureEnd.value = Math.max(premeasureEnd.value, to)
}

const {
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
} = useScrollController({
  viewportRef,
  offsetsRef,
  getHeightAt,
  getMeasuredHeightAt,
  viewportHeight,
  windowStart,
  windowEnd,
  itemCount,
  props,
  getScrollOffsetBase,
  recenter: (index: number) => recenterWindowAround(index),
})

const {
  resetScrollLayout,
  addVisualCompensation,
  correctScrollTopBy,
  normalizeTopBoundary,
  consumeNegativeCompensation,
} = useScrollLayout({
  viewportRef,
  windowStart,
  scrollTop,
  topSpacerHeight,
  scrollCompensation,
  isScrollActive,
  runAfterScrollIdle,
  setScrollTop,
  clearMeasureRange: clearPremeasureRange,
})

const {
  localStartIndex,
  localEndIndex,
  startIndex,
  endIndex,
  offsetTop,
  estTotalHeight,
  globalOffset,
} = useVisibleRange({
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
})

type BufferRow = {
  rowIndex: RowIndex
  key: Key
  renderKey: RenderKey
  debugId: string
  mapped: Row
}

function buildRows(from: number, to: number) {
  const rows: BufferRow[] = []
  const len = itemCount()
  const safeFrom = Math.max(0, Math.min(from, len))
  const safeTo = Math.max(safeFrom, Math.min(to, len))
  for (let g = safeFrom; g < safeTo; g++) {
    const key = keyOf(g)
    const renderKey = renderKeyFor(key, g)
    const debugId = props.getDebugId ? props.getDebugId(key, g, renderKey) : String(renderKey)
    rows.push({ rowIndex: g, key, renderKey, debugId, mapped: mappedAt(g) })
  }
  return rows
}

const windowRows = computed(() => buildRows(startIndex.value, endIndex.value))

const bufferAboveRows = computed(() => {
  const size = props.premeasureRows
  if (size <= 0) return []
  return buildRows(Math.max(windowStart.value, startIndex.value - size), startIndex.value)
})

const premeasureAboveRows = computed(() => buildRows(premeasureStart.value, premeasureEnd.value))

const bufferBelowRows = computed(() => {
  const size = props.premeasureRows
  if (size <= 0) return []
  return buildRows(endIndex.value, Math.min(windowEnd.value, endIndex.value + size))
})

const { captureAnchor, restoreAnchor, resolveAnchorIndexFast } = useRowAnchor({
  viewportRef,
  windowNodesRef,
  offsetsRef,
  windowStart,
  windowEnd,
  itemCount,
  keyOf,
  keyOfRenderedNode: (node) => renderedKeys.get(node),
  findIndexByKey,
  resolveFallback: (key) => props.source.fallbackFor?.(key),
  setScrollTop,
  getScrollOffsetBase,
  recenter: (index: number) => recenterWindowAround(index),
})

const {
  clampWindowBounds,
  growWindowToKeepWindow,
  recenterWindowAround,
  maybeExpandWindow,
  scheduleTrim,
  cancelPendingTrim,
} = useSlidingWindow({
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
  clearMeasureRange: clearPremeasureRange,
  resetScrollLayout,
  hasPendingScroll,
  isSuppressed,
})

const SOFT_GUARD_FRACTION = 2 / 3
let heightGuardScheduled = false

function recenterToCurrentTop() {
  const localTop = Math.max(0, scrollTop.value - scrollOriginOffset.value)
  const localIndex = findLocalIndex(localTop)
  const targetIndex = windowStart.value + localIndex
  const within = localTop - (offsetsRef.value[localIndex] ?? 0)
  recenterWindowAround(targetIndex)
  void nextTick(() => {
    const newLocal = targetIndex - windowStart.value
    if (newLocal < 0 || newLocal >= windowEnd.value - windowStart.value) return
    setScrollTop(scrollOriginOffset.value + (offsetsRef.value[newLocal] ?? 0) + within)
  })
}

function enforceHeightGuard() {
  const height = spacerHeight.value
  if (height > props.maxScrollHeight) {
    heightGuardScheduled = false
    recenterToCurrentTop()
    return
  }
  if (height <= props.maxScrollHeight * SOFT_GUARD_FRACTION) return
  if (heightGuardScheduled) return
  heightGuardScheduled = true
  runAfterScrollIdle(() => {
    heightGuardScheduled = false
    recenterToCurrentTop()
  })
}

watch(spacerHeight, () => enforceHeightGuard())

function handleScroll() {
  syncFromViewport()
  if (!isSuppressed()) markScrollActivity()
  maybeExpandWindow()
  normalizeTopBoundary()
  scheduleTrim()
}

function handleScrollIntent() {
  if (!isSuppressed()) markScrollActivity()
  maybeExpandWindow()
  normalizeTopBoundary()
  scheduleTrim()
}

const { handleWheelIntent, handleTouchStart, handleTouchMove } = useScrollIntentHandlers({
  scrollTop,
  syncFromViewport,
  consumeNegativeCompensation,
  onScrollIntent: handleScrollIntent,
})

function scrollToKey(key: Key, align: Parameters<typeof scrollToItem>[1] = 'auto') {
  const index = findIndexByKey(key)
  if (index >= 0) scrollToItem(index, align)
}

defineExpose({ scrollToIndex, scrollToItem, scrollToKey, scrollToOffset })

function reconcileWindowToSource() {
  const anchor = captureAnchor()
  resetScrollLayout()
  maybeCleanupMeasuredHeights(props.keepWindow)

  const len = itemCount()
  if (len === 0) {
    windowStart.value = 0
    windowEnd.value = 0
    buildOffsets()
    return
  }

  if (windowEnd.value === 0 && windowStart.value === 0) {
    windowEnd.value = Math.min(len, props.keepWindow)
    buildOffsets()
    return
  }

  if (anchor) {
    const indexNow = resolveAnchorIndexFast(anchor).index
    const clampedTarget = Math.max(0, Math.min(indexNow, len - 1))

    const stillInWindow = clampedTarget >= windowStart.value && clampedTarget < windowEnd.value

    if (!stillInWindow) {
      recenterWindowAround(clampedTarget)
    } else {
      clampWindowBounds(len)
      growWindowToKeepWindow()
      buildOffsets()
    }

    nextTick(() => {
      restoreAnchor(anchor)
      applyPendingScroll()
    })
  } else {
    clampWindowBounds(len)
    if (windowEnd.value <= windowStart.value) {
      windowStart.value = 0
      windowEnd.value = Math.min(len, props.keepWindow)
    }
    growWindowToKeepWindow()
    buildOffsets()
  }
}

watch([() => props.source, () => props.source.length], reconcileWindowToSource, {
  immediate: true,
  flush: 'pre',
})

watch(viewportWidth, (next, prev) => {
  if (prev === 0 || next === prev) return
  resetScrollLayout()
  forgetMeasuredHeights()
  buildOffsets()
})

useResizeObserver(viewportRef, (entries) => {
  const rect = entries[0]?.contentRect
  if (!rect) return
  viewportHeight.value = rect.height
  viewportWidth.value = rect.width
})

const { windowObserverApi } = useRowMeasurement({
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
  onMeasurementsApplied: () => {
    maybeExpandWindow()
    scheduleTrim()
  },
})

onMounted(() => {
  const viewport = viewportRef.value
  if (!viewport) return
  viewportHeight.value = viewport.clientHeight
  viewportWidth.value = viewport.clientWidth
})

onBeforeUnmount(() => {
  cancelPendingTrim()
  disposeScrollController()
})
</script>

<style scoped>
.virtual-list-wrap {
  position: relative;
}

.virtual-list {
  height: 100%;
  overflow-anchor: none;
  overflow-y: auto;
  position: relative;
  scrollbar-gutter: stable;
}

.virtual-list--custom-bar {
  scrollbar-gutter: auto;
  scrollbar-width: none;
}

.virtual-list--custom-bar::-webkit-scrollbar {
  height: 0;
  width: 0;
}

.virtual-list__spacer {
  position: relative;
}

.virtual-list__window {
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.virtual-list__buffer {
  left: 0;
  overflow: hidden;
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 0;
  visibility: hidden;
}
</style>
