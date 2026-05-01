<template>
  <div class="xform-editor" v-if="xform">
    <h3>{{ isFinal ? t('transformList.finalXform') : t('transformEditor.title') + ' ' + flameStore.selectedXformIndex }}</h3>

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

    <h4>{{ t('transformEditor.postAffine') }}</h4>
    <div class="coef-grid">
      <template v-for="(name, i) in coefNames" :key="'p' + i">
        <label>{{ name }}</label>
        <input type="number" v-wheel-step :value="getPostCoef(i)" step="0.01"
          @input="updatePostCoef(i, $event)" />
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

    <div v-if="hasRings" class="section extra-params">
      <label>rings_coeff</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('rings_coeff') ?? 0.5" step="0.1"
        @input="updateVarParam('rings_coeff', $event)" />
    </div>

    <div v-if="hasFan" class="section extra-params">
      <label>fan_dist</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('fan_dist') ?? 0.5" step="0.1"
        @input="updateVarParam('fan_dist', $event)" />
    </div>

    <div v-if="hasBlob" class="section extra-params">
      <label>blob_low</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('blob_low') ?? 0.7" step="0.1"
        @input="updateVarParam('blob_low', $event)" />
      <label>blob_high</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('blob_high') ?? 1.0" step="0.1"
        @input="updateVarParam('blob_high', $event)" />
      <label>blob_waves</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('blob_waves') ?? 5.0" step="1"
        @input="updateVarParam('blob_waves', $event)" />
    </div>

    <div v-if="hasPdj" class="section extra-params">
      <label>pdj1</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('pdj1') ?? 1.0" step="1"
        @input="updateVarParam('pdj1', $event)" />
      <label>pdj2</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('pdj2') ?? 1.0" step="1"
        @input="updateVarParam('pdj2', $event)" />
      <label>pdj3</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('pdj3') ?? 1.0" step="1"
        @input="updateVarParam('pdj3', $event)" />
      <label>pdj4</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('pdj4') ?? 1.0" step="1"
        @input="updateVarParam('pdj4', $event)" />
    </div>

    <div v-if="hasPerspective" class="section extra-params">
      <label>perspective_angle</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('perspective_angle') ?? 0.5" step="0.1"
        @input="updateVarParam('perspective_angle', $event)" />
      <label>perspective_dist</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('perspective_dist') ?? 1.0" step="0.1"
        @input="updateVarParam('perspective_dist', $event)" />
    </div>

    <div v-if="hasNgon" class="section extra-params">
      <label>ngon_power</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('ngon_power') ?? 2.0" step="0.1"
        @input="updateVarParam('ngon_power', $event)" />
      <label>ngon_sides</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('ngon_sides') ?? 5.0" step="1"
        @input="updateVarParam('ngon_sides', $event)" />
      <label>ngon_corners</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('ngon_corners') ?? 0.0" step="0.1"
        @input="updateVarParam('ngon_corners', $event)" />
      <label>ngon_circle</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('ngon_circle') ?? 0.0" step="0.1"
        @input="updateVarParam('ngon_circle', $event)" />
    </div>

    <div v-if="hasCurl" class="section extra-params">
      <label>curl_c1</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('curl_c1') ?? 0.5" step="0.1"
        @input="updateVarParam('curl_c1', $event)" />
      <label>curl_c2</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('curl_c2') ?? 0.5" step="0.1"
        @input="updateVarParam('curl_c2', $event)" />
    </div>

    <div v-if="hasBipolar" class="section extra-params">
      <label>bipolar_shift</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bipolar_shift') ?? 0.0" step="0.1"
        @input="updateVarParam('bipolar_shift', $event)" />
    </div>

    <div v-if="hasCell" class="section extra-params">
      <label>cell_size</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('cell_size') ?? 0.5" step="0.1"
        @input="updateVarParam('cell_size', $event)" />
    </div>

    <div v-if="hasCrackle" class="section extra-params">
      <label>crackle_scale</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('crackle_scale') ?? 1.0" step="0.1"
        @input="updateVarParam('crackle_scale', $event)" />
      <label>crackle_z</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('crackle_z') ?? 0.0" step="0.1"
        @input="updateVarParam('crackle_z', $event)" />
      <label>crackle_spreadx</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('crackle_spreadx') ?? 1.0" step="0.1"
        @input="updateVarParam('crackle_spreadx', $event)" />
      <label>crackle_spready</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('crackle_spready') ?? 1.0" step="0.1"
        @input="updateVarParam('crackle_spready', $event)" />
    </div>

    <div v-if="hasJuliascope" class="section extra-params">
      <label>juliascope_power</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('juliascope_power') ?? 2.0" step="1"
        @input="updateVarParam('juliascope_power', $event)" />
      <label>juliascope_dist</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('juliascope_dist') ?? 1.0" step="0.1"
        @input="updateVarParam('juliascope_dist', $event)" />
    </div>

    <div v-if="hasSplit" class="section extra-params">
      <label>split_xsize</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('split_xsize') ?? 0.3" step="0.1"
        @input="updateVarParam('split_xsize', $event)" />
      <label>split_ysize</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('split_ysize') ?? 0.3" step="0.1"
        @input="updateVarParam('split_ysize', $event)" />
    </div>

    <div v-if="hasWedge" class="section extra-params">
      <label>wedge_angle</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_angle') ?? 0.0" step="0.1"
        @input="updateVarParam('wedge_angle', $event)" />
      <label>wedge_hole</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_hole') ?? 0.0" step="0.1"
        @input="updateVarParam('wedge_hole', $event)" />
      <label>wedge_count</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_count') ?? 5.0" step="1"
        @input="updateVarParam('wedge_count', $event)" />
      <label>wedge_swirl</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_swirl') ?? 0.0" step="0.1"
        @input="updateVarParam('wedge_swirl', $event)" />
    </div>

    <div v-if="hasWedgeJulia" class="section extra-params">
      <label>wedge_julia_power</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_julia_power') ?? 2.0" step="1"
        @input="updateVarParam('wedge_julia_power', $event)" />
      <label>wedge_julia_angle</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_julia_angle') ?? 0.0" step="0.1"
        @input="updateVarParam('wedge_julia_angle', $event)" />
      <label>wedge_julia_count</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_julia_count') ?? 5.0" step="1"
        @input="updateVarParam('wedge_julia_count', $event)" />
      <label>wedge_julia_dist</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_julia_dist') ?? 1.0" step="0.1"
        @input="updateVarParam('wedge_julia_dist', $event)" />
    </div>

    <div v-if="hasWedgeSph" class="section extra-params">
      <label>wedge_sph_angle</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_sph_angle') ?? 0.0" step="0.1"
        @input="updateVarParam('wedge_sph_angle', $event)" />
      <label>wedge_sph_hole</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_sph_hole') ?? 0.0" step="0.1"
        @input="updateVarParam('wedge_sph_hole', $event)" />
      <label>wedge_sph_count</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_sph_count') ?? 5.0" step="1"
        @input="updateVarParam('wedge_sph_count', $event)" />
      <label>wedge_sph_swirl</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('wedge_sph_swirl') ?? 0.0" step="0.1"
        @input="updateVarParam('wedge_sph_swirl', $event)" />
    </div>

    <div v-if="hasBwraps" class="section extra-params">
      <label>bwraps_cellsize</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps_cellsize') ?? 1.0" step="0.1"
        @input="updateVarParam('bwraps_cellsize', $event)" />
      <label>bwraps_space</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps_space') ?? 0.5" step="0.1"
        @input="updateVarParam('bwraps_space', $event)" />
      <label>bwraps_gain</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps_gain') ?? 1.0" step="0.1"
        @input="updateVarParam('bwraps_gain', $event)" />
      <label>bwraps_innerTwist</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps_innerTwist') ?? 0.0" step="0.1"
        @input="updateVarParam('bwraps_innerTwist', $event)" />
      <label>bwraps_outerTwist</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps_outerTwist') ?? 0.0" step="0.1"
        @input="updateVarParam('bwraps_outerTwist', $event)" />
    </div>

    <div v-if="hasBwraps7" class="section extra-params">
      <label>bwraps7_cellsize</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps7_cellsize') ?? 1.0" step="0.1"
        @input="updateVarParam('bwraps7_cellsize', $event)" />
      <label>bwraps7_space</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps7_space') ?? 0.5" step="0.1"
        @input="updateVarParam('bwraps7_space', $event)" />
      <label>bwraps7_gain</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps7_gain') ?? 1.0" step="0.1"
        @input="updateVarParam('bwraps7_gain', $event)" />
      <label>bwraps7_innerTwist</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps7_innerTwist') ?? 0.0" step="0.1"
        @input="updateVarParam('bwraps7_innerTwist', $event)" />
      <label>bwraps7_outerTwist</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('bwraps7_outerTwist') ?? 0.0" step="0.1"
        @input="updateVarParam('bwraps7_outerTwist', $event)" />
    </div>

    <div v-if="hasMotionBlur" class="section extra-params">
      <label>motion_blur_angle</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('motion_blur_angle') ?? 0.0" step="0.1"
        @input="updateVarParam('motion_blur_angle', $event)" />
      <label>motion_blur_length</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('motion_blur_length') ?? 0.5" step="0.1"
        @input="updateVarParam('motion_blur_length', $event)" />
    </div>

    <div v-if="hasRadialBlur" class="section extra-params">
      <label>radial_blur_angle</label>
      <input type="number" v-wheel-step :value="xform.variationParams.get('radial_blur_angle') ?? 0.1" step="0.05"
        @input="updateVarParam('radial_blur_angle', $event)" />
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

