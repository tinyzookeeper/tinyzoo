<script setup lang="ts">
// A screen of the product as Návod draws it: a framed figure with numbered pins that the list
// beside it explains. The drawing is the website's own; a screenshot an editor uploads takes its
// place in the same frame.
import type { CmsMedia } from '~/lib/cms-content'

defineProps<{ kind?: string | null; image?: CmsMedia | null }>()
const words = useSiteWords()
const s = computed(() => words.value.screens)

// (the week grid: five days on a phone, seven from `sm` up)
const weekCols = 'grid grid-cols-[52px_repeat(5,1fr)_30px] gap-1 sm:grid-cols-[76px_repeat(7,1fr)_40px]'
const hide = (i: number) => (i > 4 ? 'max-sm:hidden' : '')
function shift(code: string) {
  const found = s.value.week.shifts[code.replace('*', '')]
  return found ? { label: found[0], kind: found[1], swapped: code.endsWith('*') } : null
}
</script>

<template>
  <div v-if="image" class="fig-frame"><CmsImage :media="image" sizes="(min-width: 1024px) 52rem, 100vw" class="h-auto w-full" /></div>

  <!-- the week grid -->
  <div v-else-if="kind === 'week'" class="fig-frame">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-3 py-2.5 sm:px-4">
      <div class="flex items-center gap-2 text-[14px] font-semibold text-ink">
        <UIcon name="i-lucide-chevron-left" class="size-4 text-quiet" aria-hidden="true" />
        <span>{{ s.week.title }}</span>
        <UIcon name="i-lucide-chevron-right" class="size-4 text-quiet" aria-hidden="true" />
        <span class="ml-2 hidden font-normal text-quiet sm:inline">{{ s.week.place }}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-mono text-[11px] text-quiet">{{ s.week.seen }}</span>
        <span class="relative inline-flex h-8 items-center gap-1.5 bg-ink px-3 text-[13px] font-semibold text-sheet">{{ s.week.publish }}<span class="co co-pin">1</span></span>
      </div>
    </div>
    <div class="p-3 sm:p-4">
      <div class="mb-1 font-mono text-[11px] text-quiet" :class="weekCols">
        <span />
        <span v-for="(d, i) in s.week.days" :key="i" class="py-1 text-center" :class="[hide(i), i === 0 ? 'bg-ink text-sheet' : '']">{{ d[0] }} <span class="max-sm:hidden">{{ d[1] }}</span></span>
        <span class="py-1 text-right">{{ s.week.hours }}</span>
      </div>
      <div v-for="(row, r) in s.week.rows" :key="row.name" class="mb-1 items-stretch" :class="weekCols">
        <span class="flex items-center text-[13px] font-medium text-ink sm:text-[14px]">{{ row.name }}</span>
        <template v-for="(code, i) in row.shifts" :key="i">
          <span v-if="!shift(code)" class="relative flex h-9 items-center justify-center bg-ground/60 font-mono text-[11px] text-ink sm:h-10 sm:text-[12px]" :class="hide(i)" />
          <span v-else-if="shift(code)!.kind === 'off'" class="hatch relative flex h-9 items-center justify-center border border-line font-mono text-[10px] text-ink sm:h-10 sm:text-[11px]" :class="hide(i)">{{ shift(code)!.label }}</span>
          <span v-else class="relative flex h-9 items-center justify-center font-mono text-[11px] text-ink sm:h-10 sm:text-[12px]" :class="[hide(i), shift(code)!.kind === 'am' ? 'bg-am' : 'bg-pm']">{{ shift(code)!.label }}<span v-if="shift(code)!.swapped" class="co co-pin">2</span></span>
        </template>
        <span class="relative flex items-center justify-end font-mono text-[12px] text-ink">{{ row.hours }}<span v-if="r === 0" class="co co-pin !-right-2 !-top-3">4</span></span>
      </div>
      <div class="items-stretch" :class="weekCols">
        <span class="flex items-center text-[12px] leading-tight text-quiet sm:text-[13px]">{{ s.week.freeNavod }}</span>
        <template v-for="(d, i) in s.week.days" :key="i">
          <span v-if="i === 4" class="relative flex h-9 items-center justify-center border border-dashed border-brand font-mono text-[11px] font-medium text-brand sm:h-10 sm:text-[12px]">{{ s.week.freeShift }}<span class="co co-pin">3</span></span>
          <span v-else class="h-9 sm:h-10" :class="hide(i)" />
        </template>
        <span />
      </div>
    </div>
    <div class="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line px-3 py-2.5 font-mono text-[11px] text-quiet sm:px-4">
      <span class="inline-flex items-center gap-1.5"><i class="h-3 w-3 bg-am" />{{ s.week.legend.morning }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="h-3 w-3 bg-pm" />{{ s.week.legend.afternoon }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="hatch h-3 w-3 border border-line" />{{ s.week.legend.off }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="h-3 w-3 border border-dashed border-brand" />{{ s.week.legend.free }}</span>
    </div>
  </div>

  <!-- a new week from a template -->
  <div v-else-if="kind === 'template'" class="fig-frame">
    <div class="border-b border-line px-4 py-3 text-[14px] font-semibold text-ink">{{ s.template.title }} <span class="font-normal text-quiet">{{ s.template.range }}</span></div>
    <div class="space-y-3 p-4 text-[14px]">
      <div class="relative flex items-center justify-between gap-3 border border-line px-3 py-2.5"><span class="co co-pin">1</span><span class="text-quiet">{{ s.template.fromTemplate }}</span><span class="inline-flex items-center gap-1.5 font-medium text-ink">{{ s.template.templateName }} <UIcon name="i-lucide-chevron-down" class="size-[15px]" aria-hidden="true" /></span></div>
      <div>
        <p class="font-mono text-[11px] uppercase tracking-wider text-quiet">{{ s.template.changes }}</p>
        <ul class="mt-2 divide-y divide-line border-y border-line">
          <li class="flex items-center justify-between gap-3 py-2.5"><span class="text-ink">{{ s.template.person }} <span class="text-quiet">{{ s.template.personDays }}</span></span><span class="hatch relative border border-line px-2 py-0.5 font-mono text-[11px] text-ink">{{ s.template.leave }}<span class="co co-pin !-right-4 !-top-4">2</span></span></li>
          <li class="flex items-center justify-between gap-3 py-2.5"><span class="text-ink">{{ s.template.day }} <span class="text-quiet">{{ s.template.dayNote }}</span></span><span class="bg-pm px-2 py-0.5 font-mono text-[11px] text-ink">{{ s.template.addShift }}</span></li>
        </ul>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span class="font-mono text-[11px] text-quiet">{{ s.template.receivers }}</span>
        <span class="relative inline-flex h-9 items-center bg-ink px-4 text-[14px] font-semibold text-sheet">{{ s.template.publish }}<span class="co co-pin">3</span></span>
      </div>
    </div>
  </div>

  <!-- the phone of the manager, and the messages the others get -->
  <div v-else-if="kind === 'swap'" class="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
    <div class="w-[280px] flex-none rounded-[26px] border border-ink bg-sheet p-2">
      <div class="overflow-hidden rounded-[19px] border border-line">
        <div class="flex items-center justify-between px-4 pt-2.5 font-mono text-[11px] text-ink"><span>{{ s.swap.clock }}</span><span class="h-1.5 w-12 rounded-full bg-ink/80" /><span>{{ s.swap.date }}</span></div>
        <div class="px-4 pb-4 pt-4">
          <p class="text-[17px] font-semibold tracking-[-0.01em] text-ink">{{ s.swap.title }}</p>
          <div class="relative mt-3 bg-am px-3 py-2.5"><span class="co co-pin">1</span>
            <p class="font-mono text-[11px] text-ink/70">{{ s.swap.shiftLine }}</p>
            <p class="mt-0.5 text-[15px] font-semibold text-ink">{{ s.swap.shiftTime }}</p>
            <p class="mt-1 flex items-center gap-1.5 text-[13px] text-ink">{{ s.swap.from }} <UIcon name="i-lucide-arrow-right" class="size-[13px]" aria-hidden="true" /> {{ s.swap.to }}</p>
          </div>
          <div class="relative mt-4"><span class="co co-pin !-right-1 !-top-1">2</span>
            <ol class="space-y-2.5 text-[13px] leading-snug text-ink">
              <li v-for="(step, i) in s.swap.steps" :key="i" class="flex gap-2.5"><span class="w-9 flex-none font-mono text-[11px] leading-[1.6]" :class="i === s.swap.steps.length - 1 ? 'text-brand' : 'text-quiet'">{{ step[0] }}</span><span :class="i === s.swap.steps.length - 1 ? 'font-semibold' : ''">{{ step[1] }}</span></li>
            </ol>
          </div>
          <div class="mt-4 grid gap-2">
            <span class="relative flex h-10 items-center justify-center bg-ink text-[14px] font-semibold text-sheet">{{ s.swap.confirm }}<span class="co co-pin">3</span></span>
            <span class="flex h-10 items-center justify-center border border-line text-[14px] font-medium text-ink">{{ s.swap.refuse }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="w-full min-w-0 flex-1 sm:pt-8">
      <p class="font-mono text-[11px] uppercase tracking-wider text-quiet">{{ s.swap.noticesTitle }}</p>
      <ul class="mt-3 space-y-2.5 text-[14px] leading-snug text-ink">
        <li v-for="n in s.swap.notices" :key="n.title" class="fig-frame px-3.5 py-3"><span class="flex justify-between font-mono text-[11px] text-quiet"><span>{{ n.who }}</span><span>{{ n.at }}</span></span><b class="font-semibold">{{ n.title }}</b> {{ n.text }}</li>
      </ul>
    </div>
  </div>

  <!-- who is where -->
  <div v-else-if="kind === 'attendance'" class="fig-frame">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <p class="text-[14px] font-semibold text-ink">{{ s.attendance.title }} <span class="font-normal text-quiet">{{ s.attendance.today }}</span></p>
      <p class="relative pr-6 font-mono text-[11px] text-quiet">{{ s.attendance.summary }}<span class="co co-pin !-right-1 !-top-1.5">1</span></p>
    </div>
    <ul class="divide-y divide-line text-[14px]">
      <li v-for="(r, i) in s.attendance.rows" :key="r.name" class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-2.5 sm:grid-cols-[1.1fr_1.3fr_auto_92px]">
        <span class="font-medium text-ink">{{ r.name }}<span class="block text-[12px] font-normal text-quiet sm:hidden">{{ r.place }}</span></span>
        <span class="hidden text-quiet sm:block">{{ r.place }}</span>
        <span class="relative font-mono text-[13px] text-ink" :class="r.late ? 'font-medium' : ''">{{ r.at }}<span v-if="i === 0" class="co co-pin !-right-5 !-top-4">2</span></span>
        <span v-if="r.late" class="relative bg-ink px-2 py-0.5 text-center font-mono text-[11px] text-sheet">{{ r.late }}<span class="co co-pin !-right-2 !-top-4">3</span></span>
        <span v-else class="bg-tint px-2 py-0.5 text-center font-mono text-[11px] text-ink">{{ s.attendance.present }}</span>
      </li>
    </ul>
  </div>

  <!-- the monthly totals for the accountant -->
  <div v-else-if="kind === 'payroll'" class="fig-frame">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <p class="text-[14px] font-semibold text-ink">{{ s.payroll.titleNavod }} <span class="font-normal text-quiet">{{ s.payroll.month }}</span></p>
      <span class="relative inline-flex h-8 items-center gap-1.5 bg-ink px-3 text-[13px] font-semibold text-sheet"><UIcon name="i-lucide-download" class="size-3.5" aria-hidden="true" />{{ s.payroll.download }}<span class="co co-pin">1</span></span>
    </div>
    <table class="w-full text-[14px]">
      <thead><tr class="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-quiet"><th class="py-2 pl-3 pr-1 font-normal sm:px-4">{{ s.payroll.columns.name }}</th><th class="px-1.5 py-2 text-right font-normal sm:px-2">{{ s.payroll.columns.hours }}</th><th class="relative px-2 py-2 text-right font-normal">{{ s.payroll.columns.saturdays }}<span class="co co-pin !right-0 !top-[-12px]">2</span></th><th class="hidden px-2 py-2 text-right font-normal sm:table-cell">{{ s.payroll.columns.leave }}</th><th class="whitespace-nowrap py-2 pl-1.5 pr-3 text-right font-normal sm:px-4">{{ s.payroll.columns.pay }}</th></tr></thead>
      <tbody class="divide-y divide-line font-mono text-[13px] text-ink">
        <tr v-for="r in s.payroll.rows" :key="r.name"><td class="py-2.5 pl-3 pr-1 font-sans text-[14px] font-medium sm:px-4">{{ r.name }}</td><td class="whitespace-nowrap px-1.5 py-2.5 text-right sm:px-2">{{ r.hours }}</td><td class="whitespace-nowrap px-1.5 py-2.5 text-right sm:px-2">{{ r.saturdays }}</td><td class="hidden px-2 py-2.5 text-right sm:table-cell">{{ r.leave }}</td><td class="whitespace-nowrap py-2.5 pl-1.5 pr-3 text-right sm:px-4">{{ r.pay }}</td></tr>
      </tbody>
      <tfoot><tr class="border-t border-ink font-mono text-[13px] font-medium text-ink"><td class="py-2.5 pl-3 pr-1 font-sans text-[14px] font-semibold sm:px-4">{{ s.payroll.total.name }}</td><td class="whitespace-nowrap px-1.5 py-2.5 text-right sm:px-2">{{ s.payroll.total.hours }}</td><td class="whitespace-nowrap px-1.5 py-2.5 text-right sm:px-2">{{ s.payroll.total.saturdays }}</td><td class="hidden px-2 py-2.5 text-right sm:table-cell">{{ s.payroll.total.leave }}</td><td class="relative whitespace-nowrap py-2.5 pl-1.5 pr-3 text-right sm:px-4">{{ s.payroll.total.pay }}<span class="co co-pin !right-[-2px] !top-[-10px]">3</span></td></tr></tfoot>
    </table>
  </div>
</template>
