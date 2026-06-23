import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue'

export interface UseResizeObserverReturn {
  observe: (target: Element, options?: ResizeObserverOptions) => void
  unobserve: (target: Element) => void
  disconnect: () => void
  stop: () => void
  isSupported: boolean
}

export function useResizeObserver(
  target: MaybeRefOrGetter<Element | undefined | null>,
  callback: ResizeObserverCallback,
  options?: ResizeObserverOptions,
): UseResizeObserverReturn {
  const isSupported = typeof window !== 'undefined' && 'ResizeObserver' in window

  if (!isSupported) {
    const noop = () => {}
    return {
      observe: noop,
      unobserve: noop,
      disconnect: noop,
      stop: noop,
      isSupported: false,
    }
  }

  const observer = new ResizeObserver(callback)
  let stopWatch: (() => void) | null = null
  let stopped = false

  function observe(element: Element, opts?: ResizeObserverOptions) {
    if (stopped) return
    observer.observe(element, opts ?? options)
  }

  function unobserve(element: Element) {
    if (stopped) return
    observer.unobserve(element)
  }

  function disconnect() {
    observer.disconnect()
  }

  function stop() {
    if (stopped) return
    stopped = true
    stopWatch?.()
    observer.disconnect()
  }

  if (target !== null && target !== undefined) {
    stopWatch = watch(
      () => toValue(target) ?? null,
      (newTarget, oldTarget) => {
        if (oldTarget) observer.unobserve(oldTarget)
        if (newTarget) observer.observe(newTarget, options)
      },
      { immediate: true, flush: 'post' },
    )
  }

  onScopeDispose(stop)

  return { observe, unobserve, disconnect, stop, isSupported: true }
}
