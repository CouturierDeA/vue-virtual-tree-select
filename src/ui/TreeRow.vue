<template>
  <div
    class="tree-row"
    :class="{
      'tree-row--active': active,
      'tree-row--disabled': disabled,
      'tree-row--match-ancestor': matchAncestor && !active,
      'tree-row--matched': matched && !active,
      'tree-row--root-open': depth === 0 && canExpand && opened,
    }"
    data-qa-id="tree-row"
    :data-qa-active="active || undefined"
    :data-qa-match="matched || undefined"
    :data-qa-match-ancestor="matchAncestor || undefined"
  >
    <slot
      v-if="guides?.connector"
      name="guides"
      :guides="guides"
      :can-expand="canExpand"
      :indent="indent"
    >
      <tree-guides :guides="guides" :can-expand="canExpand" :indent="indent" />
    </slot>

    <slot name="toggle" :opened="opened" :can-expand="canExpand" :toggle="toggleOpened">
      <button
        v-if="canExpand"
        class="tree-row__toggle"
        :class="{ 'tree-row__toggle--on-path': matchAncestor && depth === 0 && !opened }"
        :aria-label="toggleLabel"
        :aria-expanded="opened"
        type="button"
        data-qa-id="tree-row-toggle"
        @click.stop="toggleOpened"
      >
        {{ opened ? '▾' : '▸' }}
      </button>
      <span v-else class="tree-row__spacer" />
    </slot>

    <slot
      name="checkbox"
      :checked="checked"
      :indeterminate="indeterminate"
      :disabled="disabled"
      :toggle="toggleChecked"
    >
      <tree-checkbox
        class="tree-row__checkbox"
        :aria-label="checkboxLabel"
        :checked="checked"
        :disabled="disabled"
        :indeterminate="indeterminate"
        @change="toggleChecked"
      />
    </slot>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TreeCheckbox from '@/ui/TreeCheckbox.vue'
import TreeGuides from '@/ui/TreeGuides.vue'
import type { TreeNodeGuides } from '@/tree-builder-core'

const props = withDefaults(
  defineProps<{
    checked?: boolean
    indeterminate?: boolean
    opened?: boolean
    matched?: boolean
    matchAncestor?: boolean
    active?: boolean
    canExpand?: boolean
    disabled?: boolean
    guides?: TreeNodeGuides
    depth?: number
    checkboxLabel?: string
    toggleLabel?: string
  }>(),
  {
    checked: false,
    indeterminate: false,
    opened: false,
    matched: false,
    matchAncestor: false,
    active: false,
    canExpand: false,
    disabled: false,
    depth: 0,
    checkboxLabel: 'Toggle row selection',
    toggleLabel: 'Toggle row expansion',
  },
)

const emit = defineEmits<{
  (event: 'toggle-checked'): void
  (event: 'toggle-opened'): void
}>()

function toggleOpened() {
  emit('toggle-opened')
}

function toggleChecked() {
  emit('toggle-checked')
}

const TREE_INDENT_STEP_PX = 18
const indent = computed(
  () => `calc(var(--tree-indent-base, 12px) + ${props.depth * TREE_INDENT_STEP_PX}px)`,
)
</script>

<style scoped>
@import '@/theme.css';

.tree-row {
  align-items: center;
  box-sizing: border-box;
  color: var(--text);
  display: flex;
  font-size: 14px;
  gap: var(--tree-row-gap, 10px);
  min-width: 0;
  padding-right: 12px;
  padding-left: v-bind(indent);
  padding-block: 9px;
  position: relative;
  transition: background-color 0.12s ease;
}

.tree-row:not(.tree-row--match-ancestor):not(.tree-row--matched):not(
    .tree-row--active
  ):hover {
  background: var(--surface-hover);
}

.tree-row--matched {
  background: var(--match);
}

.tree-row--active {
  background: var(--selected);
}

.tree-row--disabled {
  color: var(--text-faint);
}

.tree-row__toggle,
.tree-row__spacer {
  flex: 0 0 var(--tree-row-toggle-size, 22px);
  height: var(--tree-row-toggle-size, 22px);
  width: var(--tree-row-toggle-size, 22px);
}

.tree-row__toggle {
  align-items: center;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  font-size: 11px;
  justify-content: center;
  padding: 0;
  position: relative;
  z-index: 1;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;
}

.tree-row__toggle:not(:disabled):hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  color: var(--text);
}

.tree-row__toggle:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.tree-row__toggle:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.tree-row__toggle--on-path {
  border-color: var(--on-path);
  color: var(--on-path);
}

.tree-row__checkbox {
  flex: 0 0 var(--tree-checkbox-size, 22px);
}

.tree-row--root-open::after {
  border-left: 1px solid var(--guide);
  bottom: 0;
  content: '';
  left: calc(v-bind(indent) + var(--tree-guide-center, 9px));
  pointer-events: none;
  position: absolute;
  top: 50%;
}

.tree-row--root-open.tree-row--match-ancestor::after,
.tree-row--root-open.tree-row--matched::after {
  border-color: var(--on-path);
}
</style>
