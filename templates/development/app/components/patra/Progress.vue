<script setup lang="ts">
// Patra's construction progress: the share built as a large serif number beside the heading, the
// site today and the house as it will stand, and the stages on a thin bar of segments with a dot at
// today (a vertical bar on a phone).
import type { Milestone } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'progress'>; first?: boolean; anchor?: string; milestones: Milestone[] }>()
const words = useSiteWords()
const w = words.value.patra
const stages = computed(() => {
  const now = props.milestones.findIndex((m) => !m.done)
  return props.milestones.map((m, i) => ({ ...m, state: i === now ? 'now' : m.done ? 'done' : '', future: !m.done && i !== now, when: i === now ? w.nowUntil(monthNumbers(m.date)) : monthNumbers(m.date) }))
})
const photos = computed(() => props.block.photos.filter((p) => p.image).slice(0, 2))
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-5 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3">{{ block.heading }}</component>
        <p v-if="block.text" class="lead mt-5">{{ tidyText(block.text) }}</p>
      </div>
      <div v-if="block.percent != null" class="lg:col-span-4 lg:col-start-9 flex items-center gap-5">
        <p class="serif text-[3.4rem] leading-none! text-brand num whitespace-nowrap">{{ words.percent(block.percent) }}</p>
        <p class="text-quiet text-[0.96rem]">{{ tidyText(block.percentLabel) }}</p>
      </div>
    </div>

    <div v-if="photos.length" class="mt-10 lg:mt-12 grid md:grid-cols-2 gap-4 lg:gap-6">
      <figure v-for="(p, i) in photos" :key="i">
        <div class="aspect-[3/2]"><CmsImage :media="p.image!" class="photo" sizes="(min-width: 1024px) 40rem, (min-width: 768px) 50vw, 100vw" /></div>
        <figcaption class="cap"><strong v-if="captionLead(p.caption)[0]" class="text-ink">{{ captionLead(p.caption)[0] }}</strong> {{ captionLead(p.caption)[1] }}</figcaption>
      </figure>
    </div>

    <ol v-if="stages.length" class="ms-row mt-12 lg:mt-14 grid" :style="{ '--n': stages.length }">
      <li v-for="s in stages" :key="s.id" class="ms" :class="s.state ? `ms-${s.state}` : ''">
        <p class="text-[0.86rem] num" :class="s.state === 'now' ? 'text-brand font-medium' : 'text-quiet'">{{ s.when }}</p>
        <p class="leading-snug mt-0.5" :class="s.future ? '' : 'font-medium'">{{ s.title }}</p>
      </li>
    </ol>
    <p v-if="block.status" class="mt-6 lg:mt-10 max-w-3xl text-quiet">{{ tidyText(block.status) }}</p>
    <dl v-if="block.facts.length" class="mt-6 max-w-3xl border-t border-line">
      <div v-for="(row, i) in block.facts" :key="i" class="flex justify-between gap-4 py-3 border-b border-line"><dt class="text-quiet">{{ row.label }}</dt><dd class="font-medium num">{{ row.value }}</dd></div>
    </dl>
  </section>
</template>
