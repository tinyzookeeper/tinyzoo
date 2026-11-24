<script setup lang="ts">
// Regál's people: the shop and the two people standing on one shelf, the shop's photograph
// across two places, each rail carrying a name and one short word.
import type { Person } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'people'>; first?: boolean; anchor?: string; items: Person[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-10 md:pt-16">
    <div class="grid items-end gap-5 pb-8 md:pb-10 lg:grid-cols-12">
      <component :is="first ? 'h1' : 'h2'" class="text-[2.3rem] font-bold tracking-[-0.035em] md:text-[3.5rem] lg:col-span-7"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="max-w-xl lg:col-span-5 lg:pb-2">{{ tidyText(block.text) }}</p>
    </div>
    <div class="shelf grid-cols-2 lg:grid-cols-4">
      <article v-if="block.shopImage" class="bay col-span-2">
        <div class="stand"><CmsImage :media="block.shopImage" sizes="(min-width: 1024px) 44rem, 100vw" class="aspect-[3/2]" /></div>
        <div class="rail"><h3 class="cond text-[1.75rem] !font-bold !tracking-[0.02em] md:text-[1.95rem]">{{ block.shopTitle }}</h3><p class="num mt-1 text-[1.45rem] opacity-90">{{ block.shopRail }}</p></div>
        <div class="talk"><p class="max-w-xl text-[0.97rem] leading-snug">{{ tidyText(block.shopText || block.quote) }}</p></div>
      </article>
      <article v-for="p in items" :key="p.id" class="bay">
        <div class="stand"><CmsImage v-if="p.image" :media="p.image" sizes="(min-width: 1024px) 22rem, 50vw" class="aspect-[4/5]" /></div>
        <div class="rail"><h3 class="cond text-[1.75rem] !font-bold !tracking-[0.02em] md:text-[1.95rem]">{{ p.name }}</h3><p class="num mt-1 text-[1.45rem] opacity-90">{{ p.role }}</p></div>
        <div class="talk"><p v-if="p.text" class="text-[0.97rem] leading-snug">{{ tidyText(p.text) }}</p></div>
      </article>
    </div>
  </section>
</template>
