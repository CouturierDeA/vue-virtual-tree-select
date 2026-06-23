<template>
  <div class="tree-select-host-toolbar">
    <form class="tree-select-host-toolbar__row" @submit.prevent="onToolbarSubmit">
      <div class="tree-select-host-toolbar__field">
        <label for="tree-select-selection-strategy">Selection</label>
        <select id="tree-select-selection-strategy" v-model="selectionStrategy">
          <option v-for="o in strategyOptions" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>
      <div class="tree-select-host-toolbar__field">
        <label for="tree-select-node-count">Nodes</label>
        <input
          id="tree-select-node-count"
          ref="nodeCountInput"
          class="tree-select-host-toolbar__input tree-select-host-toolbar__input--count"
          data-qa-id="node-count-input"
          type="text"
          :value="nodeCount"
          @input="onNodeCountInput"
          @change="onNodeCountChange"
        />
      </div>
      <div class="tree-select-host-toolbar__check-field">
        <tree-checkbox
          aria-label="Expand all"
          :checked="expandAll"
          @change="expandAll = !expandAll"
        />
        <button
          class="tree-select-host-toolbar__check-label"
          type="button"
          @click="expandAll = !expandAll"
        >
          Expand all
        </button>
      </div>
    </form>

    <form class="tree-select-host-toolbar__filter-row" @submit.prevent="onSearchSubmit">
      <div class="tree-select-host-toolbar__field tree-select-host-toolbar__field--wide">
        <label for="tree-select-filter">Filter / Search</label>
        <input
          id="tree-select-filter"
          ref="filterInput"
          class="tree-select-host-toolbar__input"
          data-qa-id="filter-input"
          enterkeyhint="search"
          placeholder="Filter or navigate matching nodes…"
          type="search"
          v-model="query"
        />
      </div>
      <div class="tree-select-host-toolbar__field">
        <span>Search view</span>
        <div class="tree-select-host-toolbar__toggle-group">
          <button
            class="tree-select-host-toolbar__toggle-btn"
            :class="{ 'tree-select-host-toolbar__toggle-btn--active': viewMode === 'tree' }"
            :data-qa-active="viewMode === 'tree' || undefined"
            data-qa-id="view-tree"
            type="button"
            @click="viewMode = 'tree'"
          >
            Tree
          </button>
          <button
            class="tree-select-host-toolbar__toggle-btn"
            :class="{ 'tree-select-host-toolbar__toggle-btn--active': viewMode === 'tree-filter' }"
            :data-qa-active="viewMode === 'tree-filter' || undefined"
            data-qa-id="view-tree-filter"
            type="button"
            @click="viewMode = 'tree-filter'"
          >
            Tree filter
          </button>
        </div>
      </div>
      <div
        class="tree-select-host-toolbar__nav"
        :class="{ 'tree-select-host-toolbar__nav--visible': query }"
        :aria-hidden="query ? undefined : 'true'"
        data-qa-id="nav"
        :data-qa-visible="query ? '' : undefined"
      >
        <button
          class="tree-select-host-toolbar__nav-btn"
          data-qa-id="nav-prev"
          type="button"
          aria-label="Previous match"
          :disabled="!matchCount"
          @click="$emit('go-to-prev')"
        >
          ▲
        </button>
        <span class="tree-select-host-toolbar__nav-count" data-qa-id="nav-count">
          {{ matchCount ? `${currentMatchIndex + 1} / ${matchCount}` : '0 / 0' }}
        </span>
        <button
          class="tree-select-host-toolbar__nav-btn"
          data-qa-id="nav-next"
          type="button"
          aria-label="Next match"
          :disabled="!matchCount"
          @click="$emit('go-to-next')"
        >
          ▼
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import TreeCheckbox from '@/ui/TreeCheckbox.vue'
import { clampNodeCount } from '@/preview/data/treeData'
type ViewMode = 'tree' | 'tree-filter'
type SelectionStrategyName = 'cascadeCompact' | 'cascadeAll' | 'independent'

const selectionStrategy = defineModel<SelectionStrategyName>('selectionStrategy', {
  required: true,
})
const expandAll = defineModel<boolean>('expandAll', { required: true })
const query = defineModel<string>('query', { required: true })
const viewMode = defineModel<ViewMode>('viewMode', { required: true })
const nodeCount = defineModel<number>('nodeCount', { required: true })
const nodeCountInput = useTemplateRef('nodeCountInput')
const filterInput = useTemplateRef('filterInput')

