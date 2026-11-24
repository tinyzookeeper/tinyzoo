<script setup lang="ts">
// The fields of a website form (the contact form, the price estimate), the same in every look
// (each look's stylesheet draws `.field` its own way). The look says how wide each field is
// and what its placeholder says. A question whose choices the agency lists itself (`choices`)
// is a select of those. Goes inside the look's <form>, which is a two-column grid.
import type { SiteForm } from '#imports'

const props = defineProps<{
  form: SiteForm
  /** The grid classes of each field by key; a field left out takes both columns. */
  cols?: Record<string, string>
  placeholders?: Record<string, string>
  /** The choices of a text field the agency words itself, by key; an empty list leaves the field out. */
  choices?: Record<string, string[]>
  /** The class of each label: the look's small capitals, or nothing. */
  labelClass?: string
}>()
const form = props.form
const fields = computed(() => form.fields.value.filter((f) => !props.choices || !(f.key in props.choices) || props.choices[f.key]!.length > 0))
// The first choice is chosen until the visitor picks another, as a select shows it.
watch(() => props.choices, (all) => {
  for (const [key, list] of Object.entries(all ?? {})) if (list.length && !list.includes(form.values[key])) form.values[key] = list[0]
}, { immediate: true })
</script>

<template>
  <template v-for="f in fields" :key="f.key">
    <div class="field" :class="cols?.[f.key] ?? 'col-span-2'">
      <label :class="labelClass" :for="form.id(f.key)">{{ f.label }}</label>
      <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="placeholders?.[f.key]" :aria-invalid="!!form.errors[f.key]" />
      <select v-else-if="choices && f.key in choices" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :aria-invalid="!!form.errors[f.key]">
        <option v-for="c in choices[f.key]" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-else-if="f.type === 'select'" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :aria-invalid="!!form.errors[f.key]">
        <option v-if="f.default == null" value="" :disabled="f.required">—</option>
        <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <input
        v-else :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="placeholders?.[f.key]"
        :type="f.format === 'email' ? 'email' : 'text'" :inputmode="f.key === 'area' ? 'numeric' : undefined"
        :autocomplete="f.key === 'name' ? 'name' : f.key === 'address' ? 'street-address' : undefined" :aria-invalid="!!form.errors[f.key]"
      >
      <p v-if="form.errors[f.key]" class="field-error">{{ form.errors[f.key] }}</p>
    </div>
  </template>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="col-span-2 field"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
