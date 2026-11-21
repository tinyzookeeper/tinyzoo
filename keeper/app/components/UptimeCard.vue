<script setup lang="ts">
import type { SiteDetail } from '#keeper/types/keeper'

// "Is it up?" on a site's page. Simple answers in a sentence (how often the site was down in the
// last 30 days, or that it is down now, and how quick its pages are) over a strip of the 30 days.
// Detailed keeps the percentages and the typical answer time of the last 24 hours as a chart.
// The sentence sits at the top and the strip or chart at the bottom, so the card can stretch to
// its row (the Incidents card next to it follows this card's height).
const props = defineProps<{ site: SiteDetail; simple: boolean }>()
const now = useNow()

const ongoing = computed(() => props.site.incidents30d.find((i) => !i.endedAt) ?? null)
const down = computed(() => props.site.state === 'down' || !!ongoing.value)
const totals = computed(() => downtime30d(props.site.incidents30d, now.value))
const typical = computed(() => typicalMs(props.site.checks))

const headline = computed(() => {
  if (down.value) {
    const since = ongoing.value?.startedAt ?? props.site.stateSince
    return since ? `Down right now, for ${minutesInWords(Math.max(0, now.value - Date.parse(since)))}` : 'Down right now'
  }
  if (!props.site.lastCheckAt) return 'Not checked yet'
  return uptimeHeadline(totals.value.count, totals.value.ms)
})
const sub = computed(() => {
  if (down.value) return `${downNowInWords(ongoing.value?.cause)} Keeper checks again every minute.`
  if (!props.site.lastCheckAt) return 'Keeper checks the site every minute, starting now.'
  return typical.value != null ? speedInWords(typical.value) : 'No answers in the last 24 hours to time yet.'
})
const tone = computed<'down' | 'some' | 'up' | 'new'>(() => (down.value ? 'down' : !props.site.lastCheckAt ? 'new' : totals.value.count ? 'some' : 'up'))
const icon = computed(() => ({ down: 'i-lucide-triangle-alert', some: 'i-lucide-circle-alert', up: 'i-lucide-check', new: 'i-lucide-clock' })[tone.value])
</script>

<template>
  <section class="flex min-w-0 flex-col" aria-labelledby="uptime-heading">
    <header class="mb-2 flex min-h-6 flex-wrap items-center gap-2">
      <h2 id="uptime-heading" class="k-label">{{ simple ? 'Is it up?' : 'Uptime' }}</h2>
      <span v-if="simple && down" class="inline-flex items-center gap-1.5 rounded-full bg-error/10 px-2 py-0.5 text-[0.71875rem] font-semibold text-error">
        <span class="size-1.5 rounded-full bg-current" />Down now
      </span>
      <span v-if="!simple" class="ml-auto text-sm text-muted tabular">
        24 h <span class="font-semibold text-highlighted">{{ formatUptime(site.uptime24h) }}</span>
        · 30 d <span class="font-semibold text-highlighted">{{ formatUptime(site.uptime30d) }}</span>
      </span>
    </header>

    <div class="k-card flex flex-1 flex-col gap-4 p-4 sm:p-5">
      <template v-if="simple">
        <div class="flex items-start gap-3">
          <span
            class="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] border"
            :class="tone === 'down' ? 'border-error/25 bg-error/10 text-error' : 'border-(--k-moment-line) bg-(--k-moment-bg)'"
          >
            <UIcon :name="icon" class="size-[17px]" :class="tone === 'up' ? 'text-(--k-up)' : tone === 'down' ? '' : 'text-highlighted'" />
          </span>
          <div class="min-w-0">
            <p class="font-display text-lg leading-snug font-bold tracking-[-0.01em] text-balance" :class="tone === 'down' ? 'text-error' : 'text-highlighted'">{{ headline }}</p>
            <p class="mt-0.5 text-[0.84375rem] text-muted">{{ sub }}</p>
          </div>
        </div>
        <UptimeStrip :incidents="site.incidents30d" :first-check-at="site.firstCheckAt" :now="now" class="mt-auto" />
      </template>
      <ResponseChart v-else :checks="site.checks" class="mt-auto" />
    </div>
  </section>
</template>
