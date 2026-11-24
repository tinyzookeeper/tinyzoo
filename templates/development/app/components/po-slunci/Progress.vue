<script setup lang="ts">
// Po slunci's construction progress: the one deep brand panel of the page, the site photograph on
// the left and the stages as a vertical list of rounded rows on the right: done ones with a white
// dot, the current one a lit white pill with the sun in it.
import type { Milestone } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'progress'>; first?: boolean; anchor?: string; milestones: Milestone[] }>()
const words = useSiteWords()
const w = words.value.poSlunci
const stages = computed(() => {
  const now = props.milestones.findIndex((m) => !m.done)
  return props.milestones.map((m, i) => {
    const d = dateParts(m.date)
    return { ...m, state: i === now ? 'now' : m.done ? 'done' : '', month: d ? `${words.value.months[Number(d.monthNumber) - 1]} ${d.year}` : '', until: d ? w.until(`${d.month} ${d.year}`) : '' }
  })
})
const photo = computed(() => props.block.photos.find((p) => p.image) ?? null)
</script>

<template>
  <section :id="anchor" class="on-brand slab bg-brand text-brand-ink scroll-mt-4">
    <div class="wrap">
      <div class="head">
        <div>
          <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2">{{ block.heading }}</component>
        </div>
        <p v-if="block.text" class="lead">{{ tidyText(block.text) }}</p>
      </div>
      <div class="gap-head grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
        <div :class="stages.length ? 'lg:col-span-7' : 'lg:col-span-12'">
          <figure v-if="photo" class="relative aspect-[3/2]"><CmsImage :media="photo.image!" class="photo" sizes="(min-width: 1024px) 46rem, 100vw" /><figcaption v-if="photo.caption" class="pill-cap">{{ photo.caption }}</figcaption></figure>
          <p v-if="block.percent != null && block.percentLabel" class="mt-5 font-semibold num">{{ words.percent(block.percent) }} <span class="font-normal opacity-90">{{ block.percentLabel }}</span></p>
          <p v-if="block.status" class="mt-5 max-w-[34rem] opacity-90">{{ tidyText(block.status) }}</p>
          <dl v-if="block.facts.length" class="mt-5 max-w-[34rem]">
            <div v-for="(row, i) in block.facts" :key="i" class="flex justify-between gap-4 py-2 border-b border-white/25"><dt class="opacity-90">{{ row.label }}</dt><dd class="font-semibold num">{{ row.value }}</dd></div>
          </dl>
        </div>
        <ol v-if="stages.length" class="lg:col-span-5 flex flex-col gap-1.5">
          <li v-for="s in stages" :key="s.id" class="ms" :class="s.state ? `ms-${s.state}` : ''">
            <span class="ms-dot" />
            <span class="text-[0.9rem] num" :class="s.state === 'now' ? 'font-semibold' : 'opacity-90'">{{ s.state === 'now' ? w.now : s.month }}</span>
            <span class="serif text-[1.3rem]" :class="s.state === 'now' ? 'leading-tight' : ''">{{ s.title }}<template v-if="s.state === 'now'">{{ ' ' }}<span class="font-sans text-[0.84rem] whitespace-nowrap">{{ s.until }}</span></template></span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
