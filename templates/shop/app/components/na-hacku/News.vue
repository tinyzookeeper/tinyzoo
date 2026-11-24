<script setup lang="ts">
// Na háčku's news on a quiet surface: the date in a green round badge, the day and the month's name.
import type { News } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'news'>; first?: boolean; anchor?: string; items: News[] }>()
</script>

<template>
  <section :id="anchor" class="scroll-mt-0 bg-tint py-16 md:py-24">
    <div class="wrap">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" :class="block.eyebrow ? 'mt-5' : ''" class="text-[2.3rem] md:text-[3.3rem]"><KitMarked :text="block.heading" /></component>
        </div>
        <NuxtLink v-if="block.moreLabel && block.moreUrl" :to="siteHref(block.moreUrl)" class="ulink inline-flex min-h-11 items-center font-bold">{{ block.moreLabel }}</NuxtLink>
      </div>
      <div class="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
        <article v-for="n in items" :key="n.id">
          <p class="disp flex size-[5.2rem] flex-col items-center justify-center rounded-full bg-brand text-card"><time :datetime="dateParts(n.date)?.iso" class="text-center text-[1.5rem] font-extrabold leading-none">{{ dateParts(n.date)?.day }}.<span class="block text-[0.95rem] font-bold">{{ dateParts(n.date)?.month }}</span></time></p>
          <h3 class="mt-5 text-[1.4rem] !leading-[1.1]">{{ tidyText(n.title) }}</h3>
          <p v-if="n.text" class="mt-2 text-[0.97rem]">{{ tidyText(n.text) }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
