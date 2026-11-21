<script setup lang="ts">
import type { Incident } from '#keeper/types/keeper'
import type { UptimeDayTone } from '../utils/uptime'

// The last 30 days as one small bar each, oldest left, today right: up all day green, down a
// little amber, down for long (or still down) red, no checks yet grey. Pointing at a bar (or
// tapping it) says what happened that day. Days are the viewer's own, so it renders in the
// browser; the server sends a quiet placeholder of the same size.
const props = defineProps<{ incidents: Incident[]; firstCheckAt: string | null; now: number }>()

const days = computed(() => uptimeDays(props.incidents, props.firstCheckAt, props.now))
const summary = computed(() => stripSummary(days.value))
const tones = computed(() => new Set(days.value.map((d) => d.tone)))
const legend = computed(() => [...tones.value].some((t) => t !== 'up'))

const active = ref<number | null>(null)
const tip = computed(() => (active.value == null ? null : days.value[active.value] ?? null))
/** The tip's place: over its bar, kept inside the strip at the ends. */
const tipStyle = computed(() => {
  const i = active.value ?? 0
  const at = ((i + 0.5) / 30) * 100
  return { left: `${at}%`, transform: `translateX(${i < 5 ? '-12%' : i > 24 ? '-88%' : '-50%'})` }
})
const BG: Record<UptimeDayTone, string> = { up: 'bg-(--k-up)', short: 'bg-(--k-down-short)', long: 'bg-(--k-down-long)', none: 'bg-(--k-no-checks)' }
</script>

<template>
  <div class="grid gap-2">
    <ClientOnly>
      <div class="relative" @pointerleave="active = null">
        <div class="flex h-[30px] gap-[3px]" role="img" :aria-label="summary">
          <span
            v-for="(d, i) in days" :key="d.start"
            class="min-w-[3px] flex-1 rounded-[3px] transition-opacity" :class="[BG[d.tone], active != null && active !== i ? 'opacity-60' : '']"
            @pointerenter="active = i" @pointerdown="active = i"
          />
        </div>
        <div v-if="tip" class="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 rounded-md bg-(--k-tip) px-2 py-1 text-[0.71875rem] font-medium whitespace-nowrap text-(--k-tip-text) shadow-sm" :style="tipStyle" aria-hidden="true">
          {{ tip.label }}
        </div>
      </div>
      <template #fallback>
        <div class="flex h-[30px] gap-[3px]" aria-hidden="true">
          <span v-for="i in 30" :key="i" class="min-w-[3px] flex-1 rounded-[3px] bg-(--k-no-checks)" />
        </div>
      </template>
    </ClientOnly>
    <div class="flex justify-between text-xs text-muted"><span>30 days ago</span><span>Today</span></div>
    <ClientOnly>
      <ul v-if="legend" class="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted" aria-label="What the colours mean">
        <li class="inline-flex items-center gap-1.5"><i class="size-2.5 rounded-[3px] bg-(--k-up)" />Up all day</li>
        <li class="inline-flex items-center gap-1.5"><i class="size-2.5 rounded-[3px] bg-(--k-down-short)" />Down a little</li>
        <li class="inline-flex items-center gap-1.5"><i class="size-2.5 rounded-[3px] bg-(--k-down-long)" />Down for long</li>
        <li v-if="tones.has('none')" class="inline-flex items-center gap-1.5"><i class="size-2.5 rounded-[3px] bg-(--k-no-checks)" />No checks yet</li>
      </ul>
    </ClientOnly>
  </div>
</template>
