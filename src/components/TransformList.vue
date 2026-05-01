<template>
  <div class="xform-list">
    <div class="xform-header">
      <span>{{ t('transformList.title') }}</span>
      <button @click="flameStore.addXform()" :title="t('transformList.add')">+</button>
    </div>
    <div
      v-for="(xf, i) in flameStore.flame.xforms"
      :key="i"
      :class="['xform-item', { active: i === flameStore.selectedXformIndex && !flameStore.editingFinalXform }]"
      @click="flameStore.selectedXformIndex = i; flameStore.editingFinalXform = false"
    >
      <span class="xform-label">xform {{ i }}</span>
      <span class="xform-var">{{ getVariationSummary(xf) }}</span>
      <button class="xform-del" @click.stop="flameStore.removeXform(i)" v-if="flameStore.flame.xforms.length > 1">×</button>
    </div>
    <div class="xform-separator"></div>
    <div
      :class="['xform-item', 'xform-final', { active: flameStore.editingFinalXform }]"
      @click="flameStore.editingFinalXform = true"
    >
      <span class="xform-label">{{ t('transformList.finalXform') }}</span>
      <span class="xform-var" v-if="flameStore.flame.finalXform">{{ getVariationSummary(flameStore.flame.finalXform) }}</span>
      <span class="xform-var" v-else style="color:#666">—</span>
      <button class="xform-del" @click.stop="onToggleFinal" :title="hasFinal ? t('transformList.removeFinal') : t('transformList.addFinal')">
        {{ hasFinal ? '×' : '+' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFlameStore } from '../stores/flame'
import { useI18n } from '../i18n'
import type { XForm } from '../types/flame'

const flameStore = useFlameStore()
const { t } = useI18n()

const hasFinal = computed(() => !!flameStore.flame.finalXform)

function getVariationSummary(xf: XForm): string {
  const vars = [...xf.variations.entries()].filter(([, _w]) => _w !== 0)
  if (vars.length === 0) return t('transformList.none')
  return vars.map(([n]) => `${n}`).join(', ')
}

function onToggleFinal() {
  if (hasFinal.value) {
    flameStore.setFinalXform(undefined)
    if (flameStore.editingFinalXform) flameStore.editingFinalXform = false
  } else {
    const newXf: XForm = {
      weight: 1,
      color: 0,
      symmetry: 0,
      coefs: [1, 0, 0, 1, 0, 0],
      post: [1, 0, 0, 1, 0, 0],
      variations: new Map([['linear', 1.0]]),
      variationParams: new Map(),
    }
    flameStore.setFinalXform(newXf)
    flameStore.editingFinalXform = true
  }
}
</script>

<style scoped>
.xform-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.xform-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  color: #ccc;
  font-weight: bold;
  font-size: 13px;
  border-bottom: 1px solid #333;
}

.xform-header button {
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: #16213e;
  color: #aaa;
  border: 1px solid #444;
  border-radius: 3px;
  cursor: pointer;
}

.xform-header button:hover {
  background: #0f3460;
  color: #fff;
}

.xform-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  color: #aaa;
}

.xform-item:hover {
  background: #1a1a3e;
}

.xform-item.active {
  background: #0f3460;
  color: #e0e0e0;
}

.xform-label {
  font-weight: bold;
  min-width: 50px;
}

.xform-var {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #888;
  font-family: monospace;
}

.xform-del {
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
}

.xform-del:hover {
  color: #f66;
}

.xform-separator {
  height: 1px;
  margin: 4px 8px;
  background: #333;
}

.xform-final .xform-label {
  color: #8af;
  font-style: italic;
}
</style>
