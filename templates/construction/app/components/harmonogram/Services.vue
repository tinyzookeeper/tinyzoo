<script setup lang="ts">
// Harmonogram's services: one ruled strip of columns, a column for each kind of work with what
// is in the price (filled green squares) and what is not (empty ones). On a phone and a
// tablet the columns are a row to swipe.
import type { Service } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="scroll-mt-20 pt-20 lg:pt-28">
    <div class="wrap">
      <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="max-w-[12em] text-[40px] font-extrabold leading-[.95] tracking-[-.04em] text-text sm:text-[64px]" :class="block.eyebrow ? 'mt-3' : ''"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
      <p v-if="block.text" class="mt-6 max-w-[36em] leading-[1.6] text-quiet">{{ tidyText(block.text) }}</p>
    </div>
    <div class="wrap mt-10 !pr-0 xl:!pr-10">
      <UCarousel
        v-slot="{ item: s, index }" :items="items" align="start" contain-scroll="trimSnaps" drag-free
        :ui="{ viewport: 'border-y border-line', container: 'items-stretch', item: 'basis-[82%] sm:basis-[340px] xl:basis-0 xl:grow' }"
      >
        <article class="h-full py-7" :class="index === items.length - 1 && index > 0 ? 'pl-6 pr-6 xl:pr-0' : index === 0 ? 'border-r border-line pr-6' : 'border-r border-line px-6'" data-service>
          <p v-if="s.price || s.unit" class="num text-[14px] text-brand">{{ [s.price, s.unit].filter(Boolean).join(' ') }}</p>
          <h3 class="mt-2 text-[26px] font-extrabold tracking-[-.03em] text-text" :class="s.name.length > 16 ? 'xl:text-[23px] xl:leading-[39px]' : ''">{{ s.name }}</h3>
          <p v-if="s.text" class="mt-3 text-[15px] leading-relaxed text-quiet">{{ tidyText(s.text) }}</p>
          <p class="mono mt-6">{{ words.included }}</p>
          <ul class="mt-2 space-y-1.5 text-[15px] text-text"><li v-for="(it, j) in s.included" :key="j" class="flex gap-3"><span class="mt-[8px] h-2 w-2 flex-none bg-brand" />{{ it.text }}</li></ul>
          <template v-if="s.excluded.length">
            <p class="mono mt-6">{{ words.outOfPrice }}</p>
            <ul class="mt-2 space-y-1.5 text-[15px] text-quiet"><li v-for="(it, j) in s.excluded" :key="j" class="flex gap-3"><span class="mt-[8px] h-2 w-2 flex-none border border-quiet" />{{ it.text }}</li></ul>
          </template>
        </article>
      </UCarousel>
    </div>
    <div v-if="block.note" class="wrap"><p class="mono mt-4">{{ block.note }}</p></div>
  </section>
</template>
