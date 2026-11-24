<script setup lang="ts">
// The fields of the contact form, the same in every look (each look's stylesheet draws
// `.field`, `.chip` and `.field-error` its own way): name and e-mail side by side, what the
// person needs, and when a call suits them as a choice of the options the owner listed in the
// block (a question left without options is not asked). Goes inside the look's own <form>,
// which is a grid.
import type { SiteForm } from '#imports'

const props = defineProps<{
  form: SiteForm
  block: BlockOf<'contact'>
  /** A class for the labels of the look that sets them as small capitals. */
  labelClass?: string
  /** The gap between the fields. */
  gap?: string
}>()
const form = props.form
const times = computed(() => props.block.times.map((t) => t.name).filter(Boolean))
const field = (key: string) => form.fields.value.find((f) => f.key === key)
// The first choice is picked until the person picks another, as the design shows it.
watch(times, (list) => { if (list.length && !list.includes(form.values.time)) form.values.time = list[0] }, { immediate: true })
</script>

<template>
  <div class="grid md:grid-cols-2" :class="gap ?? 'gap-6'">
    <div v-for="key in ['name', 'email']" :key="key" class="field">
      <template v-if="field(key)">
        <label :class="labelClass" :for="form.id(key)">{{ field(key)!.label }}</label>
        <input
          :id="form.id(key)" v-model="form.values[key]" :name="key" :required="field(key)!.required" :maxlength="field(key)!.max ?? undefined" :placeholder="field(key)!.help ?? undefined"
          :type="key === 'email' ? 'email' : 'text'" :autocomplete="key" :aria-invalid="!!form.errors[key]"
        >
        <p v-if="form.errors[key]" class="field-error">{{ form.errors[key] }}</p>
      </template>
    </div>
  </div>
  <div v-if="field('message')" class="field">
    <label :class="labelClass" :for="form.id('message')">{{ field('message')!.label }}</label>
    <textarea :id="form.id('message')" v-model="form.values.message" name="message" :required="field('message')!.required" :maxlength="field('message')!.max ?? undefined" :placeholder="field('message')!.help ?? undefined" :aria-invalid="!!form.errors.message" />
    <p v-if="form.errors.message" class="field-error">{{ form.errors.message }}</p>
  </div>
  <fieldset v-if="field('time') && times.length" class="field">
    <legend :class="labelClass">{{ field('time')!.label }}</legend>
    <div class="flex flex-wrap gap-2">
      <span v-for="(t, i) in times" :key="t">
        <input :id="form.id(`time-${i}`)" v-model="form.values.time" class="sr-only" type="radio" name="time" :value="t"><label class="chip" :for="form.id(`time-${i}`)">{{ t }}</label>
      </span>
    </div>
  </fieldset>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="field"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
