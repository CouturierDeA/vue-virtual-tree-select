<template>
  <span class="tree-host-row">
    <span class="tree-host-row__code">
      <template v-for="(part, partIndex) in codeParts" :key="`code-${partIndex}`">
        <mark v-if="part.matched" class="tree-host-row__mark">{{ part.text }}</mark>
        <span v-else>{{ part.text }}</span>
      </template>
    </span>
    <span class="tree-host-row__description">
      <template v-for="(part, partIndex) in descriptionParts" :key="`description-${partIndex}`">
        <mark v-if="part.matched" class="tree-host-row__mark">{{ part.text }}</mark>
        <span v-else>{{ part.text }}</span>
      </template>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getHighlightParts } from '@/utils/highlight'
import type { ClassifierNode } from '@/preview/data/classifier'

const props = defineProps<{
  node: ClassifierNode
  search: string
}>()

const codeParts = computed(() => getHighlightParts(props.node.id, props.search))
const descriptionParts = computed(() => getHighlightParts(props.node.description, props.search))
</script>

<style scoped>
.tree-host-row {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.tree-host-row__code {
  color: var(--text-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  margin-right: 6px;
}

.tree-host-row__mark {
  background: var(--highlight-bg);
  border-radius: 3px;
  color: var(--highlight-text);
  margin: 0 -1px;
  padding: 0 1px;
}
</style>
