<template>
  <TreeSelectHostView class="vue-tree-select-theme" :empty="!rowCount" :loading="loading">
    <template #header>
      <TreeSelectHostHeader :data="treeData" :original-count="originalCount" />
    </template>

    <template #toolbar>
      <TreeSelectHostToolbar
        :query="query"
        @update:query="onQuery"
        :node-count="nodeCount"
        @update:node-count="onUpdateNodeCount"
        v-model:view-mode="searchViewMode"
        v-model:selection-strategy="selectionStrategyName"
        :expand-all="expandAll"
        @update:expand-all="onExpandAll"
        :current-match-index="currentMatchIndex"
        :match-count="matchCount"
        @go-to-prev="goToPrev"
        @go-to-next="goToNext"
        @submit-search="goToNext"
      />
    </template>

    <VirtualList
      ref="listRef"
      :max-height="maxHeight"
      :max-scroll-height="maxScrollHeight"
      :source="source"
    >
      <template #scrollbar="{ size, position, viewport, seek }">
        <VirtualScrollbar :size="size" :position="position" :viewport="viewport" @seek="seek" />
      </template>

      <template #default="{ item }">
        <TreeRow
          :checked="item.checked"
          :indeterminate="item.indeterminate"
          :opened="item.opened"
          :matched="item.matched"
          :match-ancestor="item.matchAncestor"
          :active="item.active"
          :can-expand="item.canExpand"
          :disabled="item.disabled"
          :depth="item.depth"
          :guides="item.guides"
          :checkbox-label="`Select ${nodeLabel(item.node)}`"
          :toggle-label="`${item.opened ? 'Collapse' : 'Expand'} ${nodeLabel(item.node)}`"
          @toggle-checked="toggleChecked(item.key)"
          @toggle-opened="toggleOpened(item.key)"
        >
          <TreeHostRow :node="item.node" :search="query" />
        </TreeRow>
      </template>
    </VirtualList>

    <template #empty>No options</template>

    <template #aside>
      <TreeSelectSelection
        :source="selectedSource"
        :max-height="maxHeight"
        :get-item-label="nodeLabel"
        @remove="(key) => setChecked(key, false)"
      >
        <template #title="{ count }">Selected: {{ count }}</template>
        <template #itemText="{ node }">
          <strong>{{ node.id }}</strong>
          <span>{{ node.description }}</span>
        </template>
        <template #empty>Check categories in the tree to collect them here.</template>
      </TreeSelectSelection>
    </template>
  </TreeSelectHostView>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import VirtualList from '@/virtual-list/VirtualList.vue'
import VirtualScrollbar from '@/ui/VirtualScrollbar.vue'
import TreeRow from '@/ui/TreeRow.vue'
import TreeSelectSelection from '@/ui/TreeSelectSelection.vue'
import TreeSelectHostView from '@/preview/components/TreeSelectHostView.vue'
import TreeSelectHostHeader from '@/preview/components/TreeSelectHostHeader.vue'
import TreeSelectHostToolbar from '@/preview/components/TreeSelectHostToolbar.vue'
import TreeHostRow from '@/preview/components/TreeHostRow.vue'
import type { ClassifierNode } from '@/preview/data/classifier'
import {
  cascadeAll,
  cascadeCompact,
  independent,
  buildIndicesFromNested,
} from '@/tree-builder-core'
import { useTreeData } from '@/composables/tree/useTreeData'
import { useTreeSelect } from '@/composables/tree/useTreeSelect'

// You can use a node object itself as a key
const getKey = (node: ClassifierNode) => node
// const getKey = (node: ClassifierNode) => node.id // or the key (id) of the node.
type NodeKey = ReturnType<typeof getKey>

const selected = defineModel<NodeKey[]>('selected', { default: () => [] })
const opened = defineModel<NodeKey[]>('opened', { default: () => [] })

const { treeData, nodeCount, originalCount, loading, updateNodeCount, readNodes } = useTreeData()
await readNodes()

const getChildren = (item: ClassifierNode) => item.children
const getSearchText = (item: ClassifierNode) => `${item.id} ${item.description}`
const nodeLabel = (item: ClassifierNode) => `${item.id} ${item.description}`

const indices = computed(() => buildIndicesFromNested(treeData.value, { getChildren }))

const listRef = useTemplateRef('listRef')
const scrollToKey = (key: NodeKey, align: 'center') => listRef.value?.scrollToKey(key, align)

type SelectionStrategyName = 'cascadeCompact' | 'cascadeAll' | 'independent'
const selectionStrategies = { cascadeCompact, cascadeAll, independent }
const selectionStrategyName = ref<SelectionStrategyName>('cascadeCompact')
const selectionStrategy = computed(() => selectionStrategies[selectionStrategyName.value])
const maxHeight = '100%'
const maxScrollHeight = (() => {
  const raw = new URLSearchParams(window.location.search).get('maxScrollHeight')
  const parsed = raw === null ? NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
})()

const {
  structure,
  source,
  rowCount,
  query,
  onQuery,
  searchViewMode,
  expandAll,
  onExpandAll,
  currentMatchIndex,
  matchCount,
  goToPrev,
  goToNext,
  selectedSource,
  getCheckedKeys,
  getOpenedKeys,
  toggleChecked,
  toggleOpened,
  setChecked,
  setCheckedKeys,
  setOpenedKeys,
} = useTreeSelect({
  indices,
  getKey,
  getSearchText,
  scrollToKey,
  selectionStrategy,
  runsSearchInWorker: true,
})

// Demo preset: select and open the first node from the flat list of nodes.
function presetNodes(node?: NodeKey) {
  const nodes = node ? [node] : []
  selected.value = nodes
  opened.value = nodes
  setCheckedKeys(selected.value)
  setOpenedKeys(opened.value)
}

presetNodes(getKey(structure.value.getNode(1)))

function onUpdateNodeCount(count: number) {
  presetNodes()
  updateNodeCount(count)
}

function publishSelectedKeys() {
  selected.value = getCheckedKeys()
}

function publishOpenedKeys() {
  opened.value = getOpenedKeys()
}

// You can use dynamic sync like this
// watch(selectedSource, publishSelectedKeys)
// watch(openedIndices, publishOpenedKeys)
// openedIndices is returned from useTreeSelect and should be destructured when dynamic sync is needed.
// But these watches can be expensive for large trees because they may materialize many keys.
// So it's better to call publishSelectedKeys and publishOpenedKeys manually
// when synchronization is needed, for example, on form submission.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function onSubmit() {
  publishSelectedKeys()
  publishOpenedKeys()
}
</script>

<style scoped>
@import '@/theme.css';
.vue-tree-select-theme {
  touch-action: manipulation;
}
</style>
