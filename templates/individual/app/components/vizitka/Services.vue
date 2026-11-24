<script setup lang="ts">
// Vizitka's services: a real price list. A ruled table with the columns service, for whom,
// how long and price (a stacked row on a phone), then a note and a link to the call.
import type { Service } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="wrap py-20 lg:py-28">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-5 items-end">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="label text-brand">{{ czText(block.eyebrow) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.1rem] md:text-[2.75rem] leading-[1.12]"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 lg:col-start-8 max-w-[34rem]">{{ czText(block.text) }}</p>
    </div>

    <div class="mt-12 lg:mt-16 border-b border-ink">
      <div class="hidden lg:grid grid-cols-[5fr_4fr_2fr_2fr] gap-x-10 pb-3 px-4 label text-quiet" aria-hidden="true">
        <span>{{ words.service }}</span><span>{{ words.forWhom }}</span><span>{{ words.duration }}</span><span class="text-right">{{ words.price }}</span>
      </div>

      <article v-for="s in items" :key="s.id" class="srow border-t border-line first-of-type:border-ink lg:grid grid-cols-[5fr_4fr_2fr_2fr] gap-x-10 py-7 lg:py-8 lg:px-4" data-service>
        <div>
          <h3 class="text-[1.5rem] lg:text-[1.6rem] leading-[1.2]">{{ czText(s.name) }}</h3>
          <p v-if="s.text" class="mt-2 max-w-[30rem]">{{ czText(s.text) }}</p>
        </div>
        <dl class="contents">
          <div class="mt-4 lg:mt-1"><dt class="label text-quiet lg:sr-only">{{ words.forWhom }}</dt><dd class="mt-1 lg:mt-0">{{ czText(s.forWhom) }}</dd></div>
          <div class="mt-4 lg:mt-1 inline-block w-[48%] lg:w-auto align-top"><dt class="label text-quiet lg:sr-only">{{ words.duration }}</dt><dd class="mt-1 lg:mt-0 text-ink">{{ czText(s.duration) }}</dd></div>
          <div class="mt-4 lg:mt-0 inline-block w-[48%] lg:w-auto align-top lg:text-right"><dt class="label text-quiet lg:sr-only">{{ words.price }}</dt><dd class="serif text-ink text-[1.35rem] lg:text-[1.45rem] font-medium whitespace-nowrap">{{ czText(s.price) }}</dd></div>
        </dl>
      </article>
    </div>

    <div v-if="block.footnote || (block.linkLabel && block.linkUrl)" class="mt-6 flex flex-wrap items-center justify-between gap-x-10 gap-y-2">
      <p v-if="block.footnote" class="text-[0.95rem] text-quiet">{{ czText(block.footnote) }}</p>
      <NuxtLink v-if="block.linkLabel && block.linkUrl" class="tlink" :to="siteHref(block.linkUrl)">{{ czText(block.linkLabel) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
    </div>
  </section>
</template>
