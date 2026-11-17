<script setup lang="ts">
// Date & time, edited as wall-clock time in the admin's time zone (cms.admin.timeZone)
// and stored as an exact instant. The browser's own zone plays no part.
//
// The day is picked from a calendar ("Saturday 13 June 2026"), the time typed beside
// it. `f.datetime({ allDay: true })` adds "All day": the time goes away and the value
// is stored at 0:00.
import type { ButtonProps } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'

const props = defineProps<{ field: any; entity?: string; id?: string }>()
// The field's own id belongs to the date button the label points at; the other controls inside
// would all take the form field's generated id (and each other's): one id on the page, once.
const timeId = computed(() => (props.id ? `${props.id}-time` : undefined))
const allDayId = computed(() => (props.id ? `${props.id}-allday` : undefined))
const clearId = computed(() => (props.id ? `${props.id}-clear` : undefined))
const model = defineModel<any>()
const config = useCmsAdminConfig()
const { t, locale, formatDateWith, fieldLabel } = useCmsI18n()

const tz = computed(() => config.value.timeZone)
const wall = computed(() => toZonedInput(model.value, tz.value)) // 'YYYY-MM-DDTHH:mm' or ''
const day = computed(() => wall.value.slice(0, 10))
const time = computed(() => wall.value.slice(11, 16))

const canAllDay = computed(() => !!props.field.meta?.allDay)
const allDay = ref(canAllDay.value && !!wall.value && time.value === '00:00')
// A time set elsewhere (a newer version loaded) ends "all day".
watch(time, (v) => { if (v && v !== '00:00') allDay.value = false })

const pad = (n: number) => String(n).padStart(2, '0')
function write(d: string, hm: string) {
  model.value = d ? fromZonedInput(`${d}T${hm || '00:00'}`, tz.value) : null
}

const open = ref(false)
// The calendar's own words otherwise stay English ("Event date", "Previous month").
// Nuxt UI types the arrows as ButtonProps only, yet v-binds them, so HTML attributes reach the button.
const calendarLabels = computed(() => ({
  calendarLabel: fieldLabel(props.field),
  prevMonth: { 'aria-label': t('fields.prevMonth') } as ButtonProps,
  nextMonth: { 'aria-label': t('fields.nextMonth') } as ButtonProps,
}))
const calendarValue = computed({
  get: () => {
    if (!day.value) return undefined
    const [y, m, d] = day.value.split('-').map(Number) as [number, number, number]
    return new CalendarDate(y, m, d)
  },
  set: (v: any) => {
    if (!v) return
    // A first date with no time yet is an all-day one (it is stored at 0:00 and reads
    // back as "All day"): say so now, not only after saving. Untick it to add a time.
    if (!day.value && canAllDay.value) allDay.value = true
    // A first date with a time starts at 9:00 (publishing at midnight surprises people).
    write(`${v.year}-${pad(v.month)}-${pad(v.day)}`, allDay.value ? '00:00' : (time.value || '09:00'))
    // The compact control keeps the calendar open: the time sits under it.
    if (!compact.value) open.value = false
  },
})
const timeValue = computed({
  get: () => time.value,
  set: (v: string) => { if (day.value && v) write(day.value, v) },
})
function setAllDay(on: boolean | 'indeterminate') {
  allDay.value = on === true
  if (allDay.value && day.value) write(day.value, '00:00')
}

const shown = computed(() => (model.value ? formatDateWith(model.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''))
// In a details row: one quiet button ("5. 8. 2024, 10:00"); time and "All day" sit
// under the calendar.
const variant = inject<Ref<'outline' | 'ghost'> | null>('cmsFieldVariant', null)
const compact = computed(() => variant?.value === 'ghost')
const shortShown = computed(() => {
  if (!model.value) return ''
  return allDay.value
    ? formatDateWith(model.value, { day: 'numeric', month: 'numeric', year: 'numeric' })
    : formatDateWith(model.value, { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
})
</script>

<template>
  <UPopover v-if="compact" v-model:open="open">
    <UButton
      :id="id" color="neutral" variant="ghost" class="w-full justify-start font-normal px-2.5"
      :class="shortShown ? 'text-highlighted' : 'text-dimmed'" :title="tz"
    >
      <span class="truncate">{{ shortShown || t('fields.pickDate') }}</span>
    </UButton>
    <template #content>
      <div class="p-2">
        <UCalendar v-model="calendarValue" :locale="locale" :week-starts-on="1" weekday-format="short" :year-controls="false" :fixed-weeks="false" v-bind="calendarLabels" />
        <div class="flex flex-wrap items-center gap-2 border-t border-default mt-2 pt-3 px-1">
          <UInput
            v-if="!allDay" :id="timeId" v-model="timeValue" type="time" icon="i-lucide-clock" size="sm" class="w-28" :ui="{ base: 'cms-time-input' }"
            :disabled="!day" :aria-label="t('fields.time')"
          />
          <UCheckbox v-if="canAllDay" :id="allDayId" :model-value="allDay" :label="t('fields.allDay')" @update:model-value="setAllDay" />
          <UButton
            v-if="model && field.optional" :id="clearId" class="ml-auto" size="sm" color="neutral" variant="ghost" icon="i-lucide-x"
            @click="model = null; open = false"
          >{{ t('fields.clear') }}</UButton>
        </div>
      </div>
    </template>
  </UPopover>
  <div v-else>
    <div class="flex flex-wrap items-center gap-2">
      <UPopover v-model:open="open">
        <UButton
          :id="id" color="neutral" variant="outline" icon="i-lucide-calendar"
          class="flex-1 min-w-48 justify-start font-normal bg-default"
          :class="shown ? 'text-highlighted' : 'text-dimmed'" :title="tz"
        >
          <span class="truncate first-letter:uppercase">{{ shown || t('fields.pickDate') }}</span>
        </UButton>
        <template #content>
          <UCalendar v-model="calendarValue" :locale="locale" :week-starts-on="1" weekday-format="short" :year-controls="false" :fixed-weeks="false" v-bind="calendarLabels" class="p-2" />
        </template>
      </UPopover>
      <UInput
        v-if="!allDay" :id="timeId" v-model="timeValue" type="time" icon="i-lucide-clock" class="w-32" :ui="{ base: 'cms-time-input' }"
        :disabled="!day" :aria-label="t('fields.time')" :title="tz"
      />
      <UButton
        v-if="model && field.optional" :id="clearId" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('fields.clear')"
        @click="() => { model = null }"
      />
    </div>
    <UCheckbox v-if="canAllDay" :id="allDayId" :model-value="allDay" :label="t('fields.allDay')" class="mt-2.5" @update:model-value="setAllDay" />
  </div>
</template>
