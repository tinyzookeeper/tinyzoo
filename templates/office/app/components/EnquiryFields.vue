<script setup lang="ts">
// The fields of the enquiry form, the same in every look (each look's stylesheet draws `.field`
// and `.field-label` its own way). Goes inside the look's <form>, which is a two-column grid
// from `sm` up: the name and the message take both columns, the e-mail and the phone pair up.
// The website shows a field's help inside it, as an example of what to write.
import type { SiteForm } from '#imports'

const props = defineProps<{
  form: SiteForm
  /** The label's own classes (a look sets the labels' weight and size). */
  labelClass?: string
}>()
const form = props.form
const FULL = ['name', 'message']
</script>

<template>
  <template v-for="f in form.fields.value" :key="f.key">
    <div :class="FULL.includes(f.key) ? 'sm:col-span-2' : ''">
      <label :class="labelClass" :for="form.id(f.key)">{{ f.label }}</label>
      <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" class="field" rows="4" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined" :aria-invalid="!!form.errors[f.key]" />
      <input
        v-else :id="form.id(f.key)" v-model="form.values[f.key]" class="field" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined"
        :type="f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'" :autocomplete="f.key === 'name' ? 'name' : f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : undefined" :aria-invalid="!!form.errors[f.key]"
      >
      <p v-if="form.errors[f.key]" class="field-error">{{ form.errors[f.key] }}</p>
    </div>
  </template>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="sm:col-span-2"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
