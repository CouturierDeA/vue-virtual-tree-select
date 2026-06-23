import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, effectScope, h, ref, type PropType } from 'vue'
import { useResizeObserver } from '@/composables/useResizeObserver'

type Box = { w: number; h: number }

const Harness = defineComponent({
  props: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    onBox: { type: Function as PropType<(box: Box) => void>, required: true },
  },
  setup(props) {
    const el = ref<HTMLElement>()
    useResizeObserver(el, (entries) => {
      const rect = entries[entries.length - 1]!.contentRect
      props.onBox({ w: Math.round(rect.width), h: Math.round(rect.height) })
    })
    return () => h('div', { ref: el, style: `width:${props.width}px;height:${props.height}px` })
  },
})

type Wrapper = ReturnType<typeof mount>

describe('useResizeObserver (real ResizeObserver)', () => {
  let wrapper: Wrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it("delivers the element's real content box and re-fires when it actually resizes", async () => {
    const seen: Box[] = []
    wrapper = mount(Harness, {
      attachTo: document.body,
      props: { width: 120, height: 40, onBox: (box) => seen.push(box) },
    })

    // ResizeObserver reports an initial measurement for the observed element
    await vi.waitFor(() => expect(seen).toContainEqual({ w: 120, h: 40 }))

    // a real layout change is what drives the callback — the mock unit test can't exercise this
    await wrapper.setProps({ width: 300, height: 90 })
    await vi.waitFor(() => expect(seen).toContainEqual({ w: 300, h: 90 }))
  })

  it('stops measuring once the scope is disposed (real disconnect)', async () => {
    const element = document.createElement('div')
    element.style.cssText = 'width:100px;height:30px'
    document.body.appendChild(element)

    const widths: number[] = []
    const scope = effectScope()
    let api!: ReturnType<typeof useResizeObserver>
    scope.run(() => {
      api = useResizeObserver(null, (entries) => {
        widths.push(Math.round(entries[entries.length - 1]!.contentRect.width))
      })
    })
    api.observe(element)
    await vi.waitFor(() => expect(widths).toContain(100))

    scope.stop() // onScopeDispose → observer.disconnect()
    const delivered = widths.length

    element.style.width = '400px' // would re-fire if still observed
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(widths.length).toBe(delivered)

    element.remove()
  })
})
