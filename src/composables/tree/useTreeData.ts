import { nextTick, ref, shallowRef } from 'vue'
import {
  clampNodeCount,
  countNodes,
  loadTreeData,
  originalNodeCount,
  readNodesParam,
} from '@/preview/data/treeData'
import { debounce } from '@/utils/debounce'
import type { ClassifierNode } from '@/preview/data/classifier'

// One macrotask so the browser paints the loading overlay before the synchronous
// tile/buildIndices work (up to 2M nodes) blocks the main thread.
function nextPaint() {
  return new Promise<void>((resolve) => setTimeout(resolve, 32))
}

export function useTreeData() {
  const treeData = shallowRef<ClassifierNode[]>([])
  const nodeCount = ref(0)
  const originalCount = ref(0)
  const loading = ref(false)

  async function reloadData(count: number) {
    loading.value = true
    await nextTick()
    await nextPaint()
    try {
      treeData.value = await loadTreeData(count)
      await nextTick()
    } finally {
      loading.value = false
    }
  }

  const debouncedReload = debounce((count: number) => {
    void reloadData(count)
  }, 400)

  function updateNodeCount(value: number) {
    const clamped = clampNodeCount(value)
    nodeCount.value = clamped
    debouncedReload(clamped)
  }

  async function readNodes() {
    originalCount.value = await originalNodeCount()
    const initial = readNodesParam()
    treeData.value = await loadTreeData(initial)
    nodeCount.value = initial ?? countNodes(treeData.value)
  }

  return { treeData, nodeCount, originalCount, loading, updateNodeCount, readNodes }
}
