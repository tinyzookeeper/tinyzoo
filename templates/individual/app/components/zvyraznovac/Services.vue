<script setup lang="ts">
// Zvýrazňovač's services: numbered full-width rows with the price under the marker; a row
// fills with the brand colour when the pointer is on it.
import type { Service } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
const words = useSiteWords()
const size = computed(() => byLength(props.block.heading, [
  [40, 'text-[2.9rem] md:text-[4.5rem] lg:text-[5.6rem]'],
  [64, 'text-[2.5rem] md:text-[3.6rem] lg:text-[4.4rem]'],
], 'text-[2.2rem] md:text-[3rem] lg:text-[3.6rem]'))
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28 pb-20 lg:pb-28">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-8 tracking-[-0.05em]" :class="size"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="lg:col-span-4 text-[1.1rem] max-w-[26rem] lg:pb-3">{{ czText(block.text) }}</p>
    </div>

    <div class="mt-12 lg:mt-16 border-b-2 border-ink -mx-5 md:-mx-6">
      <article v-for="(s, i) in items" :key="s.id" class="srow border-t-2 border-ink grid lg:grid-cols-12 gap-x-10 gap-y-4 py-8 lg:py-9 px-5 md:px-6" data-service>
        <div class="lg:col-span-5 flex gap-5 items-baseline">
          <span class="mono text-quiet shrink-0 w-7">{{ pad2(i + 1) }}</span>
          <h3 class="text-[2rem] lg:text-[2.6rem] font-extrabold tracking-[-0.04em]">{{ czText(s.name) }}</h3>
        </div>
        <div class="lg:col-span-4 pl-12 lg:pl-0">
          <p v-if="s.text">{{ czText(s.text) }}</p>
          <p v-if="s.forWhom" class="mt-3 mono text-quiet">{{ words.forWhom }}: {{ czText(continued(s.forWhom)) }}</p>
        </div>
        <div class="lg:col-span-3 pl-12 lg:pl-0 lg:text-right flex lg:block items-baseline gap-5 flex-wrap">
          <p class="font-extrabold text-[1.7rem] lg:text-[1.9rem] tracking-[-0.035em] leading-tight whitespace-nowrap"><span class="hl">{{ czText(s.price) }}</span></p>
          <p v-if="s.duration" class="mono text-quiet lg:mt-2">{{ czText(s.duration) }}</p>
        </div>
      </article>
    </div>

    <div v-if="block.footnote || (block.linkLabel && block.linkUrl)" class="mt-6 flex flex-wrap items-center justify-between gap-x-10 gap-y-2">
      <p v-if="block.footnote" class="mono text-quiet">{{ czText(block.footnote) }}</p>
      <NuxtLink v-if="block.linkLabel && block.linkUrl" class="ulink" :to="siteHref(block.linkUrl)">{{ czText(block.linkLabel) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
    </div>
  </section>
</template>
