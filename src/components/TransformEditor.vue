<template>
  <div class="xform-editor" v-if="xform">
    <h3>{{ t('transformEditor.title') }} {{ flameStore.selectedXformIndex }}</h3>

    <div class="section">
      <label>{{ t('transformEditor.weight') }}</label>
      <input type="number" v-wheel-step :value="xform.weight" step="0.1" min="0"
        @input="updateField('weight', $event)" />
    </div>

    <div class="section">
      <label>{{ t('transformEditor.color') }}</label>
      <input type="range" v-wheel-step :value="xform.color" min="0" max="1" step="0.01"
        @input="updateField('color', $event)" />
      <span class="val">{{ xform.color.toFixed(2) }}</span>
    </div>

    <div class="section">
      <label>{{ t('transformEditor.symmetry') }}</label>
      <input type="range" v-wheel-step :value="xform.symmetry" min="0" max="1" step="0.01"
        @input="updateField('symmetry', $event)" />
      <span class="val">{{ xform.symmetry.toFixed(2) }}</span>
    </div>

    <h4>{{ t('transformEditor.affineCoeffs') }}</h4>
    <div class="coef-grid">
      <template v-for="(name, i) in coefNames" :key="i">
        <label>{{ name }}</label>
        <input type="number" v-wheel-step :value="xform.coefs[i]" step="0.01"
          @input="updateCoef(i, $event)" />
      </template>
    </div>

    <h4>{{ t('transformEditor.variations') }}</h4>
    <div class="variations">
      <div v-for="v in allVariations" :key="v" class="var-row">
        <label>{{ v }}</label>
        <input type="range" v-wheel-step :value="getWeight(v)" min="0" max="2" step="0.01"
          @input="updateVariation(v, $event)" />
        <span class="val">{{ getWeight(v).toFixed(2) }}</span>
      </div>
    </div>

    <div v-if="hasJulianParams" class="section extra-params">
      <label>{{ t('transformEditor.julianPower') }}</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('julian_power') ?? 1" step="1"
        @input="updateVarParam('julian_power', $event)" />
      <label>{{ t('transformEditor.julianDist') }}</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('julian_dist') ?? 1" step="0.1"
        @input="updateVarParam('julian_dist', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFlameStore } from '../stores/flame'
import { useI18n } from '../i18n'
import { ALL_VARIATION_NAMES } from '../types/flame'

const flameStore = useFlameStore()
const { t } = useI18n()
const coefNames = ['a', 'b', 'c', 'd', 'e', 'f']
const allVariations = ALL_VARIATION_NAMES

const xform = computed(() => {
  const f = flameStore.flame
  return f.xforms[flameStore.selectedXformIndex] ?? null
})

const hasJulianParams = computed(() => {
  return (xform.value?.variations.get('julian') ?? 0) !== 0
})

function getWeight(name: string): number {
  return xform.value?.variations.get(name) ?? 0
}

function updateField(field: string, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  flameStore.updateXform(flameStore.selectedXformIndex, { [field]: val })
}

function updateCoef(i: number, e: Event) {
  if (!xform.value) return
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  const coefs = [...xform.value.coefs] as [number, number, number, number, number, number]
  coefs[i] = val
  flameStore.updateXform(flameStore.selectedXformIndex, { coefs })
}

function updateVariation(name: string, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  flameStore.updateVariation(flameStore.selectedXformIndex, name, val)
}

function updateVarParam(name: string, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  flameStore.updateVariationParam(flameStore.selectedXformIndex, name, val)
}
</script>

<style scoped>
.xform-editor {
  padding: 8px;
  overflow-y: auto;
  font-size: 12px;
}

h3 {
  margin: 0 0 8px 0;
  color: #ccc;
  font-size: 14px;
}

h4 {
  margin: 12px 0 4px 0;
  color: #aaa;
  font-size: 12px;
  border-top: 1px solid #333;
  padding-top: 8px;
}

.section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.section label {
  min-width: 60px;
  color: #999;
}

.coef-grid {
  display: grid;
  grid-template-columns: 30px 1fr;
  gap: 2px 4px;
  align-items: center;
}

.coef-grid label {
  color: #888;
  font-family: monospace;
}

.variations {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.var-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.var-row label {
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
  min-width: 30px;
  text-align: right;
}

.extra-params {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #333;
  flex-direction: column;
  align-items: flex-start;
}
</style>
