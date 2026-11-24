<script setup lang="ts">
// Modrotisk's construction progress: the stages as an axis, solid up to now and dashed after it
// (a vertical line on a phone), under it the site photograph and the state of the work, with
// the share built and the rows of facts ruled.
import type { Milestone } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'progress'>; first?: boolean; index?: number; anchor?: string; milestones: Milestone[] }>()
const { settings } = await useSite()
const words = useSiteWords()
const w = words.value.modrotisk
const stages = computed(() => {
  const now = props.milestones.findIndex((m) => !m.done)
  return props.milestones.map((m, i) => ({ ...m, state: i === now ? 'now' : m.done ? 'done' : '', when: i === now ? w.nowUntil(monthNumbers(m.date)) : monthNumbers(m.date) }))
})
const photo = computed(() => props.block.photos.find((p) => p.image) ?? null)
const caption = computed(() => captionPair(photo.value?.caption))
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-4">
    <p class="label sheet"><b>{{ sectionNo(index) }}</b> {{ block.eyebrow }}</p>
    <div class="mt-8 grid lg:grid-cols-12 gap-x-12 gap-y-5">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-6 text-[2.5rem] lg:text-[3.6rem]">{{ block.heading }}</component>
      <p v-if="block.text" class="lg:col-span-5 lg:col-start-8 text-quiet self-end">{{ tidyText(block.text) }}</p>
    </div>

    <ol v-if="stages.length" class="ms-row mt-12 grid relative" :style="{ '--n': stages.length }">
      <li v-for="s in stages" :key="s.id" class="ms" :class="s.state ? `ms-${s.state}` : ''">
        <span class="ms-dot" />
        <p class="label" :class="s.state === 'now' ? 'text-accent!' : ''">{{ s.when }}</p>
        <p class="ms-t">{{ s.title }}</p>
      </li>
    </ol>

    <div class="mt-14 grid lg:grid-cols-12 gap-x-12 gap-y-8 items-start">
      <figure v-if="photo" class="lg:col-span-7">
        <div class="frame aspect-[3/2]"><CmsImage :media="photo.image!" sizes="(min-width: 1024px) 46rem, 100vw" /></div>
        <figcaption v-if="caption[0]" class="cap"><span>{{ caption[0] }}</span><span>{{ caption[1] }}</span></figcaption>
      </figure>
      <div :class="photo ? 'lg:col-span-5 lg:pt-2' : 'lg:col-span-12'">
        <p v-if="settings?.asOf" class="label text-accent!">{{ w.statusAsOf(dateNumbers(settings.asOf)) }}</p>
        <p v-if="block.status" class="mt-3 font-display font-light text-[1.7rem] leading-[1.25] tracking-tight">{{ tidyText(block.status) }}</p>
        <dl v-if="block.percent != null || block.facts.length" class="mt-7 border-t border-line">
          <div v-if="block.percent != null" class="flex justify-between gap-4 py-3 border-b" style="border-color:var(--line-soft)"><dt class="text-quiet">{{ block.percentLabel }}</dt><dd class="num font-medium">{{ words.percent(block.percent) }}</dd></div>
          <div v-for="(row, i) in block.facts" :key="i" class="flex justify-between gap-4 py-3 border-b" style="border-color:var(--line-soft)"><dt class="text-quiet">{{ row.label }}</dt><dd class="num font-medium">{{ row.value }}</dd></div>
        </dl>
      </div>
    </div>
  </section>
</template>
