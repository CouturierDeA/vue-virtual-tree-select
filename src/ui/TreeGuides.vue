<template>
  <span class="tree-guides" aria-hidden="true">
    <span v-for="(vertical, channel) in guides.verticals" :key="channel" class="tree-guides__col">
      <i
        v-if="vertical.draw"
        class="tree-guides__line tree-guides__line--vertical"
        :class="{ 'tree-guides__line--on': vertical.active }"
      />
    </span>
    <span class="tree-guides__col">
      <i
        class="tree-guides__line tree-guides__line--up"
        :class="{ 'tree-guides__line--on': connector.upActive }"
      />
      <i
        v-if="connector.hasDown"
        class="tree-guides__line tree-guides__line--down"
        :class="{ 'tree-guides__line--on': connector.downActive }"
      />
      <i
        class="tree-guides__line"
        :class="{
          'tree-guides__line--elbow': canExpand,
          'tree-guides__line--elbow-leaf': !canExpand,
          'tree-guides__line--on': connector.elbowActive,
        }"
      />
      <i
        v-if="connector.descent"
        class="tree-guides__line tree-guides__line--descent"
        :class="{ 'tree-guides__line--on': connector.descentActive }"
      />
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TreeNodeGuides } from '@/tree-builder-core'

const props = defineProps<{
  guides: TreeNodeGuides
  canExpand?: boolean
  indent: string
}>()

const connector = computed(() => props.guides.connector!)
</script>

<style scoped>
@import '@/theme.css';

.tree-guides {
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  left: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: v-bind(indent);
}

.tree-guides__col {
  flex: 0 0 var(--tree-indent-step, 18px);
  position: relative;
}

.tree-guides__line {
  position: absolute;
}

.tree-guides__line--vertical {
  border-left: 1px solid var(--guide);
  bottom: 0;
  left: var(--tree-guide-center, 9px);
  top: 0;
}

.tree-guides__line--up {
  border-left: 1px solid var(--guide);
  height: calc(50% + var(--tree-guide-join-overlap, 1px));
  left: var(--tree-guide-center, 9px);
  top: 0;
}

.tree-guides__line--down {
  border-left: 1px solid var(--guide);
  bottom: 0;
  left: var(--tree-guide-center, 9px);
  top: calc(50% + var(--tree-guide-join-overlap, 1px));
  z-index: 1;
}

.tree-guides__line--descent {
  border-left: 1px solid var(--guide);
  bottom: 0;
  left: calc(100% + var(--tree-guide-center, 9px));
  top: 50%;
}

.tree-guides__line--elbow {
  border-top: 1px solid var(--guide);
  left: calc(var(--tree-guide-center, 9px) + var(--tree-guide-join-overlap, 1px));
  right: calc(0px - var(--tree-row-control-center, 13.5px));
  top: 50%;
}

.tree-guides__line--elbow-leaf {
  border-top: 1px solid var(--guide);
  left: calc(var(--tree-guide-center, 9px) + var(--tree-guide-join-overlap, 1px));
  right: calc(
    0px - var(--tree-row-control-size, 22px) - var(--tree-row-gap, 10px) -
      var(--tree-row-control-center, 11px)
  );
  top: 50%;
}

.tree-guides__line--on {
  border-color: var(--on-path);
}
</style>
