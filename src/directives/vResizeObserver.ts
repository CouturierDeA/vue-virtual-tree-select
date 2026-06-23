import type { Directive } from 'vue'

export interface ResizeObserverLike {
  observe: (target: Element, options?: ResizeObserverOptions) => void
  unobserve: (target: Element) => void
}

export const vResizeObserver: Directive<Element, ResizeObserverLike | null | undefined> = {
  mounted(element, binding) {
    binding.value?.observe(element)
  },
  beforeUnmount(element, binding) {
    binding.value?.unobserve(element)
  },
  updated(element, binding) {
    if (binding.value === binding.oldValue) return
    binding.oldValue?.unobserve(element)
    binding.value?.observe(element)
  },
}
