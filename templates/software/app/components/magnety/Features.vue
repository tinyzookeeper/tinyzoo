<script setup lang="ts">
// Magnets' features: the first one across the page on a board, the next two as a pair of tiles (the
// orange one and the dark one), the last as a wide tile on sky blue. Each heading is a question; the
// section's own heading is only for screen readers.
import type { Feature } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'features'>; first?: boolean; anchor?: string; items: Feature[] }>()
const lead = computed(() => props.items[0] ?? null)
const pair = computed(() => props.items.slice(1, 3))
const rest = computed(() => props.items.slice(3))
const big = (f: Feature) => byLength(f.question || f.title, [[30, 'text-[44px] sm:text-[64px] lg:text-[84px]'], [48, 'text-[36px] sm:text-[48px] lg:text-[64px]']], 'text-[30px] sm:text-[40px] lg:text-[52px]')
const tile = (f: Feature) => byLength(f.question || f.title, [[32, 'text-[40px] sm:text-[52px] lg:text-[60px]'], [52, 'text-[32px] sm:text-[42px] lg:text-[48px]']], 'text-[28px] sm:text-[34px] lg:text-[40px]')
</script>

<template>
  <section :id="anchor" class="wrap py-14 lg:py-24">
    <component :is="first ? 'h1' : 'h2'" class="sr-only"><KitMarked :text="block.heading" plain /></component>

    <article v-if="lead">
      <div class="grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-10">
        <div class="lg:col-span-7">
          <p class="mono"><span class="rounded-full bg-ink px-2.5 py-1 text-cream">1</span> &nbsp;{{ lead.title }}</p>
          <h3 class="q mt-4" :class="big(lead)">{{ tidyText(lead.question || lead.title) }}</h3>
        </div>
        <p class="lg:col-span-5 lg:pb-3"><b v-if="lead.when" class="font-semibold">{{ tidyText(lead.when) }}</b> {{ tidyText(lead.text) }}</p>
      </div>
      <div v-if="lead.image || lead.screen !== 'none'" class="tile mt-8 border-2 border-ink bg-board p-3 sm:p-5 lg:mt-10 lg:p-7">
        <MagnetyScreen :kind="lead.screen" :image="lead.image" />
      </div>
      <ul v-if="lead.points.length" class="mt-5 grid gap-x-10 gap-y-2 text-[16px] font-medium sm:grid-cols-3">
        <li v-for="(p, i) in lead.points" :key="i" class="flex gap-2.5"><UIcon name="i-lucide-check" class="mt-0.5 size-5 flex-none" aria-hidden="true" />{{ tidyText(p.text) }}</li>
      </ul>
      <p v-if="lead.note" class="mono mt-3">{{ tidyText(lead.note) }}</p>
    </article>

    <div v-if="pair.length" class="mt-14 grid gap-4 lg:mt-24 lg:grid-cols-2 lg:gap-5">
      <article v-for="(f, i) in pair" :key="f.id" class="tile flex flex-col p-5 sm:p-8 lg:p-10" :class="i === 0 ? 'bg-brand' : 'on-dark bg-ink text-cream'">
        <p class="mono"><span class="rounded-full px-2.5 py-1" :class="i === 0 ? 'bg-ink text-cream' : 'bg-cream text-ink'">{{ i + 2 }}</span> &nbsp;{{ f.title }}</p>
        <h3 class="q mt-4" :class="tile(f)">{{ tidyText(f.question || f.title) }}</h3>
        <p class="mt-5 max-w-[34rem]"><b v-if="f.when" class="font-semibold">{{ tidyText(f.when) }}</b> {{ tidyText(f.text) }}</p>
        <ul v-if="f.points.length" class="mt-5 space-y-2 text-[16px] font-medium">
          <li v-for="(p, n) in f.points" :key="n" class="flex gap-2.5"><UIcon name="i-lucide-check" class="mt-0.5 size-5 flex-none" aria-hidden="true" />{{ tidyText(p.text) }}</li>
        </ul>
        <div v-if="f.image || f.screen !== 'none'" class="mt-8 flex flex-1 flex-col">
          <MagnetyScreen :kind="f.screen" :image="f.image" />
        </div>
        <CmsImage v-if="f.photo" :media="f.photo" sizes="(min-width: 1024px) 40rem, 100vw" class="mt-6 aspect-[16/7] w-full rounded-[18px] object-cover" :class="i === 1 ? 'object-[50%_35%]' : 'object-[50%_30%]'" />
        <p v-if="f.note" class="mono mt-3">{{ tidyText(f.note) }}</p>
      </article>
    </div>

    <article v-for="(f, i) in rest" :key="f.id" class="tile mt-4 grid gap-8 bg-sky p-5 sm:p-8 lg:mt-5 lg:grid-cols-12 lg:gap-10 lg:p-10">
      <div class="lg:col-span-5">
        <p class="mono"><span class="rounded-full bg-ink px-2.5 py-1 text-cream">{{ i + 4 }}</span> &nbsp;{{ f.title }}</p>
        <h3 class="q mt-4" :class="tile(f)">{{ tidyText(f.question || f.title) }}</h3>
        <p class="mt-5"><b v-if="f.when" class="font-semibold">{{ tidyText(f.when) }}</b> {{ tidyText(f.text) }}</p>
        <ul v-if="f.points.length" class="mt-5 space-y-2 text-[16px] font-medium">
          <li v-for="(p, n) in f.points" :key="n" class="flex gap-2.5"><UIcon name="i-lucide-check" class="mt-0.5 size-5 flex-none" aria-hidden="true" />{{ tidyText(p.text) }}</li>
        </ul>
        <CmsImage v-if="f.photo" :media="f.photo" sizes="(min-width: 1024px) 30rem, 100vw" class="mt-6 aspect-[16/9] w-full rounded-[18px] object-cover object-[50%_30%]" />
      </div>
      <div v-if="f.image || f.screen !== 'none'" class="lg:col-span-7 lg:self-center">
        <MagnetyScreen :kind="f.screen" :image="f.image" />
        <p v-if="f.note" class="mono mt-3">{{ tidyText(f.note) }}</p>
      </div>
    </article>
  </section>
</template>
