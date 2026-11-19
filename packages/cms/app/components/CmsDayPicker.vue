<script setup lang="ts">
// A day (YYYY-MM-DD) from the admin's calendar, for small places like list filters:
// a button with the day ("14. 11. 2026") that opens the same calendar the date
// field uses, never the browser's own date box.
import type { ButtonProps } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'

const props = defineProps<{ label: string; placeholder?: string }>()
const model = defineModel<string>({ default: '' })
const { t, locale, formatDateWith } = useCmsI18n()
const open = ref(false)
const pad = (n: number) => String(n).padStart(2, '0')
const value = computed({
  get: () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(model.value)) return undefined
    const [y, m, d] = model.value.split('-').map(Number) as [number, number, number]
    return new CalendarDate(y, m, d)
  },
  set: (v: any) => {
    model.value = v ? `${v.year}-${pad(v.month)}-${pad(v.day)}` : ''
    open.value = false
  },
})
// Nuxt UI types the arrows as ButtonProps only, yet v-binds them, so HTML attributes reach the button.
const prevMonth = computed(() => ({ 'aria-label': t('fields.prevMonth') }) as ButtonProps)
const nextMonth = computed(() => ({ 'aria-label': t('fields.nextMonth') }) as ButtonProps)
const shown = computed(() => (model.value ? formatDateWith(`${model.value}T12:00:00`, { dateStyle: 'medium' }) : ''))
</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      color="neutral" variant="outline" size="sm" icon="i-lucide-calendar" class="cms-field-box w-full justify-start min-w-0"
      :aria-label="shown ? `${label}: ${shown}` : label"
    ><span class="truncate" :class="shown ? '' : 'text-dimmed'">{{ shown || placeholder || t('fields.pickDate') }}</span></UButton>
    <template #content>
      <div class="p-2">
        <UCalendar
          v-model="value" :locale="locale" :week-starts-on="1" weekday-format="short" :year-controls="false" :fixed-weeks="false"
          :calendar-label="label" :prev-month="prevMonth" :next-month="nextMonth"
        />
        <div v-if="model" class="flex justify-end pt-1">
          <UButton size="xs" color="neutral" variant="ghost" @click="value = undefined">{{ t('fields.clear') }}</UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>
