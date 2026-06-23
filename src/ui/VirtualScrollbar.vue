<template>
  <div
    v-if="scrollable"
    ref="trackRef"
    class="virtual-scrollbar"
    :class="{ 'virtual-scrollbar--dragging': isDragging }"
    data-qa-id="virtual-scrollbar"
    @pointerdown="onTrackPointerDown"
  >
    <div
      class="virtual-scrollbar__thumb"
      data-qa-id="virtual-scrollbar-thumb"
      :style="{ height: `${thumbHeight}px`, transform: `translateY(${thumbTop}px)` }"
      @pointerdown.stop="onThumbPointerDown"
      @pointermove="onThumbPointerMove"
      @pointerup="onThumbPointerUp"
      @pointercancel="onThumbPointerUp"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useResizeObserver } from '@/composables/useResizeObserver'

// Presentation-only scrollbar driven by size/position/viewport; emits a normalized
// seek(fraction ∈ [0,1]) on drag or track-click. Knows nothing about windowing.
const props = withDefaults(
  defineProps<{
    size: number
    position: number
    viewport: number
    minThumb?: number
  }>(),
  { minThumb: 24 },
)

const emit = defineEmits<{ (event: 'seek', fraction: number): void }>()

const trackRef = useTemplateRef<HTMLElement>('trackRef')
const trackHeight = ref(0)

const isDragging = ref(false)
const dragThumbTop = ref(0)
let dragStartY = 0
let dragStartTop = 0

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value))

const scrollable = computed(() => props.size > props.viewport + 1)
const maxScroll = computed(() => Math.max(1, props.size - props.viewport))

const thumbHeight = computed(() => {
  if (props.size <= 0) return props.minThumb
  const raw = trackHeight.value * (props.viewport / props.size)
  return clamp(raw, props.minThumb, trackHeight.value)
})

const thumbTravel = computed(() => Math.max(0, trackHeight.value - thumbHeight.value))

const thumbTop = computed(() => {
  if (isDragging.value) return dragThumbTop.value
  return clamp(thumbTravel.value * (props.position / maxScroll.value), 0, thumbTravel.value)
})

// rAF-throttle the seek so a fast drag emits at most once per frame.
let rafId = 0
let pendingFraction = 0
function emitSeek(fraction: number): void {
  pendingFraction = fraction
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    emit('seek', pendingFraction)
  })
}

function onThumbPointerDown(event: PointerEvent): void {
  event.preventDefault()
  dragStartY = event.clientY
  dragStartTop = thumbTop.value
  dragThumbTop.value = dragStartTop
  isDragging.value = true
  try {
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    // capture is a nicety; dragging still works without it
  }
}

function onThumbPointerMove(event: PointerEvent): void {
  if (!isDragging.value) return
  const next = clamp(dragStartTop + (event.clientY - dragStartY), 0, thumbTravel.value)
  dragThumbTop.value = next
  if (thumbTravel.value > 0) emitSeek(next / thumbTravel.value)
}

function onThumbPointerUp(event: PointerEvent): void {
  if (!isDragging.value) return
  isDragging.value = false
  try {
    ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
  } catch {
    // nothing to release
  }
}

// track click centres the thumb on the cursor
function onTrackPointerDown(event: PointerEvent): void {
  const track = trackRef.value
  if (!track || thumbTravel.value <= 0) return
  const rect = track.getBoundingClientRect()
  const top = clamp(event.clientY - rect.top - thumbHeight.value / 2, 0, thumbTravel.value)
  emit('seek', top / thumbTravel.value)
}

useResizeObserver(trackRef, (entries) => {
  trackHeight.value = entries[0]?.contentRect.height ?? 0
})

onMounted(() => {
  trackHeight.value = trackRef.value?.clientHeight ?? 0
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
@import '@/theme.css';

.virtual-scrollbar {
  bottom: 0;
  position: absolute;
  right: 0;
  top: 0;
  touch-action: none;
  width: 12px;
  z-index: 2;
}

.virtual-scrollbar__thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
  cursor: grab;
  left: 2px;
  position: absolute;
  right: 2px;
  top: 0;
  transition: background-color 120ms ease;
}

.virtual-scrollbar__thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.virtual-scrollbar--dragging .virtual-scrollbar__thumb,
.virtual-scrollbar__thumb:active {
  background: var(--scrollbar-thumb-hover);
  cursor: grabbing;
}
</style>
