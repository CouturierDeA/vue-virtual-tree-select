<template>
  <main class="tree-select-host-view vue-tree-select-theme" aria-labelledby="tree-select-host-title">
    <slot name="header" />

    <div class="tree-select-host-view__workspace">
      <div v-if="$slots.toolbar" class="tree-select-host-view__toolbar">
        <slot name="toolbar" />
      </div>

      <div class="tree-select-host-view__body">
        <section class="tree-select-host-view__panel" data-qa-id="tree" aria-label="Tree options">
          <div v-if="empty" class="tree-select-host-view__empty">
            <slot name="empty" />
          </div>
          <div v-else class="tree-select-host-view__list">
            <slot />
          </div>
          <div v-if="loading" class="tree-select-host-view__loading" data-qa-id="tree-loading">
            Loading…
          </div>
        </section>
        <slot name="aside" />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
defineProps<{ empty?: boolean; loading?: boolean }>()
</script>

<style scoped>
.tree-select-host-view {
  box-sizing: border-box;
  color: var(--text);
  display: flex;
  flex-direction: column;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  gap: 18px;
  height: 100vh;
  margin: 0 auto;
  max-width: 1200px;
  padding: 24px;
}

.tree-select-host-view__workspace {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.tree-select-host-view__toolbar {
  flex: 0 0 auto;
}

.tree-select-host-view__body {
  display: grid;
  flex: 1 1 auto;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) 320px;
  min-height: 0;
}

.tree-select-host-view__panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.tree-select-host-view__list {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
}

.tree-select-host-view__loading {
  align-items: center;
  background: var(--overlay);
  color: var(--text-muted);
  display: flex;
  font-size: 14px;
  inset: 0;
  justify-content: center;
  position: absolute;
  z-index: 2;
}

.tree-select-host-view__empty {
  align-items: center;
  color: var(--text-faint);
  display: flex;
  flex: 1;
  justify-content: center;
  padding: 12px;
}

@media (max-width: 900px) {
  .tree-select-host-view {
    height: auto;
    min-height: 100vh;
  }
  .tree-select-host-view__body {
    grid-auto-rows: 60vh;
    grid-template-columns: 1fr;
  }
}
</style>
