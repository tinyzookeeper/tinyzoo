<script setup lang="ts">
// The fields of the enquiry form, the same in every look (each look's stylesheet draws
// `.field` and `.opt`): the contact details, what to build and when to start as a choice of
// what the firm listed in the block, whether the client has a project and a permit as three
// options, and the message. A question the firm left empty in the block is not asked. Goes
// inside the look's <form>, which is a two-column grid from `sm` up.
import type { SiteForm } from '#imports'

const props = defineProps<{
  form: SiteForm
  block: BlockOf<'enquiry'>
  /** The classes of a field's label and of the group's legend, as the look has them. */
  labelClass: string
  legendClass?: string
}>()
const form = props.form
const kinds = computed(() => props.block.kinds.map((k) => k.name).filter(Boolean))
const starts = computed(() => props.block.starts.map((k) => k.name).filter(Boolean))
const fields = computed(() => form.fields.value.filter((f) => (f.key === 'kind' ? kinds.value.length > 0 : f.key === 'start' ? starts.value.length > 0 : true)))
// The first choice is picked until the client picks another, as a select shows it.
watch(kinds, (list) => { if (list.length && !list.includes(form.values.kind)) form.values.kind = list[0] }, { immediate: true })
watch(starts, (list) => { if (list.length && !list.includes(form.values.start)) form.values.start = list[0] }, { immediate: true })
const CHOICES: Record<string, () => string[]> = { kind: () => kinds.value, start: () => starts.value }
</script>

<template>
  <template v-for="f in fields" :key="f.key">
    <fieldset v-if="f.type === 'select'" class="sm:col-span-2" data-permit>
      <legend :class="legendClass ?? labelClass">{{ f.label }}</legend>
      <div class="grid gap-2 sm:grid-cols-3">
        <label v-for="o in f.options" :key="o.value" class="opt">
          <input v-model="form.values[f.key]" type="radio" :name="f.key" :value="o.value"> {{ o.label }}
        </label>
      </div>
    </fieldset>
    <label v-else class="block" :class="f.multiline ? 'sm:col-span-2' : ''">
      <span :class="labelClass">{{ f.label }}</span>
      <textarea v-if="f.multiline" v-model="form.values[f.key]" class="field" :name="f.key" rows="4" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined" :aria-invalid="!!form.errors[f.key]" />
      <select v-else-if="CHOICES[f.key]" v-model="form.values[f.key]" class="field" :name="f.key">
        <option v-for="c in CHOICES[f.key]!()" :key="c" :value="c">{{ c }}</option>
      </select>
      <input
        v-else v-model="form.values[f.key]" class="field" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined"
        :type="f.key === 'phone' ? 'tel' : f.key === 'email' ? 'email' : 'text'" :autocomplete="f.key === 'name' ? 'name' : f.key === 'phone' ? 'tel' : f.key === 'email' ? 'email' : undefined" :aria-invalid="!!form.errors[f.key]"
      >
      <span v-if="form.errors[f.key]" class="field-error block">{{ form.errors[f.key] }}</span>
    </label>
  </template>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="sm:col-span-2"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
