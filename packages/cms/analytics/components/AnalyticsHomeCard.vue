<script setup lang="ts">
// The analytics card on the admin's home page, said in words: "1 284 people visited in the last
// 7 days", how that compares with the 7 days before, who is on the website now, the shape of the
// week, and the three most read pages (by title). Nothing at all for someone who may not read the
// analytics, or while there has been no visit yet.
import { compactNumber } from '../app/format'

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
const { data: live } = useLazyFetch<{ active: number }>('/api/cms/_p/analytics/live', { key: 'analytics-home-live', server: false })
const show = computed(() => !!data.value && (data.value.visitors > 0 || data.value.previousVisitors > 0))
const fmt = (n: number) => compactNumber(n, locale.value)

const compared = computed(() => {
  const d = data.value
  if (!d || !d.previousVisitors) return null
  const diff = d.visitors - d.previousVisitors
  if (Math.abs(diff) / d.previousVisitors < 0.03) return tx('widget.same')
  return tx(diff > 0 ? 'widget.more' : 'widget.fewer', { count: fmt(Math.abs(diff)) })
})
const max = computed(() => Math.max(1, ...(data.value?.pages ?? []).map((p) => p.visitors)))
</script>

<template>
  <section v-if="show && data">
    <h2 class="cms-label mb-2">{{ tx('widget.title') }}</h2>
    <div class="cms-card divide-y divide-(--ui-border-muted)">
      <div class="flex items-start justify-between gap-4 px-4 py-3">
        <div class="min-w-0">
          <p class="cms-display text-base text-highlighted text-pretty">{{ tx('widget.headline', { count: data.visitors }) }}</p>
          <p class="mt-0.5 text-sm text-muted">
            <template v-if="compared">{{ compared }}</template>
            <template v-if="live?.active">
              <template v-if="compared"> · </template>
              <span class="an-here text-highlighted"><span class="an-here__dot" aria-hidden="true" />{{ tx('widget.here', { count: fmt(live.active) }) }}</span>
            </template>
          </p>
        </div>
        <AnalyticsSparkline :values="data.series" :label="`${tx('widget.title')}: ${data.series.join(', ')}`" :width="120" :height="40" class="shrink-0" />
      </div>
      <div v-if="data.pages.length" class="px-4 py-3">
        <p class="mb-1 text-xs font-medium text-muted">{{ tx('widget.topPages') }}</p>
        <ol class="an-pages">
          <li v-for="p in data.pages" :key="p.path" class="an-page">
            <span class="flex items-center justify-between gap-3 text-sm">
              <NuxtLink v-if="p.entity && p.id" :to="`/admin/${p.entity}/${p.id}`" class="min-w-0 truncate text-highlighted hover:underline">{{ p.title || p.path }}</NuxtLink>
              <span v-else class="min-w-0 truncate text-highlighted">{{ p.title || p.path }}</span>
              <span class="shrink-0 tabular-nums text-muted">{{ fmt(p.visitors) }}</span>
            </span>
            <span class="an-track" aria-hidden="true"><span class="an-bar" :style="{ width: `${Math.max(1.5, (p.visitors / max) * 100)}%` }" /></span>
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

<style src="../app/analytics.css"></style>

<style scoped>
.an-pages { display: flex; flex-direction: column; gap: 0.625rem; }
.an-page { display: flex; flex-direction: column; gap: 0.3125rem; }
.an-track { display: block; height: 5px; border-radius: 9999px; background: var(--cms-an-track); overflow: hidden; }
.an-bar { display: block; height: 100%; border-radius: 9999px; background: var(--cms-an-visitors); }
.an-here { display: inline-flex; align-items: center; gap: 0.375rem; white-space: nowrap; }
.an-here__dot { width: 7px; height: 7px; border-radius: 9999px; background: var(--ui-success); flex: none; }
</style>
