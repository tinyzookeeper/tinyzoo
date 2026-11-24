<script setup lang="ts">
// The fields of the appointment request, the same in both looks (each look's stylesheet draws
// `.label`, `.field` and `.chip` its own way): the insurer as a choice of the insurers listed in
// the Insurers section, when it suits as three chips, the consent as a sentence with a link to
// the page about personal data. Goes inside the look's <form>, in a two-column grid from `sm` up.
import type { SiteForm } from '#imports'
import type { Insurer, OpeningHour } from '../lib/cms-content'

const props = defineProps<{ form: SiteForm; block: BlockOf<'booking'>; insurers: Insurer[]; hours: OpeningHour[] }>()
const form = props.form
const words = useSiteWords()
const privacy = computed(() => (props.block.privacyUrl ? siteHref(props.block.privacyUrl) : null))
// The afternoon chip names the days the practice sees patients after noon ("Odpoledne (út, čt)"),
// from the opening hours: a part of a day that starts at twelve or later. Nothing when it is every open day.
const afternoon = computed(() => {
  const week = weekOf(props.hours)
  const open = WEEK.filter((d) => week[d].length)
  const late = open.filter((d) => week[d].some((s) => s.fromM >= 720))
  return late.length && late.length < open.length ? words.value.inDays(late.map((d) => words.value.daysShort[d])) : ''
})
const optionLabel = (key: string, value: string, label: string) => (key === 'when' && value === 'afternoon' && afternoon.value ? `${label} ${afternoon.value}` : label)
/** The fields that take both columns (the rest pair up). */
const FULL = ['name', 'insurer', 'reason']
// A select shows its first option until the patient picks: "Vyberte".
if (form.values.insurer === undefined) form.values.insurer = ''
</script>

<template>
  <div class="mt-6 grid gap-5 sm:grid-cols-2">
    <template v-for="f in form.fields.value" :key="f.key">
      <fieldset v-if="f.key === 'when'" class="sm:col-span-2">
        <legend class="label">{{ f.label }}</legend>
        <div class="flex flex-wrap gap-2.5">
          <label v-for="o in f.options" :key="o.value" class="chip relative">
            <input v-model="form.values[f.key]" type="radio" :name="f.key" :value="o.value"><span>{{ optionLabel(f.key, o.value, o.label) }}</span>
          </label>
        </div>
      </fieldset>
      <div v-else-if="f.type === 'boolean'" class="sm:col-span-2">
        <label class="flex gap-3 text-[.95rem]">
          <input v-model="form.values[f.key]" type="checkbox" :name="f.key" class="mt-0.5 size-6 shrink-0 accent-[var(--brand)]" :aria-invalid="!!form.errors[f.key]">
          <span>{{ f.label }} <NuxtLink v-if="privacy" class="consent-link underline underline-offset-4 text-ink" :to="privacy">{{ words.privacyLink }}</NuxtLink></span>
        </label>
        <p v-if="form.errors[f.key]" class="field-error">{{ words.consentNeeded }}</p>
      </div>
      <div v-else :class="FULL.includes(f.key) ? 'sm:col-span-2' : ''">
        <label class="label" :for="form.id(f.key)">{{ f.label }}</label>
        <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" class="field" :name="f.key" rows="3" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined" :aria-invalid="!!form.errors[f.key]" />
        <select v-else-if="f.key === 'insurer' && insurers.length" :id="form.id(f.key)" v-model="form.values[f.key]" class="field" :name="f.key" :required="f.required" :aria-invalid="!!form.errors[f.key]">
          <option value="">{{ words.choose }}</option>
          <option v-for="i in insurers" :key="i.id" :value="insurerOption(i)">{{ insurerOption(i) }}</option>
        </select>
        <input
          v-else :id="form.id(f.key)" v-model="form.values[f.key]" class="field" :class="f.key === 'birthYear' || f.key === 'phone' ? 'num' : ''" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined"
          :placeholder="f.key === 'birthYear' ? (f.help ?? undefined) : undefined" :type="f.key === 'phone' ? 'tel' : 'text'" :inputmode="f.key === 'birthYear' ? 'numeric' : undefined"
          :autocomplete="f.key === 'name' ? 'name' : f.key === 'phone' ? 'tel' : undefined" :aria-invalid="!!form.errors[f.key]"
        >
        <p v-if="form.errors[f.key]" class="field-error">{{ form.errors[f.key] }}</p>
      </div>
    </template>
    <KitFormExtras :form="form" />
    <p v-if="form.failure.value" class="sm:col-span-2"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
  </div>
</template>
