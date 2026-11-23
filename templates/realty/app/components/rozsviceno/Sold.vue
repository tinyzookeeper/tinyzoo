<script setup lang="ts">
// Rozsvíceno's sold section: the heading, and up to three rounded cards (a row to swipe on a
// phone): a key tag with how fast it went, what was sold, what the client said, and who said it.
import type { Sale } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'sold'>; first?: boolean; anchor?: string; sales: Sale[] }>()
const w = useSiteWords().value.rozsviceno
const shown = computed(() => props.sales.slice(0, 3))
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-32">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="hand text-[1.2rem]">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.3rem] md:text-[3.2rem]"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'hand' }" /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 text-quiet">{{ tidyText(block.text) }}</p>
    </div>
    <UCarousel
      v-slot="{ item }" :items="shown" align="center" contain-scroll="trimSnaps" class="mt-8 md:mt-10"
      :ui="{ viewport: '-mx-5 px-5 pt-[0.4rem] pb-4 md:mx-0 md:p-0 md:overflow-visible', container: 'items-stretch -ms-4 md:ms-0 md:grid md:grid-cols-3 md:gap-6', item: 'ps-4 md:ps-0 basis-[82%] md:basis-auto' }"
    >
      <figure class="rounded-[1.6rem] bg-surface shadow-[inset_0_0_0_1px_var(--line)] p-7 flex flex-col h-full">
        <p><span class="keytag">{{ w.keytag(item.duration) }}</span></p>
        <p class="mt-4 font-semibold">{{ [item.what, item.place].filter(Boolean).join(w.sep) }}</p>
        <blockquote v-if="item.quote" class="mt-4 serif italic font-medium text-[1.2rem] leading-[1.5]">„{{ tidyText(item.quote) }}“</blockquote>
        <figcaption v-if="item.client" class="mt-auto pt-6 text-quiet">{{ tidyText(item.client) }}</figcaption>
      </figure>
    </UCarousel>
  </section>
</template>
