<template>
  <header class="tree-select-host-header">
    <h1 id="tree-select-host-title" class="tree-select-host-header__title">Virtual Tree Select</h1>
    <span class="tree-select-host-header__badge">{{ label }}</span>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClassifierNode } from '@/preview/data/classifier'

const props = defineProps<{ data: readonly ClassifierNode[]; originalCount: number }>()

function countNodes(roots: readonly ClassifierNode[]): number {
  let count = 0
  let level: readonly ClassifierNode[] = roots
  while (level.length > 0) {
    count += level.length
    level = level.flatMap((node) => node.children ?? [])
  }
  return count
}

const label = computed(() => {
  const fmt = (value: number) => value.toLocaleString('en-US')
  const total = countNodes(props.data)
  const original = props.originalCount
  if (total === original) return `${fmt(total)} nodes`
  return `${fmt(original)} original · ${fmt(total)} total`
})
</script>

<style scoped>
.tree-select-host-header {
  align-items: flex-start;
  display: flex;
  flex: 0 0 auto;
  gap: 16px;
  justify-content: space-between;
}

.tree-select-host-header__title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
}

.tree-select-host-header__badge {
  background: var(--accent-soft);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--code);
  flex: 0 0 auto;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  padding: 5px 12px;
  white-space: nowrap;
}
</style>