const isFinal = computed(() => flameStore.editingFinalXform)

const xform = computed(() => {
  const f = flameStore.flame
  if (flameStore.editingFinalXform) {
    return f.finalXform ?? null
  }
  return f.xforms[flameStore.selectedXformIndex] ?? null
})

const hasJulianParams = computed(() => {
  return (xform.value?.variations.get('julian') ?? 0) !== 0
})
const hasRings = computed(() => (xform.value?.variations.get('rings') ?? 0) !== 0)
const hasFan = computed(() => (xform.value?.variations.get('fan') ?? 0) !== 0)
const hasBlob = computed(() => (xform.value?.variations.get('blob') ?? 0) !== 0)
const hasPdj = computed(() => (xform.value?.variations.get('pdj') ?? 0) !== 0)
const hasPerspective = computed(() => (xform.value?.variations.get('perspective') ?? 0) !== 0)
const hasNgon = computed(() => (xform.value?.variations.get('ngon') ?? 0) !== 0)
const hasCurl = computed(() => (xform.value?.variations.get('curl') ?? 0) !== 0)
const hasBipolar = computed(() => (xform.value?.variations.get('bipolar') ?? 0) !== 0)
const hasCell = computed(() => (xform.value?.variations.get('cell') ?? 0) !== 0)
const hasCrackle = computed(() => (xform.value?.variations.get('crackle') ?? 0) !== 0)
const hasJuliascope = computed(() => (xform.value?.variations.get('juliascope') ?? 0) !== 0)
const hasSplit = computed(() => (xform.value?.variations.get('split') ?? 0) !== 0)
const hasWedge = computed(() => (xform.value?.variations.get('wedge') ?? 0) !== 0)
const hasWedgeJulia = computed(() => (xform.value?.variations.get('wedge_julia') ?? 0) !== 0)
const hasWedgeSph = computed(() => (xform.value?.variations.get('wedge_sph') ?? 0) !== 0)
const hasBwraps = computed(() => (xform.value?.variations.get('bwraps') ?? 0) !== 0)
const hasBwraps7 = computed(() => (xform.value?.variations.get('bwraps7') ?? 0) !== 0)
const hasMotionBlur = computed(() => (xform.value?.variations.get('motion_blur') ?? 0) !== 0)
const hasRadialBlur = computed(() => (xform.value?.variations.get('radial_blur') ?? 0) !== 0)

