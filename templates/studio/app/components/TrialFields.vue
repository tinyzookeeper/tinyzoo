<script setup lang="ts">
// The fields of the trial class sign-up, the same in every look (each look's stylesheet draws
// `.field` its own way): the name, the e-mail, a class chosen from the timetable, one of that
// class's next three dates and the consent. A tap on a class in the timetable chooses it here
// (`useTrialPick`). What arrives in the admin is what the visitor read: "Po 18:00 · Jóga pro
// začátečníky", "pondělí 23. 11. v 18:00". Goes inside the look's <form>, a two-column grid from
// `sm` up; the look draws the button.
import type { SiteForm } from '#imports'

const props = defineProps<{
  form: SiteForm
  block: BlockOf<'signup'>
  slots: Slot[]
  /** The fields that take both columns (the rest pair up). */
  full?: string[]
  /** The look's own classes for the consent line and its box. */
  consentClass?: string
  boxClass?: string
}>()
const form = props.form
const words = useSiteWords()
const pick = useTrialPick()
const { now, week } = useWeek()

const chosen = computed(() => props.slots.find((s) => s.id === pick.value) ?? null)
// The class's next three dates, once the page knows what day it is.
const dates = computed(() => {
  const slot = chosen.value
  if (!slot || !now.value || !week.value) return []
  const first = nextStart(slot, week.value.dates, now.value)
  return [0, 1, 2].map((n) => {
    const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * n)
    return { value: isoDate(d), label: `${words.value.weekdays[d.getDay()]} ${dayMonth(d)} ${words.value.at} ${slot.start}` }
  })
})
const label = (s: Slot) => `${words.value.days[s.dayIndex]!.short} ${s.start} · ${s.title}`
watch([chosen, dates], () => {
  form.values.lesson = chosen.value ? `${words.value.days[chosen.value.dayIndex]!.long} ${chosen.value.start} · ${chosen.value.title}` : ''
  if (!dates.value.some((d) => d.label === form.values.date)) form.values.date = dates.value[0]?.label ?? ''
}, { immediate: true })
const onPick = (e: Event) => { pick.value = (e.target as HTMLSelectElement).value }
const wide = (key: string) => (props.full ?? []).includes(key) ? 'sm:col-span-2' : ''
const fieldOf = (key: string) => form.fields.value.find((f) => f.key === key)
</script>

<template>
  <div class="field" :class="wide('name')">
    <label :for="form.id('name')">{{ fieldOf('name')?.label }}</label>
    <input :id="form.id('name')" v-model="form.values.name" name="name" type="text" autocomplete="name" required :maxlength="fieldOf('name')?.max ?? undefined" :aria-invalid="!!form.errors.name">
    <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p>
  </div>
  <div class="field" :class="wide('email')">
    <label :for="form.id('email')">{{ fieldOf('email')?.label }}</label>
    <input :id="form.id('email')" v-model="form.values.email" name="email" type="email" autocomplete="email" required :aria-invalid="!!form.errors.email">
    <p v-if="form.errors.email" class="field-error">{{ form.errors.email }}</p>
  </div>
  <div class="field" :class="wide('lesson')">
    <label :for="form.id('lesson')">{{ fieldOf('lesson')?.label }}</label>
    <select :id="form.id('lesson')" name="lesson" required :value="pick" :aria-invalid="!!form.errors.lesson" @change="onPick">
      <option value="">{{ words.chooseLesson }}</option>
      <optgroup v-for="d in words.days" :key="d.id" :label="d.long">
        <template v-for="s in slots.filter((x) => x.day === d.id)" :key="s.id">
          <option :value="s.id" :disabled="s.free <= 0">{{ label(s) }}{{ s.free <= 0 ? ` (${words.full})` : '' }}</option>
        </template>
      </optgroup>
    </select>
    <p v-if="form.errors.lesson" class="field-error">{{ form.errors.lesson }}</p>
  </div>
  <div class="field" :class="wide('date')">
    <label :for="form.id('date')">{{ fieldOf('date')?.label }}</label>
    <select :id="form.id('date')" v-model="form.values.date" name="date" required :disabled="!chosen" :aria-invalid="!!form.errors.date">
      <option v-if="!chosen || !dates.length" value="">{{ words.chooseLessonFirst }}</option>
      <option v-for="d in dates" :key="d.value" :value="d.label">{{ d.label }}</option>
    </select>
    <p v-if="form.errors.date" class="field-error">{{ form.errors.date }}</p>
  </div>
  <label class="sm:col-span-2 flex items-start gap-3" :class="consentClass">
    <input v-model="form.values.consent" type="checkbox" name="consent" :class="boxClass" required><span>{{ block.consent }}</span>
  </label>
  <p v-if="form.errors.consent" class="sm:col-span-2 field"><span class="field-error" role="alert">{{ form.errors.consent }}</span></p>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="sm:col-span-2 field"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
