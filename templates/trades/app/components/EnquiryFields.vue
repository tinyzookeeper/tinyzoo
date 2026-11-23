<script setup lang="ts">
// The fields of the enquiry, the same in every look (each look's stylesheet draws `.field`
// its own way). Goes inside the look's <form>, which is a two-column grid from `sm` up: the
// name and the phone side by side, the rest across.
import type { SiteForm } from '#imports'

const props = defineProps<{ form: SiteForm }>()
const form = props.form
const full = ['town', 'message']
</script>

<template>
  <div v-for="f in form.fields.value" :key="f.key" class="field" :class="full.includes(f.key) ? 'sm:col-span-2' : ''">
    <label :for="form.id(f.key)">{{ f.label }}</label>
    <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined" :aria-invalid="!!form.errors[f.key]" />
    <input
      v-else :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined"
      :type="f.key === 'phone' ? 'tel' : 'text'" :inputmode="f.key === 'phone' ? 'tel' : undefined"
      :autocomplete="f.key === 'name' ? 'name' : f.key === 'phone' ? 'tel' : f.key === 'town' ? 'address-level2' : undefined" :aria-invalid="!!form.errors[f.key]"
    >
    <p v-if="form.errors[f.key]" class="field-error">{{ form.errors[f.key] }}</p>
  </div>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="sm:col-span-2 field"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
