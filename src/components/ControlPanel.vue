<template>
  <div class="control-panel">
    <h3>{{ t('controlPanel.renderSettings') }}</h3>

    <div class="param-row">
      <label>{{ t('controlPanel.sampleDensity') }}</label>
      <input type="range" v-wheel-step :value="flame.quality" min="1" max="1000" step="1"
        @input="update('quality', $event)" />
      <span class="val">{{ flame.quality }}</span>
    </div>

    <div class="param-row">
      <label>{{ t('controlPanel.oversample') }}</label>
      <input type="range" v-wheel-step :value="flame.oversample" min="1" max="5" step="1"
        @input="update('oversample', $event)" />
      <span class="val">{{ flame.oversample }}</span>
    </div>

    <div class="param-row">
      <label>{{ t('controlPanel.filterRadius') }}</label>
      <input type="range" v-wheel-step :value="flame.filterRadius" min="0" max="3" step="0.01"
        @input="update('filterRadius', $event)" />
      <span class="val">{{ flame.filterRadius.toFixed(2) }}</span>
    </div>

    <h3>{{ t('controlPanel.color') }}</h3>

    <div class="param-row">
      <label>{{ t('controlPanel.brightness') }}</label>
      <input type="range" v-wheel-step :value="flame.brightness" min="0.1" max="30" step="0.1"
        @input="update('brightness', $event)" />
      <span class="val">{{ flame.brightness.toFixed(1) }}</span>
    </div>

    <div class="param-row">
      <label>{{ t('controlPanel.gamma') }}</label>
      <input type="range" v-wheel-step :value="flame.gamma" min="0.5" max="5" step="0.01"
        @input="update('gamma', $event)" />
      <span class="val">{{ flame.gamma.toFixed(2) }}</span>
    </div>

    <div class="param-row">
      <label>{{ t('controlPanel.contrast') }}</label>
      <input type="range" v-wheel-step :value="flame.contrast" min="0.1" max="5" step="0.01"
        @input="update('contrast', $event)" />
      <span class="val">{{ flame.contrast.toFixed(2) }}</span>
    </div>

    <div class="param-row">
      <label>{{ t('controlPanel.vibrancy') }}</label>
      <input type="range" v-wheel-step :value="flame.vibrancy" min="0" max="2" step="0.01"
        @input="update('vibrancy', $event)" />
      <span class="val">{{ flame.vibrancy.toFixed(2) }}</span>
    </div>

    <h3>{{ t('controlPanel.canvas') }}</h3>

    <div class="param-row">
      <label>{{ t('controlPanel.width') }}</label>
      <input type="number" v-wheel-step :value="flame.width" step="100" min="100" max="4096"
        @input="update('width', $event)" />
    </div>

    <div class="param-row">
      <label>{{ t('controlPanel.height') }}</label>
      <input type="number" v-wheel-step :value="flame.height" step="100" min="100" max="4096"
        @input="update('height', $event)" />
    </div>

    <div class="param-row">
      <label>{{ t('controlPanel.scale') }}</label>
      <input type="number" v-wheel-step :value="flame.scale" step="10" min="1"
        @input="update('scale', $event)" />
    </div>

    <div class="param-row">
      <label>{{ t('controlPanel.centerX') }}</label>
      <input type="number" v-wheel-step :value="flame.center[0]" step="0.1"
        @input="updateCenter(0, $event)" />
    </div>

    <div class="param-row">
      <label>{{ t('controlPanel.centerY') }}</label>
      <input type="number" v-wheel-step :value="flame.center[1]" step="0.1"
        @input="updateCenter(1, $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFlameStore } from '../stores/flame'
import { useI18n } from '../i18n'

const flameStore = useFlameStore()
const { t } = useI18n()
const flame = computed(() => flameStore.flame)

function update(key: string, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  flameStore.updateRenderParam(key as keyof typeof flame.value, val)
}

function updateCenter(axis: number, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  const center: [number, number] = [...flame.value.center]
  center[axis] = val
  flameStore.updateRenderParam('center', center)
}
</script>

<style scoped>
.control-panel {
  padding: 8px;
  overflow-y: auto;
  font-size: 12px;
}

h3 {
  margin: 8px 0 4px 0;
  color: #ccc;
  font-size: 13px;
  border-top: 1px solid #333;
  padding-top: 8px;
}

h3:first-child {
  margin-top: 0;
  border-top: none;
  padding-top: 0;
}

.param-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.param-row label {
  min-width: 80px;
  color: #999;
  font-size: 11px;
}

input[type="number"] {
  width: 70px;
  background: #1a1a2e;
  color: #e0e0e0;
  border: 1px solid #444;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
}

input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #333;
  border-radius: 2px;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #0f3460;
  border: 1px solid #5599ff;
  cursor: pointer;
}

.val {
  color: #888;
  font-family: monospace;
  min-width: 35px;
  text-align: right;
}
</style>
