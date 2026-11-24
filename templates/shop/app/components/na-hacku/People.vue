<script setup lang="ts">
// Na háčku's people: the story and a sentence in a soft box, and two portraits in rounded
// corners, each with a tilted green name plate overlapping its corner.
import type { Person } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'people'>; first?: boolean; anchor?: string; items: Person[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 py-16 md:py-24">
    <div class="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" :class="block.eyebrow ? 'mt-5' : ''" class="text-[2.3rem] md:text-[3.3rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 text-[1.08rem]">{{ tidyText(block.text) }}</p>
        <p v-if="block.quote" class="disp mt-7 rounded-[26px] bg-tint px-6 py-5 text-[1.45rem] font-bold leading-snug text-brand">„{{ tidyText(block.quote) }}“</p>
      </div>
      <div class="grid gap-8 sm:grid-cols-2 lg:col-span-7">
        <article v-for="(p, i) in items" :key="p.id" :class="i % 2 ? 'sm:mt-12' : ''">
          <CmsImage v-if="p.image" :media="p.image" sizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 100vw" class="aspect-[4/5] w-full rounded-[26px] object-cover" />
          <div class="relative z-10 -mt-7 ml-4 inline-block rounded-2xl bg-brand px-4 py-2.5 text-brand-ink" :class="i % 2 ? 'rotate-1' : '-rotate-2'"><h3 class="text-[1.35rem]">{{ p.name }}</h3><p v-if="p.role" class="text-[0.85rem] font-bold opacity-85">{{ p.role }}</p></div>
          <p v-if="p.text" class="mt-4">{{ tidyText(p.text) }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
