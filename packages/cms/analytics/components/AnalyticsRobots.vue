<script setup lang="ts">
// The Visitors page's "Who else reads your website?": the pages AI assistants, search engines,
// AI crawlers and other robots loaded in the period (core/robots.ts). None of them is in the
// visitor numbers. Simple: a sentence about the AI assistants and the four groups. Detailed:
// the same four numbers and every robot by name.
import { compactNumber } from '../app/format'
import type { BarItem } from '../app/types'
import type { RobotGroup, RobotReport } from '../core/robots'

const props = defineProps<{ report: RobotReport; detailed?: boolean }>()
const { t, locale } = useCmsI18n()
const tx = (key: string, params?: Record<string, unknown>) => t(`plugins.analytics.${key}`, params as any)
const uid = useId()

const fmt = (n: number) => compactNumber(n, locale.value)
// The assistants first: they read for a person. Then what people know best.
const ORDER: RobotGroup[] = ['assistant', 'search', 'ai', 'other']
const groups = computed(() => ORDER.map((g) => ({ key: g, value: fmt(props.report.groups[g]), label: tx(`robots.group.${g}`), hint: tx(`robots.hint.${g}`) })))

const lead = computed(() => {
  const n = props.report.groups.assistant
  if (!n) return tx('robots.noAssistants')
  const top = props.report.items.find((i) => i.group === 'assistant')
  return tx('robots.assistants', { count: n, times: fmt(n), name: top?.name ?? '' })
})
const nothing = computed(() => ORDER.every((g) => !props.report.groups[g]))

const items = computed<BarItem[]>(() => props.report.items.map((i) => ({
  key: `${i.group}:${i.name}`,
  label: i.name === 'Other' ? tx('robots.other') : i.name,
  sub: tx(`robots.group.${i.group}`),
  value: i.pages,
  detail: tx('robots.pages', { count: i.pages, pages: fmt(i.pages) }),
})))
</script>

<template>
  <section class="cms-card min-w-0 p-4" :aria-labelledby="`${uid}-title`">
    <h2 v-if="detailed" :id="`${uid}-title`" class="cms-label mb-1">{{ tx('robots.titleDetailed') }}</h2>
    <div v-else class="cms-section__head mb-3">
      <span class="cms-section__tile" aria-hidden="true"><UIcon name="i-lucide-bot" class="size-4" /></span>
      <h2 :id="`${uid}-title`" class="cms-section__title">{{ tx('robots.title') }}</h2>
    </div>
    <p class="text-sm text-pretty" :class="detailed ? 'text-muted' : 'text-highlighted'">{{ lead }}</p>

    <dl class="an-robots mt-3">
      <div v-for="g in groups" :key="g.key" class="an-robots__item">
        <!-- the label first for a screen reader, the number on top on the screen -->
        <dt class="flex items-center gap-1 text-sm text-muted">
          <span class="min-w-0 truncate">{{ g.label }}</span>
          <UTooltip :text="g.hint">
            <UIcon name="i-lucide-circle-help" class="size-3.5 shrink-0 text-dimmed" :aria-label="g.hint" />
          </UTooltip>
        </dt>
        <dd class="cms-display text-lg tabular-nums text-highlighted">{{ g.value }}</dd>
      </div>
    </dl>

    <AnalyticsBarList
      v-if="detailed && !nothing" class="mt-4" paths :mono-sub="false" :selectable="false" :items="items" :rows="8" :locale="locale"
      :empty="tx('list.empty')" :more-label="(count: number) => tx('list.more', { count })" :less-label="tx('list.less')"
    />
    <p class="mt-3 text-xs text-muted">{{ tx('robots.note') }}</p>
  </section>
</template>

<style scoped>
.an-robots { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.an-robots__item { padding: 0.625rem 0.875rem; border-radius: calc(var(--ui-radius) * 1.5); background: var(--ui-bg-muted); min-width: 0; display: flex; flex-direction: column-reverse; justify-content: flex-end; }
.an-robots__item dd, .an-robots__item dt { margin: 0; }
@media (min-width: 40rem) { .an-robots { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