defineProps<{
  currentMatchIndex: number
  matchCount: number
}>()

const emit = defineEmits<{
  (e: 'go-to-prev'): void
  (e: 'go-to-next'): void
  (e: 'submit-search'): void
}>()

const strategyOptions: Array<{ label: string; value: SelectionStrategyName }> = [
  { label: 'Compact cascade', value: 'cascadeCompact' },
  { label: 'All selected nodes', value: 'cascadeAll' },
  { label: 'Independent nodes', value: 'independent' },
]

function commitNodeCount(input: HTMLInputElement) {
  const parsed = Number(input.value)
  if (clampNodeCount(parsed) === parsed) {
    nodeCount.value = parsed
    return
  }
  input.value = String(nodeCount.value)
}

function onNodeCountInput(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '')
  if (input.value !== digits) input.value = digits
}

function onNodeCountChange(event: Event) {
  commitNodeCount(event.target as HTMLInputElement)
}

function onToolbarSubmit() {
  const input = nodeCountInput.value
  if (!input) return
  commitNodeCount(input)
  input.blur()
}

function onSearchSubmit() {
  const input = filterInput.value
  if (input) {
    query.value = input.value
    input.blur()
  }
  emit('submit-search')
}
</script>

<style scoped>
.tree-select-host-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tree-select-host-toolbar__row {
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.tree-select-host-toolbar__filter-row {
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.tree-select-host-toolbar__field {
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  font-size: 11px;
  font-weight: 600;
  gap: 6px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tree-select-host-toolbar__field--wide {
  flex: 1 1 240px;
  min-width: 0;
}

.tree-select-host-toolbar__field select,
.tree-select-host-toolbar__input {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-size: 16px;
  font-weight: 400;
  letter-spacing: normal;
  min-height: var(--control-size, 36px);
  padding: 7px 11px;
  text-transform: none;
}

.tree-select-host-toolbar__input {
  box-sizing: border-box;
  width: 100%;
}

.tree-select-host-toolbar__input--count {
  appearance: textfield;
  width: 120px;
}

.tree-select-host-toolbar__input--count::-webkit-inner-spin-button,
.tree-select-host-toolbar__input--count::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.tree-select-host-toolbar__field select:focus,
.tree-select-host-toolbar__input:focus {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
  outline: none;
}

.tree-select-host-toolbar__check-field {
  align-items: center;
  align-self: flex-end;
  color: var(--text-muted);
  display: inline-flex;
  font-size: 13px;
  gap: 8px;
  min-height: var(--control-size, 36px);
}

.tree-select-host-toolbar__check-label {
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  padding: 0;
}

.tree-select-host-toolbar__check-label:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.tree-select-host-toolbar__nav {
  align-items: center;
  display: flex;
  gap: 4px;
  pointer-events: none;
  visibility: hidden;
}

.tree-select-host-toolbar__nav--visible {
  pointer-events: auto;
  visibility: visible;
}

.tree-select-host-toolbar__nav-btn {
  align-items: center;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  font-size: 11px;
  height: var(--control-size, 36px);
  justify-content: center;
  padding: 0;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease;
  width: var(--icon-button-size, 34px);
}

.tree-select-host-toolbar__nav-btn:disabled {
  color: var(--text-faint);
  cursor: default;
}

.tree-select-host-toolbar__nav-btn:not(:disabled):hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.tree-select-host-toolbar__toggle-group {
  display: flex;
  min-height: var(--control-size, 36px);
}

.tree-select-host-toolbar__toggle-btn {
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  min-height: var(--control-size, 36px);
  padding: 0 14px;
  text-transform: none;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.tree-select-host-toolbar__toggle-btn:first-child {
  border-radius: 8px 0 0 8px;
}

.tree-select-host-toolbar__toggle-btn:last-child {
  border-left: none;
  border-radius: 0 8px 8px 0;
}

.tree-select-host-toolbar__toggle-btn:not(:first-child):not(:last-child) {
  border-left: none;
}

.tree-select-host-toolbar__toggle-btn:not(.tree-select-host-toolbar__toggle-btn--active):hover {
  background: var(--surface-hover);
  color: var(--text);
}

.tree-select-host-toolbar__toggle-btn--active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--surface);
}

.tree-select-host-toolbar__nav-count {
  color: var(--text);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  min-width: 50px;
  text-align: center;
  white-space: nowrap;
}
</style>
