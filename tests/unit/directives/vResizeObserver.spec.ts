import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { vResizeObserver } from '@/directives/vResizeObserver'

function makeObserver() {
  return {
    observe: vi.fn<(target: Element, options?: ResizeObserverOptions) => void>(),
    unobserve: vi.fn<(target: Element) => void>(),
  }
}

let observer: ReturnType<typeof makeObserver>

beforeEach(() => {
  observer = makeObserver()
})

function makeTestComponent(value: ReturnType<typeof makeObserver> | null | undefined) {
  return defineComponent({
    setup() {
      return () =>
        withDirectives(h('div', { 'data-test': 'target' }, 'item'), [[vResizeObserver, value]])
    },
  })
}

describe('vResizeObserver', () => {
  it('calls observer.observe on mount', () => {
    const wrapper = mount(makeTestComponent(observer), { attachTo: document.body })
    expect(observer.observe).toHaveBeenCalledOnce()
    expect(observer.observe.mock.calls[0][0]).toBe(wrapper.element)
    wrapper.unmount()
  })

  it('calls observer.unobserve on unmount', () => {
    const wrapper = mount(makeTestComponent(observer), { attachTo: document.body })
    const element = wrapper.element
    wrapper.unmount()
    expect(observer.unobserve).toHaveBeenCalledOnce()
    expect(observer.unobserve.mock.calls[0][0]).toBe(element)
  })

  it('does not crash if value is null', () => {
    const wrapper = mount(makeTestComponent(null), { attachTo: document.body })
    expect(observer.observe).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(observer.unobserve).not.toHaveBeenCalled()
  })

  it('does not crash if value is undefined', () => {
    const wrapper = mount(makeTestComponent(undefined), { attachTo: document.body })
    expect(observer.observe).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('migrates element when observer reference changes mid-life', async () => {
    const observerA = makeObserver()
    const observerB = makeObserver()
    const current = ref(observerA)

    const TestComponent = defineComponent({
      setup() {
        return () => withDirectives(h('div', {}, 'item'), [[vResizeObserver, current.value]])
      },
    })

    const wrapper = mount(TestComponent, { attachTo: document.body })
    expect(observerA.observe).toHaveBeenCalledOnce()
    expect(observerB.observe).not.toHaveBeenCalled()

    current.value = observerB
    await nextTick()

    expect(observerA.unobserve).toHaveBeenCalledOnce()
    expect(observerB.observe).toHaveBeenCalledOnce()

    wrapper.unmount()

    expect(observerB.unobserve).toHaveBeenCalledOnce()
  })

  it('handles v-for: each item is observed individually and unobserved on remove', async () => {
    const items = ref([1, 2, 3])

    const TestComponent = defineComponent({
      directives: { resizeObserver: vResizeObserver },
      setup() {
        return { items, obs: observer }
      },
      template: `
        <ul>
          <li v-for="item in items" :key="item" v-resize-observer="obs">{{ item }}</li>
        </ul>
      `,
    })

    const wrapper = mount(TestComponent, { attachTo: document.body })

    expect(observer.observe).toHaveBeenCalledTimes(3)

    const removedElement = wrapper.findAll('li')[1].element
    items.value = [1, 3]
    await nextTick()

    expect(observer.unobserve).toHaveBeenCalledTimes(1)
    expect(observer.unobserve.mock.calls[0][0]).toBe(removedElement)

    wrapper.unmount()

    expect(observer.unobserve).toHaveBeenCalledTimes(3)
  })
})
