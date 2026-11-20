<script setup lang="ts">
// Where tinyzoo is heading, as one timeline. The block holds the heading, text and note; the
// plans are the Plan collection (cms.config.ts), edited under "Plány" in the admin. Top to
// bottom: what is done, one group per version (oldest first), then now, next (per version
// too) and later. On the left the version ("verze 0.6", "později"), then a rail with a dot
// per group: a sage dot with a check and a solid line for done, frog green with a halo for
// now, a bird-yellow ring for next, an empty ring and a dashed line for later. Now is a dark
// card per plan with its animal (or Keeper's mark), next a list, later a grid of cream cards. Within a group,
// the editors' order.
// On narrow screens (the block's own width, a container query) the version moves above
// its group, beside the rail.
type Stage = 'done' | 'now' | 'next' | 'later'
type Plan = { id: string; title: string; text?: string | null; stage?: Stage | null; version?: string | null; animal?: string | null }
type Group = { key: string; stage: Stage; version: string | null; items: Plan[] }
const props = defineProps<{ block: { eyebrow?: string | null; heading: string; text?: string | null; note?: string | null }; index?: number }>()
const { lang, t } = useLang()

// The content API returns the editors' order (orderField), so nothing sorts within a group.
const { data } = await useFetch<{ items: Plan[] }>('/api/content/plan', {
  query: computed(() => ({ locale: lang.value, limit: 100 })),
  key: computed(() => `site-plans:${lang.value}`),
})
const plans = computed(() => data.value?.items ?? [])

// "0.10" after "0.9": compare the dotted numbers one by one; anything else as text.
function byVersion(a: string, b: string) {
  const pa = a.split('.'); const pb = b.split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '0'; const y = pb[i] ?? '0'
    const nx = Number(x); const ny = Number(y)
    const d = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y)
    if (d) return d
  }
  return 0
}
// One group per version, oldest first; plans without a version after them.
function byVersions(stage: Stage, items: Plan[]): Group[] {
  const versions = [...new Set(items.map((p) => p.version?.trim() || null))]
  const named = (versions.filter(Boolean) as string[]).sort(byVersion)
  return [...named, ...(versions.includes(null) ? [null] : [])].map((version) => ({
    key: `${stage}-${version ?? 'none'}`, stage, version,
    items: items.filter((p) => (p.version?.trim() || null) === version),
  }))
}
const groups = computed<Group[]>(() => {
  const of = (stage: Stage) => plans.value.filter((p) => (p.stage ?? 'next') === stage)
  const now = of('now'); const later = of('later')
  // Now is one moment: one group, its card per plan, the versions it covers on the left.
  const nowVersions = [...new Set(now.map((p) => p.version?.trim()).filter(Boolean) as string[])].sort(byVersion)
  return [
    ...byVersions('done', of('done')),
    ...(now.length ? [{ key: 'now', stage: 'now' as const, version: nowVersions.join(', ') || null, items: now }] : []),
    ...byVersions('next', of('next')),
    ...(later.length ? [{ key: 'later', stage: 'later' as const, version: null, items: later }] : []),
  ]
})
// A plan's picture: its animal, or Keeper's mark (cream on the dark Now card).
const picture = (it: Plan, i: number, dark = false) =>
  it.animal === 'keeper' ? `/brand/keeper/${dark ? 'mark-reversed' : 'mark'}.svg` : useAnimal(it.animal, i).src
const stageLabel = (s: Stage) => t(({ done: 'roadmapDone', now: 'roadmapNow', next: 'roadmapNext', later: 'roadmapLater' } as const)[s])
// The left column: "verze 0.6"; later is "později"; a plan without a version elsewhere shows none.
const versionLabel = (g: Group) => (g.version ? `${t('roadmapVersion')} ${g.version}` : g.stage === 'later' ? t('roadmapUndated') : '')

