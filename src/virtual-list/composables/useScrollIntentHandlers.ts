import type { Ref } from 'vue'

const TOP_EDGE_EPSILON = 0.5

export function useScrollIntentHandlers(options: {
  scrollTop: Ref<number>
  syncFromViewport: () => void
  consumeNegativeCompensation: (amount: number) => boolean
  onScrollIntent: () => void
}) {
  const { scrollTop, syncFromViewport, consumeNegativeCompensation, onScrollIntent } = options

  let lastTouchClientY: number | undefined

  function handleWheelIntent(event: WheelEvent) {
    syncFromViewport()
    if (scrollTop.value <= TOP_EDGE_EPSILON && event.deltaY < 0) {
      consumeNegativeCompensation(-event.deltaY)
    }
    onScrollIntent()
  }

  function handleTouchStart(event: TouchEvent) {
    lastTouchClientY = event.touches[0]?.clientY
    onScrollIntent()
  }

  function handleTouchMove(event: TouchEvent) {
    const nextY = event.touches[0]?.clientY
    if (nextY !== undefined && lastTouchClientY !== undefined) {
      const delta = nextY - lastTouchClientY
      if (scrollTop.value <= TOP_EDGE_EPSILON && delta > 0) {
        consumeNegativeCompensation(delta)
      }
    }
    lastTouchClientY = nextY
    onScrollIntent()
  }

  return {
    handleWheelIntent,
    handleTouchStart,
    handleTouchMove,
  }
}
