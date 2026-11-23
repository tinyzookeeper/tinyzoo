<script setup lang="ts">
// A screen of the product as Magnets draws it: on rounded tiles, in the page's own colours. The
// tile around it is the feature's; a screenshot an editor uploads takes the place of the drawing.
import type { CmsMedia } from '~/lib/cms-content'

defineProps<{ kind?: string | null; image?: CmsMedia | null }>()
const words = useSiteWords()
const s = computed(() => words.value.screens)

// (the week grid: five days on a phone, seven from `sm` up)
const weekCols = 'grid grid-cols-[52px_repeat(5,1fr)_30px] gap-1 sm:grid-cols-[130px_repeat(7,1fr)_52px] sm:gap-1.5'
const hide = (i: number) => (i > 4 ? 'max-sm:hidden' : '')
function shift(code: string) {
  const found = s.value.week.shifts[code.replace('*', '')]
  return found ? { label: found[0], kind: found[1], swapped: code.endsWith('*') } : null
}
</script>

<template>
  <CmsImage v-if="image" :media="image" sizes="(min-width: 1024px) 40rem, 100vw" class="h-auto w-full rounded-[20px]" />

  <!-- the week board -->
  <div v-else-if="kind === 'week'">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="font-display text-[20px] font-bold leading-none lg:text-[24px]">{{ s.week.title }} <span class="font-sans text-[15px] font-normal opacity-70">{{ s.week.place }}</span></p>
      <div class="flex items-center gap-3"><span class="mono hidden sm:inline">{{ s.week.seen }}</span><span class="inline-flex h-10 items-center rounded-full bg-ink px-5 font-display text-[15px] font-bold text-cream">{{ s.week.publish }}</span></div>
    </div>
    <div class="mb-1.5 font-mono text-[10px] uppercase sm:text-[11px]" :class="weekCols">
      <span />
      <span v-for="(d, i) in s.week.days" :key="i" class="flex items-center justify-center rounded-full py-1" :class="[hide(i), i === 0 ? 'bg-ink text-cream' : '']">{{ d[0] }}<span class="max-sm:hidden">&nbsp;{{ d[1] }}</span></span>
      <span class="py-1 text-right">{{ s.week.hours }}</span>
    </div>
    <div v-for="(row, r) in s.week.rows" :key="row.name" class="mb-1 items-center sm:mb-1.5" :class="weekCols">
      <span class="flex items-center gap-2.5 font-display text-[14px] font-bold sm:text-[18px]">
        <i class="hidden h-9 w-9 flex-none items-center justify-center rounded-full font-mono text-[10px] font-medium not-italic sm:flex" :class="['bg-ink text-cream', 'bg-brand', 'bg-sky'][r % 3]">{{ row.initials }}</i>{{ row.name }}
      </span>
      <template v-for="(code, i) in row.shifts" :key="i">
        <span v-if="!shift(code)" class="flex h-10 items-center justify-center rounded-[9px] bg-ink/[0.06] font-mono text-[10px] sm:h-12 sm:rounded-[12px] sm:text-[13px]" :class="hide(i)" />
        <span v-else-if="shift(code)!.kind === 'off'" class="hatch flex h-10 items-center justify-center rounded-[9px] border border-ink/40 font-mono text-[10px] sm:h-12 sm:rounded-[12px] sm:text-[13px]" :class="hide(i)">{{ shift(code)!.label }}</span>
        <span v-else-if="shift(code)!.swapped" class="flex h-10 items-center justify-center gap-1 rounded-[9px] bg-sky font-mono text-[10px] font-medium sm:h-12 sm:rounded-[12px] sm:text-[13px]" :class="hide(i)">{{ shift(code)!.label }}<UIcon name="i-lucide-repeat" class="size-3 max-sm:hidden" aria-hidden="true" /></span>
        <span v-else class="flex h-10 items-center justify-center rounded-[9px] font-mono text-[10px] font-medium sm:h-12 sm:rounded-[12px] sm:text-[13px]" :class="[hide(i), shift(code)!.kind === 'am' ? 'bg-brand' : 'bg-ink text-cream']">{{ shift(code)!.label }}</span>
      </template>
      <span class="text-right font-mono text-[11px] sm:text-[13px]">{{ row.hours }}</span>
    </div>
    <div class="items-center" :class="weekCols">
      <span class="font-display text-[14px] font-bold sm:pl-[46px] sm:text-[18px]">{{ s.week.free }}</span>
      <template v-for="(d, i) in s.week.days" :key="i">
        <span v-if="i === 4" class="flex h-10 items-center justify-center rounded-[9px] border-2 border-dashed border-ink font-mono text-[10px] font-medium sm:h-12 sm:rounded-[12px] sm:text-[13px]">{{ s.week.freeShift }}</span>
        <span v-else class="flex h-10 sm:h-12" :class="hide(i)" />
      </template>
      <span />
    </div>
    <div class="mono mt-4 flex flex-wrap gap-x-5 gap-y-2">
      <span class="inline-flex items-center gap-1.5"><i class="h-3.5 w-3.5 rounded bg-brand" />{{ s.week.legend.morning }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="h-3.5 w-3.5 rounded bg-ink" />{{ s.week.legend.afternoon }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="hatch h-3.5 w-3.5 rounded border border-ink/40" />{{ s.week.legend.off }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="h-3.5 w-3.5 rounded border-2 border-dashed border-ink" />{{ s.week.legend.free }}</span>
      <span class="inline-flex items-center gap-1.5"><i class="h-3.5 w-3.5 rounded bg-sky" />{{ s.week.legend.swap }}</span>
    </div>
  </div>

  <!-- a new week from a template -->
  <div v-else-if="kind === 'template'" class="rounded-[20px] border-2 border-ink bg-board text-ink">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-4 py-3 sm:px-5"><p class="font-display text-[19px] font-bold leading-none">{{ s.template.title }} <span class="font-sans text-[14px] font-normal opacity-70">{{ s.template.range }}</span></p><span class="mono rounded-full bg-sky px-3 py-1.5 text-[10px]">{{ s.template.fromTemplate }}: {{ s.template.templateName }}</span></div>
    <p class="mono px-4 pt-3 sm:px-5">{{ s.template.changes }}</p>
    <ul class="px-4 pb-2 pt-1 text-[15px] sm:px-5">
      <li class="flex items-center justify-between gap-3 border-b border-ink/15 py-3"><span><b class="font-display font-bold">{{ s.template.person }}</b> <span class="opacity-70">{{ s.template.personDays }}</span></span><span class="hatch rounded-full border border-ink/40 px-3 py-1 font-mono text-[11px]">{{ s.template.leave }}</span></li>
      <li class="flex items-center justify-between gap-3 py-3"><span><b class="font-display font-bold">{{ s.template.day }}</b> <span class="opacity-70">{{ s.template.dayNote }}</span></span><span class="rounded-full bg-brand px-3 py-1 font-mono text-[11px]">{{ s.template.addShift }}</span></li>
    </ul>
    <div class="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink px-4 py-3 sm:px-5"><span class="mono">{{ s.template.receivers }}</span><span class="inline-flex h-9 items-center rounded-full bg-ink px-4 font-display text-[14px] font-bold text-cream">{{ s.template.publish }}</span></div>
  </div>

  <!-- the phone of the manager, and the messages the others get -->
  <div v-else-if="kind === 'swap'" class="flex flex-1 flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
    <div class="w-[272px] flex-none rounded-[36px] bg-ink p-2.5 text-ink">
      <div class="rounded-[27px] bg-board px-4 pb-4 pt-3">
        <div class="mono flex items-center justify-between text-[10px]"><span>{{ s.swap.clock }}</span><span class="h-1.5 w-12 rounded-full bg-ink" /><span>{{ s.swap.date }}</span></div>
        <p class="mt-4 font-display text-[21px] font-bold leading-none">{{ s.swap.title }}</p>
        <div class="mt-3 rounded-[14px] bg-brand px-3.5 py-3">
          <p class="mono text-[10px]">{{ s.swap.shiftLine }}</p>
          <p class="mt-1 font-display text-[22px] font-extrabold leading-none">{{ s.swap.shiftTime }}</p>
          <p class="mt-1.5 flex items-center gap-1.5 text-[14px] font-medium">{{ s.swap.from }} <UIcon name="i-lucide-arrow-right" class="size-3.5" aria-hidden="true" /> {{ s.swap.to }}</p>
        </div>
        <ol class="mt-4 space-y-2 text-[13px] leading-snug">
          <li v-for="(step, i) in s.swap.steps" :key="i" class="flex gap-2.5"><span class="mono w-9 flex-none pt-0.5 text-[10px]">{{ step[0] }}</span><span :class="i === s.swap.steps.length - 1 ? 'font-semibold' : ''">{{ step[1] }}</span></li>
        </ol>
        <div class="mt-4 grid gap-2">
          <span class="flex h-11 items-center justify-center rounded-full bg-ink font-display text-[15px] font-bold text-cream">{{ s.swap.confirm }}</span>
          <span class="flex h-11 items-center justify-center rounded-full border-2 border-ink font-display text-[15px] font-bold">{{ s.swap.refuse }}</span>
        </div>
      </div>
    </div>
    <ul class="w-full min-w-0 space-y-2.5 text-[14px] leading-snug text-ink sm:flex-1">
      <li v-for="(n, i) in s.swap.notices" :key="n.title" class="rounded-[16px] p-3.5" :class="['bg-cream', 'bg-ink text-cream', 'bg-sky'][i % 3]">
        <span class="mono flex justify-between text-[10px]"><span>{{ n.who }}</span><span>{{ n.at }}</span></span><b class="mt-1 block font-display text-[17px] font-bold leading-tight">{{ n.title }}</b>{{ n.short || n.text }}
      </li>
    </ul>
  </div>

  <!-- who is where (drawn in the colour of the tile it stands on) -->
  <div v-else-if="kind === 'attendance'">
    <div class="flex items-center justify-between gap-3 border-b border-current/25 pb-3">
      <p class="whitespace-nowrap font-display text-[19px] font-bold leading-none">{{ s.attendance.today.charAt(0).toUpperCase() + s.attendance.today.slice(1) }}</p>
      <p class="mono text-right text-[10px]">{{ s.attendance.summary }}</p>
    </div>
    <ul class="text-[15px]">
      <li v-for="(r, i) in s.attendance.rows" :key="r.name" class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 py-2.5" :class="i < s.attendance.rows.length - 1 ? 'border-b border-current/15' : ''">
        <span class="min-w-0"><b class="block font-semibold leading-tight">{{ r.name }}</b><span class="text-[13px] opacity-75">{{ r.place }}</span></span>
        <span class="font-mono text-[13px]">{{ r.at }}</span>
        <span class="mono w-[76px] rounded-full py-1 text-center text-[10px] text-ink" :class="r.late ? 'bg-brand' : 'bg-sky'">{{ r.late || s.attendance.present }}</span>
      </li>
    </ul>
  </div>

  <!-- the monthly totals for the accountant -->
  <div v-else-if="kind === 'payroll'" class="rounded-[20px] border-2 border-ink bg-board text-ink">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-4 py-3 sm:px-5">
      <p class="font-display text-[19px] font-bold leading-none">{{ s.payroll.monthTitle }} <span class="font-sans text-[14px] font-normal opacity-70">{{ s.payroll.placeMagnety }}</span></p>
      <span class="inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 font-display text-[14px] font-bold text-cream"><UIcon name="i-lucide-download" class="size-[15px]" aria-hidden="true" />{{ s.payroll.download }}</span>
    </div>
    <table class="w-full text-[14px]">
      <thead><tr class="mono text-left text-[10px]"><th class="px-4 py-2.5 font-normal sm:px-5">{{ s.payroll.columns.name }}</th><th class="px-2 py-2.5 text-right font-normal">{{ s.payroll.columns.hours }}</th><th class="hidden px-2 py-2.5 text-right font-normal sm:table-cell">{{ s.payroll.columns.saturdays }}</th><th class="hidden px-2 py-2.5 text-right font-normal sm:table-cell">{{ s.payroll.columns.leave }}</th><th class="whitespace-nowrap px-4 py-2.5 text-right font-normal sm:px-5">{{ s.payroll.columns.pay }}</th></tr></thead>
      <tbody class="font-mono text-[12px] sm:text-[13px]">
        <tr v-for="r in s.payroll.rows" :key="r.name" class="border-t border-ink/15"><td class="px-4 py-3 font-sans text-[15px] font-semibold sm:px-5">{{ r.name }}</td><td class="whitespace-nowrap px-2 py-3 text-right">{{ r.hours }}</td><td class="hidden px-2 py-3 text-right sm:table-cell">{{ r.saturdays }}</td><td class="hidden px-2 py-3 text-right sm:table-cell">{{ r.leave }}</td><td class="whitespace-nowrap px-4 py-3 text-right sm:px-5">{{ r.pay }}</td></tr>
      </tbody>
      <tfoot class="font-mono text-[12px] font-medium sm:text-[13px]"><tr class="border-t-2 border-ink"><td class="px-4 py-3 font-display text-[16px] font-bold sm:px-5">{{ s.payroll.total.name }}</td><td class="whitespace-nowrap px-2 py-3 text-right">{{ s.payroll.total.hours }}</td><td class="hidden px-2 py-3 text-right sm:table-cell">{{ s.payroll.total.saturdays }}</td><td class="hidden px-2 py-3 text-right sm:table-cell">{{ s.payroll.total.leave }}</td><td class="whitespace-nowrap px-4 py-3 text-right sm:px-5">{{ s.payroll.total.pay }}</td></tr></tfoot>
    </table>
  </div>
</template>
