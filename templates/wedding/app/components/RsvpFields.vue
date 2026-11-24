<script setup lang="ts">
// The fields of the reply form, the same in every look (each look's stylesheet draws
// `.field`, `.choice` and `.check` its own way): the attendance as two large toggles, the main
// course as a choice of the dishes the couple listed in the block, the ride as a sentence to
// tick. A question the couple left empty in the block is not asked. Goes inside the look's
// <form>, which is a two-column grid from `sm` up.
import type { SiteForm } from '#imports'

const props = defineProps<{
  form: SiteForm
  block: BlockOf<'rsvp'>
  /** The fields that take both columns (the rest pair up). */
  full: string[]
  /** The gap between the two toggles. */
  choiceGap?: string
}>()
const form = props.form
const meals = computed(() => props.block.meals.map((m) => m.name).filter(Boolean))
const fields = computed(() => form.fields.value.filter((f) => (f.key === 'meal' ? meals.value.length > 0 : f.key === 'ride' ? !!props.block.busLabel : true)))
// The first dish is chosen until the guest picks another, as a select shows it.
watch(meals, (list) => { if (list.length && !list.includes(form.values.meal)) form.values.meal = list[0] }, { immediate: true })
if (form.values.ride === undefined) form.values.ride = false
</script>

<template>
  <template v-for="f in fields" :key="f.key">
    <fieldset v-if="f.key === 'attending'" class="field sm:col-span-2">
      <legend class="label">{{ f.label }}</legend>
      <div class="grid grid-cols-2" :class="choiceGap ?? 'gap-4'">
        <label v-for="o in f.options" :key="o.value" class="choice">
          <input v-model="form.values[f.key]" class="sr-only" type="radio" :name="f.key" :value="o.value"><span>{{ o.label }}</span>
        </label>
      </div>
    </fieldset>
    <label v-else-if="f.type === 'boolean'" class="check sm:col-span-2">
      <input v-model="form.values[f.key]" type="checkbox" :name="f.key">
      <span>{{ block.busLabel }}</span>
    </label>
    <div v-else class="field" :class="full.includes(f.key) ? 'sm:col-span-2' : ''">
      <label class="label" :for="form.id(f.key)">{{ f.label }}</label>
      <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined" :aria-invalid="!!form.errors[f.key]" />
      <select v-else-if="f.key === 'meal'" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key">
        <option v-for="m in meals" :key="m" :value="m">{{ m }}</option>
      </select>
      <select v-else-if="f.type === 'select'" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :aria-invalid="!!form.errors[f.key]">
        <option v-if="f.default == null" value="" :disabled="f.required">—</option>
        <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <input
        v-else :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined"
        type="text" :autocomplete="f.key === 'name' ? 'name' : undefined" :aria-invalid="!!form.errors[f.key]"
      >
      <p v-if="form.errors[f.key]" class="field-error">{{ form.errors[f.key] }}</p>
    </div>
  </template>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="sm:col-span-2 field"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
