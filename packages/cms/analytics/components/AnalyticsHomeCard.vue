<script setup lang="ts">
// The analytics card on the admin's home page: visitors of the last 7 days against the 7
// before, their shape, and the three most read pages. Nothing at all for someone who may not
// read the analytics, or while there has been no visit yet.
import { compactNumber, percent } from '../app/format'

const { t, locale } = useCmsI18n()
const tx = (key: string, params?: Record<string, unknown>) => t(`plugins.analytics.${key}`, params as any)

interface Summary {
  visitors: number
  previousVisitors: number
  change: number | null
  series: number[]
  pages: { path: string; visitors: number; entity?: string; id?: string; title?: string }[]
}
const { data } = useLazyFetch<Summary>('/api/cms/_p/analytics/summary', { key: 'analytics-home', server: false })
const show = computed(() => !!data.value && (data.value.visitors > 0 || data.value.previousVisitors > 0))
const delta = computed(() => {
  const c = data.value?.change
  if (c === null || c === undefined) return null
  if (Math.abs(c) < 0.005) return { text: tx('changeSame'), up: null }
  return { text: tx(c > 0 ? 'changeUp' : 'changeDown', { value: percent(Math.abs(c), locale.value) }), up: c > 0 }
})
</script>

<template>
  <section v-if="show && data">
    <h2 class="cms-label mb-2">{{ tx('widget.title') }}</h2>
    <div class="cms-card divide-y divide-(--ui-border-muted)">
      <div class="flex items-end justify-between gap-4 px-4 py-3">
        <div class="min-w-0">
          <p class="text-2xl font-semibold text-highlighted">{{ compactNumber(data.visitors, locale) }}</p>
          <p class="text-xs text-muted">{{ tx('widget.lastWeek') }}</p>
          <p v-if="delta" class="mt-1 flex items-center gap-1 text-xs" :class="delta.up === null ? 'text-muted' : delta.up ? 'text-success' : 'text-error'">
            <UIcon v-if="delta.up !== null" :name="delta.up ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'" class="size-3.5 shrink-0" aria-hidden="true" />
            {{ delta.text }}
          </p>
        </div>
        <AnalyticsSparkline :values="data.series" :label="`${tx('widget.title')}, ${tx('widget.lastWeek')}: ${data.series.join(', ')}`" :width="140" :height="44" class="shrink-0" />
      </div>
      <div v-if="data.pages.length" class="px-4 py-3">
        <p class="mb-2 text-xs font-medium text-muted">{{ tx('widget.topPages') }}</p>
        <ol class="space-y-1">
          <li v-for="p in data.pages" :key="p.path" class="flex items-center justify-between gap-3 text-sm">
            <NuxtLink v-if="p.entity && p.id" :to="`/admin/${p.entity}/${p.id}`" class="min-w-0 truncate text-highlighted hover:underline">{{ p.title || p.path }}</NuxtLink>
            <span v-else class="min-w-0 truncate font-mono text-xs text-highlighted">{{ p.path }}</span>
            <span class="shrink-0 tabular-nums text-muted">{{ compactNumber(p.visitors, locale) }}</span>
          </li>
        </ol>
      </div>
      <NuxtLink to="/admin/p/analytics" class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-muted hover:text-highlighted hover:bg-elevated/40 transition-colors">
        {{ tx('widget.open') }}
        <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
      </NuxtLink>
    </div>
  </section>
</template>
