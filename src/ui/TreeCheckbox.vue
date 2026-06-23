<template>
  <button
    class="tree-checkbox"
    :class="{
      'tree-checkbox--checked': checked,
      'tree-checkbox--disabled': disabled,
      'tree-checkbox--indeterminate': !checked && indeterminate,
    }"
    :aria-checked="indeterminate ? 'mixed' : checked"
    :disabled="disabled"
    role="checkbox"
    type="button"
    @click="emit('change')"
  />
</template>

<script setup lang="ts">
defineProps<{
  checked?: boolean
  disabled?: boolean
  indeterminate?: boolean
}>()

const emit = defineEmits<{
  (event: 'change'): void
}>()
</script>

<style scoped>
@import '@/theme.css';

.tree-checkbox {
  align-items: center;
  background: var(--surface-2);
  border: 2px solid var(--border-strong);
  border-radius: 4px;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  flex: 0 0 var(--tree-checkbox-size, 22px);
  height: var(--tree-checkbox-size, 22px);
  justify-content: center;
  padding: 0;
  position: relative;
  width: var(--tree-checkbox-size, 22px);
}

.tree-checkbox::after {
  content: '';
  display: block;
}

.tree-checkbox--checked,
.tree-checkbox--indeterminate {
  background: var(--accent);
  border-color: var(--accent);
}

.tree-checkbox--checked::after {
  border-bottom: 2px solid var(--accent-contrast);
  border-right: 2px solid var(--accent-contrast);
  height: 9px;
  margin-top: -2px;
  transform: rotate(45deg);
  width: 5px;
}

.tree-checkbox--indeterminate::after {
  background: var(--accent-contrast);
  border-radius: 999px;
  height: 2px;
  width: 10px;
}

.tree-checkbox:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.tree-checkbox--disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
