<script setup lang="ts">
// The fields of the contact form, the same in every look (each look's stylesheet draws
// `.field-label` and `.field-control` its own way): name and e-mail side by side, then how many
// people, then the message. Goes inside the look's <form>, which is a two-column grid from `sm`
// up. A look that has no use for a question leaves it out with `skip`.
import type { SiteForm } from '#imports'

const props = defineProps<{ form: SiteForm; skip?: string[]; rows?: number }>()
const form = props.form
const fields = computed(() => form.fields.value.filter((f) => !props.skip?.includes(f.key)))
const wide = (key: string) => key === 'people' || key === 'message'
const autocomplete = (key: string) => (key === 'name' ? 'name' : key === 'email' ? 'email' : undefined)
</script>

<template>
  <div v-for="f in fields" :key="f.key" class="field" :class="wide(f.key) ? 'sm:col-span-2' : ''">
    <label class="field-label" :for="form.id(f.key)">{{ f.label }}</label>
    <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" class="field-control" :name="f.key" :rows="rows ?? 4" :required="f.required" :maxlength="f.max ?? undefined" :aria-invalid="!!form.errors[f.key]" />
    <select v-else-if="f.type === 'select'" :id="form.id(f.key)" v-model="form.values[f.key]" class="field-control" :name="f.key" :required="f.required" :aria-invalid="!!form.errors[f.key]">
      <option v-if="f.default == null" value="" :disabled="f.required">—</option>
      <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <input
      v-else :id="form.id(f.key)" v-model="form.values[f.key]" class="field-control" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined"
      :type="f.format === 'email' ? 'email' : 'text'" :autocomplete="autocomplete(f.key)" :aria-invalid="!!form.errors[f.key]"
    >
    <p v-if="form.errors[f.key]" class="field-error">{{ form.errors[f.key] }}</p>
  </div>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="sm:col-span-2"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
