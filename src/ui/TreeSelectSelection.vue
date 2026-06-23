<template>
  <aside class="tree-select-selection" aria-labelledby="selected-title">
    <h2 id="selected-title" class="tree-select-selection__title" data-qa-id="selected-title">
      <slot name="title" :count="source.length">Selected: {{ source.length }}</slot>
    </h2>
    <VirtualList
      v-if="source.length"
      class="tree-select-selection__list"
      :source="source"
      :max-height="maxHeight"
    >
      <template #scrollbar="{ size, position, viewport, seek }">
        <VirtualScrollbar :size="size" :position="position" :viewport="viewport" @seek="seek" />
      </template>

      <template #default="{ item }">
        <div class="tree-select-selection__item-wrap">
          <slot name="item" :node="item.node">
            <div class="tree-select-selection__item" data-qa-id="selected-item">
              <div class="tree-select-selection__text">
                <slot name="itemText" :node="item.node" />
              </div>
              <button
                class="tree-select-selection__remove"
                type="button"
                data-qa-id="selected-remove"
                :aria-label="`Remove ${getItemLabel(item.node)}`"
                @click="emit('remove', item.key)"
              >
                ×
              </button>
            </div>
          </slot>
        </div>
      </template>
    </VirtualList>
    <p v-else class="tree-select-selection__empty">
      <slot name="empty" />
    </p>
  </aside>
</template>

<script setup lang="ts" generic="Node, Key extends string | number | symbol | object">
import VirtualList from '@/virtual-list/VirtualList.vue'
import VirtualScrollbar from '@/ui/VirtualScrollbar.vue'
import type { RowSource } from '@/virtual-list/rowSource'

withDefaults(
  defineProps<{
    source: RowSource<{ key: Key; node: Node }, Key>
    maxHeight?: number | string
    getItemLabel?: (node: Node) => string
  }>(),
  {
    maxHeight: 360,
    getItemLabel: () => 'item',
  },
)

const emit = defineEmits<{ remove: [key: Key] }>()

defineSlots<{
  title(props: { count: number }): unknown
  item(props: { node: Node }): unknown
  itemText(props: { node: Node }): unknown
  empty(): unknown
}>()
</script>

<style scoped>
@import '@/theme.css';

.tree-select-selection {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
}

.tree-select-selection__title {
  color: var(--text);
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  margin-bottom: 12px;
}

.tree-select-selection__list {
  flex: 1 1 auto;
  min-height: 0;
}

.tree-select-selection__item-wrap {
  padding-bottom: 6px;
}

.tree-select-selection__item {
  align-items: flex-start;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  gap: 8px;
  padding: 8px var(--action-space, 42px) 8px 10px;
  position: relative;
}

.tree-select-selection__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.tree-select-selection__item strong {
  color: var(--code);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.tree-select-selection__item span {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.35;
}

.tree-select-selection__remove {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--text-faint);
  cursor: pointer;
  display: inline-flex;
  font-size: 16px;
  height: var(--action-button-size, 28px);
  justify-content: center;
  line-height: 1;
  opacity: 1;
  padding: 0;
  position: absolute;
  right: var(--action-button-offset, 7px);
  top: var(--action-button-offset, 7px);
  transition:
    opacity 0.12s ease,
    background-color 0.12s ease,
    color 0.12s ease;
  width: var(--action-button-size, 28px);
}

@media (hover: hover) and (pointer: fine) {
  .tree-select-selection__remove {
    opacity: 0;
  }

  .tree-select-selection__item:hover .tree-select-selection__remove,
  .tree-select-selection__remove:focus-visible {
    opacity: 1;
  }
}

.tree-select-selection__remove:hover,
.tree-select-selection__remove:active {
  background: var(--danger-soft);
  color: var(--danger);
}

.tree-select-selection__empty {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  padding: 4px 2px;
}
</style>