// The block's heading is the page's <h1> when the block opens the page (the Plány page);
// the stage labels are the next level down.
const level = computed(() => (props.index === 0 ? 1 : 2))
</script>

<template>
  <section class="section">
    <div class="wrap">
      <div class="max-w-2xl">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="`h${level}`" class="title mt-4 text-4xl sm:text-5xl">{{ block.heading }}</component>
        <p v-if="block.text" class="lede mt-5 whitespace-pre-line">{{ block.text }}</p>
      </div>
      <div v-if="groups.length" class="tl-box mt-14">
        <div class="tl">
          <div v-for="g in groups" :key="g.key" class="tl-row" :class="`tl-row--${g.stage}`">
            <!-- The version for the eye; the heading below says it for screen readers. -->
            <div class="tl-v" aria-hidden="true"><span v-if="versionLabel(g)">{{ versionLabel(g) }}</span></div>
            <div class="tl-body">
              <span class="tl-dot" aria-hidden="true" />
              <component :is="`h${level + 1}`" class="tl-tag">
                {{ stageLabel(g.stage) }}<span v-if="g.version" class="sr-only">, {{ versionLabel(g) }}</span>
              </component>
              <!-- Now: a dark card per plan, its animal big at the bottom right. -->
              <ul v-if="g.stage === 'now'" class="tl-now">
                <li v-for="(it, i) in g.items" :key="it.id" class="tl-now-card">
                  <div class="min-w-0">
                    <p class="tl-now-title">{{ it.title }}</p>
                    <p v-if="it.text" class="tl-now-text whitespace-pre-line">{{ it.text }}</p>
                  </div>
                  <img :src="picture(it, i, true)" alt="" aria-hidden="true" class="tl-now-animal">
                </li>
              </ul>
              <!-- Later: a grid of cream cards. -->
              <ul v-else-if="g.stage === 'later'" class="tl-later">
                <li v-for="(it, i) in g.items" :key="it.id" class="tl-later-card">
                  <img :src="picture(it, i)" alt="" aria-hidden="true" class="tl-animal" loading="lazy">
                  <div class="min-w-0">
                    <p class="tl-title">{{ it.title }}</p>
                    <p v-if="it.text" class="tl-text whitespace-pre-line">{{ it.text }}</p>
                  </div>
                </li>
              </ul>
              <!-- Done and next: rows with the animal; done smaller and quieter. -->
              <ul v-else class="tl-items">
                <li v-for="(it, i) in g.items" :key="it.id" class="tl-item">
                  <img :src="picture(it, i)" alt="" aria-hidden="true" class="tl-animal" loading="lazy">
                  <div class="min-w-0">
                    <p class="tl-title">{{ it.title }}</p>
                    <p v-if="it.text" class="tl-text whitespace-pre-line">{{ it.text }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <p v-if="block.note" class="mt-8 max-w-3xl text-sm leading-relaxed text-mute whitespace-pre-line">{{ block.note }}</p>
    </div>
  </section>
</template>

<style>
/* The timeline answers to its own width, so it works wherever the block sits. */
.tl-box { container-type: inline-size; }
.tl { display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); column-gap: 2rem; }
.tl-row { display: contents; }
.tl-v { padding-top: 0.125rem; text-align: right; }
.tl-v span { font-family: var(--font-mono); font-weight: 500; font-size: 0.9375rem; color: var(--color-mute); }
/* The rail: each group draws its own piece, solid through what is done, dashed after. */
.tl-body { position: relative; min-width: 0; padding: 0 0 2.25rem 2.25rem; }
.tl-row:last-child .tl-body { padding-bottom: 0.5rem; }
.tl-body::before, .tl-v::before { content: ""; position: absolute; left: 7px; top: 0; bottom: 0; border-left: 2px dashed rgb(19 19 19 / 0.16); }
.tl-v::before { content: none; }
.tl-row--done .tl-body::before, .tl-row--done .tl-v::before { border-left-style: solid; border-left-color: rgb(19 19 19 / 0.18); }
.tl-dot { position: absolute; left: 0; top: 0.125rem; width: 16px; height: 16px; border-radius: 999px; background: var(--color-paper); box-shadow: inset 0 0 0 2px rgb(19 19 19 / 0.28); }
.tl-row--done .tl-dot { background: #879680; box-shadow: none; }
/* The check is drawn centred in its own 12×12 box: a rotated border box sat left of and above the middle. */
.tl-row--done .tl-dot::after { content: ""; position: absolute; inset: 0; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.75 6.25 5 8.5l4.25-5' fill='none' stroke='%23fff' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 11px 11px no-repeat; }
.tl-row--now .tl-dot { background: var(--color-frog); box-shadow: 0 0 0 6px color-mix(in oklab, var(--color-frog) 30%, transparent); }
.tl-row--next .tl-dot { box-shadow: inset 0 0 0 3px var(--color-bird); }

/* The stage: a small label; "Právě teď" in a darker frog green that reads on white (5.4:1). */
.tl-tag { display: block; margin-bottom: 0.75rem; font-size: 0.75rem; line-height: 1.25rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-mute); }
.tl-row--now .tl-tag { color: #2F7A2F; }

/* Done and next: rows. */
.tl-items { display: grid; gap: 0.875rem; }
.tl-item { display: flex; gap: 0.875rem; align-items: flex-start; }
.tl-animal { width: 2.5rem; height: auto; flex-shrink: 0; margin-top: 0.125rem; }
.tl-title { font-weight: 800; letter-spacing: -0.015em; font-size: 1.0625rem; line-height: 1.4; }
.tl-text { margin-top: 0.25rem; font-size: 0.9375rem; line-height: 1.55; color: var(--color-mute); }
.tl-row--done .tl-items { gap: 0.75rem; }
.tl-row--done .tl-animal { width: 2rem; }
.tl-row--done .tl-title { font-size: 0.9375rem; }
.tl-row--done .tl-text { font-size: 0.875rem; }

/* Now: the dark card, the animal sitting on its bottom edge. */
.tl-now { display: grid; gap: 0.75rem; }
.tl-now-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1rem; padding: 1.5rem 1.5rem 0; border-radius: 1.25rem; background: var(--color-charcoal); color: var(--color-cream); overflow: hidden; }
.tl-now-title { font-size: 1.625rem; line-height: 1.25; font-weight: 800; letter-spacing: -0.025em; }
.tl-now-text { max-width: 52ch; margin-top: 0.5rem; padding-bottom: 1.5rem; line-height: 1.6; color: rgb(249 245 239 / 0.8); }
.tl-now-animal { width: 9.375rem; height: auto; align-self: end; margin-bottom: -6px; }

/* Later: cream cards, two a row. */
.tl-later { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.625rem; }
.tl-later-card { display: flex; gap: 0.75rem; align-items: flex-start; padding: 1rem; border-radius: 1rem; background: var(--color-cream); }
.tl-later .tl-animal { width: 2.125rem; }
.tl-later .tl-title { font-size: 0.9375rem; letter-spacing: -0.01em; }
.tl-later .tl-text { font-size: 0.875rem; line-height: 1.5; }

/* Narrow: one column; the version sits above its group, beside the rail. */
@container (max-width: 640px) {
  .tl { grid-template-columns: minmax(0, 1fr); }
  .tl-v { position: relative; padding: 0 0 0.375rem 2.25rem; text-align: left; }
  .tl-v:empty { display: none; }
  .tl-v::before { content: ""; }
  .tl-body { padding-bottom: 1.75rem; }
  .tl-later { grid-template-columns: minmax(0, 1fr); }
  .tl-now-card { grid-template-columns: minmax(0, 1fr); }
  .tl-now-animal { width: 7.5rem; justify-self: end; }
}
</style>
