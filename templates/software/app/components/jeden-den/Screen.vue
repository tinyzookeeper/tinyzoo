<script setup lang="ts">
// A screen of the product as One Day draws it: soft cards on the day's colours. The layout around
// it (where it stands, how it overlaps a photograph) is the feature's and comes in as the class of
// the root; a screenshot an editor uploads takes the place of the drawing, in the same card.
// `place="opening"`: the phone of the opening (only the swap of a shift has one).
import type { CmsMedia } from '~/lib/cms-content'

defineProps<{ kind?: string | null; image?: CmsMedia | null; place?: 'opening' | 'feature' }>()
const words = useSiteWords()
const s = computed(() => words.value.screens)

// (the week grid: five days on a phone, seven from `sm` up)
const weekCols = 'grid grid-cols-[52px_repeat(5,1fr)_30px] gap-1 sm:grid-cols-[96px_repeat(7,1fr)_48px] sm:gap-1.5'
const hide = (i: number) => (i > 4 ? 'max-sm:hidden' : '')
const cell = 'flex h-10 items-center justify-center rounded-[8px] font-mono text-[11px] sm:h-11 sm:rounded-[10px] sm:text-[13px]'
function shift(code: string) {
  const found = s.value.week.shifts[code.replace('*', '')]
  return found ? { label: found[0], kind: found[1], swapped: code.endsWith('*') } : null
}
const offset = ['lg:mr-16', 'lg:ml-8 lg:mr-8', 'lg:ml-16']
</script>