function getWeight(name: string): number {
  return xform.value?.variations.get(name) ?? 0
}

function getPostCoef(i: number): number {
  return xform.value?.post?.[i] ?? (i === 0 || i === 3 ? 1 : 0)
}

function update(updates: Partial<import('../types/flame').XForm>) {
  if (isFinal.value) {
    flameStore.updateFinalXform(updates)
  } else {
    flameStore.updateXform(flameStore.selectedXformIndex, updates)
  }
}

function updateField(field: string, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  update({ [field]: val })
}

function updateCoef(i: number, e: Event) {
  if (!xform.value) return
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  const coefs = [...xform.value.coefs] as [number, number, number, number, number, number]
  coefs[i] = val
  update({ coefs })
}

function updatePostCoef(i: number, e: Event) {
  if (!xform.value) return
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  const post = [...(xform.value.post ?? [1, 0, 0, 1, 0, 0])] as [number, number, number, number, number, number]
  post[i] = val
  update({ post })
}

function updateVariation(name: string, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  if (isFinal.value) {
    const xf = flameStore.flame.finalXform
    if (!xf) return
    if (val === 0) {
      xf.variations.delete(name)
    } else {
      xf.variations.set(name, val)
    }
    flameStore.updateFinalXform({ variations: xf.variations })
  } else {
    flameStore.updateVariation(flameStore.selectedXformIndex, name, val)
  }
}

function updateVarParam(name: string, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(val)) return
  if (isFinal.value) {
    const xf = flameStore.flame.finalXform
    if (!xf) return
    xf.variationParams.set(name, val)
    flameStore.updateFinalXform({ variationParams: xf.variationParams })
  } else {
    flameStore.updateVariationParam(flameStore.selectedXformIndex, name, val)
  }
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
