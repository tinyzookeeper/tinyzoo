<script setup lang="ts">
// Ateliér's price list: ruled columns, the highlighted package tinted.
import type { Pack } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'pricing'>; first?: boolean; packs: Pack[] }>()
</script>

<template>
  <section class="wrap py-20 md:py-32">
    <div class="grid md:grid-cols-12 gap-x-10 gap-y-5 mb-10 md:mb-14">
      <div class="md:col-span-7">
        <p v-if="block.eyebrow" class="label text-quiet mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.4rem] md:text-[3.4rem] leading-none"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="md:col-span-5 max-w-[34rem]">{{ tidyText(block.text) }}</p>
    </div>

    <div class="grid border-t border-ink" :class="packs.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'">
      <article
        v-for="(p, i) in packs" :key="p.id"
        :class="p.highlighted
          ? 'relative py-9 md:py-11 px-6 md:px-10 -mx-5 md:mx-0 bg-tint'
          : ['py-9 md:py-11 border-b border-line md:border-b-0', i % 3 === 0 ? 'md:pr-10' : 'md:px-10 md:border-l']"
      >
        <div class="flex items-center justify-between gap-4">
          <h3 class="label !font-sans !font-medium !tracking-[0.18em] text-ink">{{ p.name }}</h3>
          <span v-if="p.highlighted && p.highlightLabel" class="label text-brand text-right">{{ p.highlightLabel }}</span>
        </div>
        <p class="font-display text-ink text-[3.3rem] md:text-[3.8rem] leading-none mt-6">{{ formatPrice(p.price) }}&nbsp;<span class="text-[0.45em]">Kč</span></p>
        <p v-if="p.description" class="mt-4 font-display italic text-[1.2rem] text-ink leading-snug">{{ tidyText(p.description) }}</p>
        <ul v-if="p.includes.length" class="mt-7 border-t border-line">
          <li v-for="line in p.includes" :key="line.id" class="py-2.5 border-b border-line">{{ tidyText(line.text) }}</li>
        </ul>
        <NuxtLink v-if="p.highlighted && block.buttonLabel && block.buttonUrl" class="btn label mt-8 w-full" :to="siteHref(block.buttonUrl)">{{ block.buttonLabel }}</NuxtLink>
      </article>
    </div>
    <p v-if="block.footnote" class="mt-8 md:mt-10 max-w-[46rem]">
      {{ tidyText(block.footnote) }}
      <NuxtLink v-if="block.footnoteLinkLabel && block.footnoteLinkUrl" class="text-ink underline underline-offset-4 decoration-1 hover:text-brand" :to="siteHref(block.footnoteLinkUrl)">{{ tidyText(block.footnoteLinkLabel) }}</NuxtLink>
    </p>
  </section>
</template>