<template>
  <div v-if="image" class="card overflow-hidden"><CmsImage :media="image" sizes="(min-width: 1024px) 40rem, 100vw" class="h-auto w-full" /></div>

  <div v-else-if="kind === 'swap' && place === 'opening'" class="w-[250px] rounded-[34px] bg-ink p-2.5 text-ink shadow-[0_30px_50px_-28px_rgb(40_20_5/.7)]">
    <div class="rounded-[25px] bg-card px-4 pb-4 pt-3">
      <div class="time flex items-center justify-between !text-[11px]"><span>{{ s.swap.clock }}</span><span class="h-1.5 w-12 rounded-full bg-ink" /><span>{{ s.swap.date }}</span></div>
      <p class="mt-4 font-display text-[21px] font-semibold leading-none">{{ s.swap.title }}</p>
      <div class="mt-3 rounded-[12px] bg-am px-3.5 py-3">
        <p class="time !text-[11px] opacity-80">{{ s.swap.shiftLine }}</p>
        <p class="mt-0.5 text-[18px] font-semibold leading-tight">{{ s.swap.shiftTime }}</p>
        <p class="mt-1 flex items-center gap-1.5 text-[14px]">{{ s.swap.from }} <UIcon name="i-lucide-arrow-right" class="size-3.5" aria-hidden="true" /> {{ s.swap.to }}</p>
      </div>
      <ol class="mt-4 space-y-2 text-[13px] leading-snug">
        <li v-for="(step, i) in s.swap.steps" :key="i" class="flex gap-2.5"><span class="time w-9 flex-none !text-[11px] leading-[1.6]" :class="i === s.swap.steps.length - 1 ? 'text-brand' : 'opacity-70'">{{ step[0] }}</span><span :class="i === s.swap.steps.length - 1 ? 'font-semibold' : ''">{{ step[1] }}</span></li>
      </ol>
      <div class="mt-4 grid gap-2">
        <span class="flex h-11 items-center justify-center rounded-[11px] bg-brand text-[15px] font-semibold text-brand-ink">{{ s.swap.confirm }}</span>
        <span class="flex h-10 items-center justify-center rounded-[11px] text-[15px] font-medium shadow-[inset_0_0_0_1.5px_rgb(43_29_18/.3)]">{{ s.swap.refuse }}</span>
      </div>
    </div>
  </div>
  <div v-else-if="place === 'opening'" />

  <ul v-else-if="kind === 'swap'" class="space-y-3">
    <li v-for="(n, i) in s.swap.day" :key="n.title" class="card flex items-start gap-3.5 p-4" :class="offset[i % 3]">
      <svg viewBox="0 0 24 24" class="mt-0.5 h-8 w-8 flex-none" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="var(--lamp)" /><path d="M12 0a12 12 0 0 1 0 24z" fill="var(--brand)" /></svg>
      <p class="min-w-0 flex-1 text-[15px] leading-snug"><span class="time flex justify-between !text-[11px] opacity-70"><span>{{ n.who }}</span><span>{{ n.at }}</span></span><b class="font-semibold">{{ n.title }}</b> {{ n.text }}</p>
    </li>
  </ul>

  <div v-else-if="kind === 'week'" class="card p-3 sm:p-5 lg:p-6">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="font-display text-[20px] font-semibold leading-none lg:text-[22px]">{{ s.week.title }} <span class="font-sans text-[14px] font-normal opacity-70">{{ s.week.place }}</span></p>
      <div class="flex items-center gap-3"><span class="time hidden !text-[11px] opacity-70 sm:inline">{{ s.week.seen }}</span><span class="inline-flex h-9 items-center rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-brand-ink">{{ s.week.publish }}</span></div>
    </div>
    <div class="mb-1.5 font-mono text-[11px] sm:text-[12px]" :class="weekCols">
      <span />
      <span v-for="(d, i) in s.week.days" :key="i" class="flex items-center justify-center rounded-full py-1" :class="[hide(i), i === 0 ? 'bg-ink text-cream' : 'opacity-75']">{{ d[0] }}<span class="max-sm:hidden">&nbsp;{{ d[1] }}</span></span>
      <span class="py-1 text-right opacity-75">{{ s.week.hours }}</span>
    </div>
    <div v-for="row in s.week.rows" :key="row.name" class="mb-1 items-center sm:mb-1.5" :class="weekCols">
      <span class="text-[14px] font-semibold sm:text-[16px]">{{ row.name }}</span>
      <template v-for="(code, i) in row.shifts" :key="i">
        <span v-if="!shift(code)" :class="[cell, hide(i), 'bg-ink/[0.045]']" />
        <span v-else-if="shift(code)!.kind === 'off'" :class="[cell, hide(i), 'hatch shadow-[inset_0_0_0_1px_rgb(43_29_18/.2)]']">{{ shift(code)!.label }}</span>
        <span v-else :class="[cell, hide(i), 'gap-1', shift(code)!.kind === 'am' ? 'bg-am' : 'bg-pm', shift(code)!.swapped ? 'shadow-[inset_0_0_0_2px_var(--brand)]' : '']">{{ shift(code)!.label }}<UIcon v-if="shift(code)!.swapped" name="i-lucide-repeat" class="size-3 max-sm:hidden" aria-hidden="true" /></span>
      </template>
      <span class="text-right font-mono text-[12px] sm:text-[13px]">{{ row.hours }}</span>
    </div>
    <div class="items-center" :class="weekCols">
      <span class="text-[13px] opacity-75 sm:text-[15px]">{{ s.week.free }}</span>
      <template v-for="(d, i) in s.week.days" :key="i">
        <span v-if="i === 4" :class="[cell, 'border-[1.5px] border-dashed border-brand font-medium text-brand']">{{ s.week.freeShift }}</span>
        <span v-else :class="[cell, hide(i)]" />
      </template>
      <span />
    </div>
    <div class="time mt-4 flex flex-wrap gap-x-5 gap-y-2 !text-[11px]">
      <span class="inline-flex items-center gap-1.5"><i class="h-3.5 w-3.5 rounded bg-am" />{{ s.week.legend.morning }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="h-3.5 w-3.5 rounded bg-pm" />{{ s.week.legend.afternoon }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="hatch h-3.5 w-3.5 rounded shadow-[inset_0_0_0_1px_rgb(43_29_18/.25)]" />{{ s.week.legend.off }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="h-3.5 w-3.5 rounded border-[1.5px] border-dashed border-brand" />{{ s.week.legend.free }}</span>
    </div>
  </div>

  <div v-else-if="kind === 'template'" class="card p-5">
    <p class="font-display text-[20px] font-semibold leading-none">{{ s.template.title }} <span class="font-sans text-[14px] font-normal opacity-70">{{ s.template.range }}</span></p>
    <p class="mt-3 flex items-center justify-between gap-3 rounded-[10px] bg-morning px-3 py-2.5 text-[15px] shadow-[inset_0_0_0_1px_rgb(43_29_18/.15)]"><span class="opacity-75">{{ s.template.fromTemplate }}</span><span class="font-semibold">{{ s.template.templateName }}</span></p>
    <p class="time mt-4 !text-[11px] opacity-70">{{ s.template.changes }}</p>
    <ul class="mt-1 text-[15px]">
      <li class="flex items-center justify-between gap-3 border-t border-ink/10 py-2.5"><span><b class="font-semibold">{{ s.template.person }}</b> <span class="opacity-70">{{ s.template.personDays }}</span></span><span class="hatch rounded-full px-3 py-0.5 text-[13px] shadow-[inset_0_0_0_1px_rgb(43_29_18/.25)]">{{ s.template.leave }}</span></li>
      <li class="flex items-center justify-between gap-3 border-t border-ink/10 py-2.5"><span><b class="font-semibold">{{ s.template.day }}</b> <span class="opacity-70">{{ s.template.dayNote }}</span></span><span class="rounded-full bg-pm px-3 py-0.5 text-[13px]">{{ s.template.addShift }}</span></li>
    </ul>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-3"><span class="time !text-[11px] opacity-70">{{ s.template.receivers }}</span><span class="inline-flex h-9 items-center rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-brand-ink">{{ s.template.publish }}</span></div>
  </div>

  <div v-else-if="kind === 'attendance'" class="card">
    <div class="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
      <p class="font-display text-[20px] font-semibold leading-none">{{ s.attendance.title }} <span class="font-sans text-[14px] font-normal opacity-70">{{ s.attendance.today }}</span></p>
      <p class="time !text-[11px] opacity-70">{{ s.attendance.summaryShort }}</p>
    </div>
    <ul class="px-5 pb-3 text-[15px]">
      <li v-for="r in s.attendance.rows" :key="r.name" class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t border-ink/10 py-2">
        <span class="min-w-0"><b class="block font-semibold leading-tight">{{ r.name }}</b><span class="text-[13px] opacity-70">{{ r.place }}</span></span>
        <span class="time">{{ r.at }}</span>
        <span class="time w-[70px] rounded-full py-1 text-center !text-[11px]" :class="r.late ? 'bg-brand text-brand-ink' : 'bg-am'">{{ r.late || s.attendance.present }}</span>
      </li>
    </ul>
  </div>

  <div v-else-if="kind === 'payroll'" class="card overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
      <p class="font-display text-[20px] font-semibold leading-none">{{ s.payroll.monthTitle }} <span class="font-sans text-[14px] font-normal opacity-70">{{ s.payroll.placeDay }}</span></p>
      <span class="inline-flex h-9 items-center gap-2 rounded-[10px] bg-brand px-3.5 text-[14px] font-semibold text-brand-ink"><UIcon name="i-lucide-download" class="size-[15px]" aria-hidden="true" />{{ s.payroll.download }}</span>
    </div>
    <table class="w-full text-[14px]">
      <thead><tr class="time bg-morning text-left !text-[11px]"><th class="px-4 py-2 font-normal sm:px-5">{{ s.payroll.columns.name }}</th><th class="px-2 py-2 text-right font-normal">{{ s.payroll.columns.hours }}</th><th class="px-2 py-2 text-right font-normal">{{ s.payroll.columns.saturdays }}</th><th class="hidden px-2 py-2 text-right font-normal sm:table-cell">{{ s.payroll.columns.leave }}</th><th class="whitespace-nowrap py-2 pl-1.5 pr-4 text-right font-normal sm:px-5">{{ s.payroll.columns.pay }}</th></tr></thead>
      <tbody class="font-mono text-[13px]">
        <tr v-for="r in s.payroll.rows" :key="r.name" class="border-t border-ink/10"><td class="py-2.5 pl-4 pr-1 font-sans text-[15px] font-semibold sm:px-5">{{ r.name }}</td><td class="whitespace-nowrap px-1.5 py-2.5 text-right sm:px-2">{{ r.hours }}</td><td class="whitespace-nowrap px-1.5 py-2.5 text-right sm:px-2">{{ r.saturdays }}</td><td class="hidden px-2 py-2.5 text-right sm:table-cell">{{ r.leave }}</td><td class="whitespace-nowrap py-2.5 pl-1.5 pr-4 text-right sm:px-5">{{ r.pay }}</td></tr>
      </tbody>
      <tfoot class="font-mono text-[13px] font-medium"><tr class="border-t border-ink/25 bg-am/50"><td class="py-2.5 pl-4 pr-1 font-sans text-[15px] font-semibold sm:px-5">{{ s.payroll.total.name }}</td><td class="whitespace-nowrap px-1.5 py-2.5 text-right sm:px-2">{{ s.payroll.total.hours }}</td><td class="whitespace-nowrap px-1.5 py-2.5 text-right sm:px-2">{{ s.payroll.total.saturdays }}</td><td class="hidden px-2 py-2.5 text-right sm:table-cell">{{ s.payroll.total.leave }}</td><td class="whitespace-nowrap py-2.5 pl-1.5 pr-4 text-right sm:px-5">{{ s.payroll.total.pay }}</td></tr></tfoot>
    </table>
  </div>
</template>
