<script setup lang="ts">
// Where tinyzoo is heading. The block holds the heading, text and note; the plans are the
// Plan collection (cms.config.ts), edited under "Plány" in the admin and listed here in the
// editors' order. Now, next and later are three columns, each plan a card with one of the
// animals, laid out as one grid so all tiles have the same height; on phones the stages
// stack in the same order. Done follows as its own calmer section, with each version.
type Stage = 'done' | 'now' | 'next' | 'later'
type Plan = { id: string; title: string; text?: string | null; stage?: Stage | null; version?: string | null; animal?: string | null }
defineProps<{ block: { eyebrow?: string | null; heading: string; text?: string | null; note?: string | null } }>()
const { lang, t } = useLang()

// The content API returns the editors' order (orderField), so nothing sorts here.
const { data } = await useFetch<{ items: Plan[] }>('/api/content/plan', {
  query: computed(() => ({ locale: lang.value, limit: 100 })),
  key: computed(() => `site-plans:${lang.value}`),
})
const plans = computed(() => data.value?.items ?? [])
const stages = computed(() => ([
  { key: 'now', label: t('roadmapNow'), tint: '#73C573' },
  { key: 'next', label: t('roadmapNext'), tint: '#FEBD3B' },
  { key: 'later', label: t('roadmapLater'), tint: '#67B1F9' },
] as const).map((s) => ({ ...s, items: plans.value.filter((i) => (i.stage ?? 'next') === s.key) })).filter((s) => s.items.length))
const done = computed(() => plans.value.filter((i) => i.stage === 'done'))
</script>

<template>
  <section class="section">
    <div class="wrap">
      <div class="max-w-2xl">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <h2 class="title mt-4 text-4xl sm:text-5xl">{{ block.heading }}</h2>
        <p v-if="block.text" class="lede mt-5 whitespace-pre-line">{{ block.text }}</p>
      </div>
      <div v-if="stages.length" class="roadmap mt-14" :style="{ '--cols': stages.length }">
        <!-- One grid: on wide screens each stage is a column and every tile row has the same height. -->
        <section v-for="(s, c) in stages" :key="s.key" class="roadmap-col" :aria-labelledby="`roadmap-${s.key}`">
          <h3 :id="`roadmap-${s.key}`" class="roadmap-stage" :style="{ '--tint': s.tint, '--col': c + 1 }">{{ s.label }}</h3>
          <ul class="roadmap-list">
            <li v-for="(it, i) in s.items" :key="it.id" class="roadmap-card" :style="{ '--col': c + 1, '--row': i + 2 }">
              <img :src="useAnimal(it.animal, i).src" alt="" class="roadmap-animal" aria-hidden="true">
              <div class="min-w-0">
                <p class="font-extrabold tracking-[-0.015em]">{{ it.title }}</p>
                <p v-if="it.text" class="mt-1.5 text-[0.95rem] leading-relaxed text-mute whitespace-pre-line">{{ it.text }}</p>
              </div>
            </li>
          </ul>
        </section>
      </div>
      <!-- What is already in tinyzoo: after the plans, quieter, each with the version it came in. -->
      <section v-if="done.length" class="roadmap-done" :class="stages.length ? 'mt-16' : 'mt-14'" aria-labelledby="roadmap-done">
        <h3 id="roadmap-done" class="roadmap-stage" style="--tint: #879680">{{ t('roadmapDone') }}</h3>
        <ul class="roadmap-done-list">
          <li v-for="(it, i) in done" :key="it.id" class="roadmap-card roadmap-card--done">
            <img :src="useAnimal(it.animal, i).src" alt="" class="roadmap-animal" aria-hidden="true">
            <div class="min-w-0">
              <p v-if="it.version" class="roadmap-version">{{ t('roadmapVersion') }} {{ it.version }}</p>
              <p class="font-extrabold tracking-[-0.015em]">{{ it.title }}</p>
              <p v-if="it.text" class="mt-1.5 text-[0.95rem] leading-relaxed text-mute whitespace-pre-line">{{ it.text }}</p>
            </div>
          </li>
        </ul>
      </section>
      <p v-if="block.note" class="mt-8 max-w-3xl text-sm leading-relaxed text-mute whitespace-pre-line">{{ block.note }}</p>
    </div>
  </section>
</template>

<style>
.roadmap { display: grid; gap: 0.75rem; }
.roadmap-list { display: grid; gap: 0.75rem; }
.roadmap-col + .roadmap-col { margin-top: 1.25rem; }
.roadmap-stage { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 0.875rem; font-size: 0.8125rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-ink); }
.roadmap-stage::before { content: ""; width: 0.625rem; height: 0.625rem; border-radius: 999px; background: var(--tint); }
.roadmap-card { display: flex; gap: 1rem; align-items: flex-start; padding: 1.25rem; border-radius: 1.25rem; background: var(--color-cream); }
.roadmap-animal { width: 2.75rem; height: auto; flex-shrink: 0; margin-top: 0.125rem; }
/* Done: the koala's sage, a calm wash instead of the cream, and the version as a small label. */
.roadmap-done-list { display: grid; gap: 0.75rem; }
.roadmap-card--done { background: color-mix(in oklab, #879680 12%, #fff); }
.roadmap-version { margin-bottom: 0.25rem; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.04em; color: #56614F; font-variant-numeric: tabular-nums; }
@media (min-width: 640px) {
  .roadmap-done-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* Wide: the stages are columns of one grid; the tiles sit in shared rows of equal height. */
@media (min-width: 1024px) {
  .roadmap { grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); grid-template-rows: auto; grid-auto-rows: 1fr; gap: 0.75rem 1.25rem; }
  .roadmap-col, .roadmap-list { display: contents; }
  .roadmap-col + .roadmap-col { margin-top: 0; }
  .roadmap .roadmap-stage { grid-column: var(--col); grid-row: 1; margin-bottom: 0.5rem; }
  .roadmap .roadmap-card { grid-column: var(--col); grid-row: var(--row); }
  .roadmap-done-list { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 0.75rem 1.25rem; }
}
</style>
