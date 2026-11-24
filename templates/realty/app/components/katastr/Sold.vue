<script setup lang="ts">
// Katastr's sold section: a heading over a rule, then up to three columns divided by hairlines:
// the time it took in a large serif, what was sold, what the client said.
import type { Sale } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'sold'>; first?: boolean; anchor?: string; sales: Sale[] }>()
const w = useSiteWords().value.katastr
const shown = computed(() => props.sales.slice(0, 3))
const edge = (i: number) => (shown.value.length < 2 ? 'py-8 md:py-10 border-b md:border-b-0 border-line' : i === 0 ? 'py-8 md:py-10 md:pr-10 border-b md:border-b-0 border-line' : i === shown.value.length - 1 ? 'py-8 md:py-10 md:pl-10 md:border-l border-line' : 'py-8 md:py-10 md:px-10 border-b md:border-b-0 md:border-l border-line')
</script>

<template>
  <section :id="anchor" class="wrap py-20 md:py-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end pb-8 border-b border-ink">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[2.1rem] md:text-[2.75rem] leading-[1.1]"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 text-quiet">{{ tidyText(block.text) }}</p>
    </div>
    <div class="grid md:grid-cols-3">
      <figure v-for="(s, i) in shown" :key="s.id" :class="edge(i)">
        <p class="serif text-ink text-[3.4rem] leading-none num">{{ durationParts(s.duration)[0] }} <span class="text-[1.5rem]">{{ durationParts(s.duration)[1] }}</span></p>
        <p class="mt-4 label text-quiet">{{ [s.what, s.place].filter(Boolean).join(w.sep) }}</p>
        <blockquote v-if="s.quote" class="mt-5 serif text-ink text-[1.15rem] leading-[1.6]">„{{ tidyText(s.quote) }}“</blockquote>
        <figcaption v-if="s.client" class="mt-5 text-[0.95rem]">{{ tidyText(s.client) }}</figcaption>
      </figure>
    </div>
  </section>
</template>
