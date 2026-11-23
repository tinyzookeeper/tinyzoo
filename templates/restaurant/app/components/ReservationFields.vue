<script setup lang="ts">
// The fields of the reservation form, the same in every look (each look's stylesheet draws
// `.field` its own way): the day, the time and the number of guests as choices, then the name,
// the phone and a note. The times and the largest group are the owner's own, listed in the
// block. Goes inside the look's <form>, which is a six-column grid from `sm` up.
import type { SiteForm } from '#imports'

const props = defineProps<{ form: SiteForm; block: BlockOf<'reservation'> }>()
const form = props.form
const now = useNow()
const times = computed(() => props.block.times.map((t) => t.time).filter(Boolean))
const guests = computed(() => Array.from({ length: props.block.maxGuests ?? 8 }, (_, i) => String(i + 1)))
// The earliest day is today at the restaurant's own clock; the one chosen at first is tomorrow.
const today = computed(() => clockOf(now.value).date)
if (!form.values.date) form.values.date = addDays(today.value, 1)
if (!form.values.guests) form.values.guests = guests.value.includes('2') ? '2' : guests.value[0]
watch(times, (list) => {
  if (list.length && !list.includes(form.values.time)) form.values.time = list.includes(props.block.defaultTime ?? '') ? props.block.defaultTime : list[0]
}, { immediate: true })
const label = (key: string) => form.fields.value.find((f) => f.key === key)?.label ?? ''
const help = (key: string) => form.fields.value.find((f) => f.key === key)?.help ?? undefined
</script>

<template>
  <div class="field sm:col-span-2">
    <label :for="form.id('date')">{{ label('date') }}</label>
    <input :id="form.id('date')" v-model="form.values.date" name="date" type="date" :min="today" required :aria-invalid="!!form.errors.date">
    <p v-if="form.errors.date" class="field-error">{{ form.errors.date }}</p>
  </div>
  <div class="field sm:col-span-2">
    <label :for="form.id('time')">{{ label('time') }}</label>
    <select v-if="times.length" :id="form.id('time')" v-model="form.values.time" name="time" required :aria-invalid="!!form.errors.time">
      <option v-for="t in times" :key="t" :value="t">{{ t }}</option>
    </select>
    <input v-else :id="form.id('time')" v-model="form.values.time" name="time" type="text" inputmode="numeric" required maxlength="20" :aria-invalid="!!form.errors.time">
    <p v-if="form.errors.time" class="field-error">{{ form.errors.time }}</p>
  </div>
  <div class="field sm:col-span-2">
    <label :for="form.id('guests')">{{ label('guests') }}</label>
    <select :id="form.id('guests')" v-model="form.values.guests" name="guests" required :aria-invalid="!!form.errors.guests">
      <option v-for="g in guests" :key="g" :value="g">{{ g }}</option>
    </select>
    <p v-if="form.errors.guests" class="field-error">{{ form.errors.guests }}</p>
  </div>
  <div class="field sm:col-span-3">
    <label :for="form.id('name')">{{ label('name') }}</label>
    <input :id="form.id('name')" v-model="form.values.name" name="name" type="text" autocomplete="name" :placeholder="help('name')" required maxlength="200" :aria-invalid="!!form.errors.name">
    <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p>
  </div>
  <div class="field sm:col-span-3">
    <label :for="form.id('phone')">{{ label('phone') }}</label>
    <input :id="form.id('phone')" v-model="form.values.phone" name="phone" type="tel" autocomplete="tel" :placeholder="help('phone')" required maxlength="40" :aria-invalid="!!form.errors.phone">
    <p v-if="form.errors.phone" class="field-error">{{ form.errors.phone }}</p>
  </div>
  <div class="field sm:col-span-6">
    <label :for="form.id('note')">{{ label('note') }}</label>
    <textarea :id="form.id('note')" v-model="form.values.note" name="note" rows="2" :placeholder="help('note')" maxlength="2000" :aria-invalid="!!form.errors.note" />
    <p v-if="form.errors.note" class="field-error">{{ form.errors.note }}</p>
  </div>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="sm:col-span-6 field"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
