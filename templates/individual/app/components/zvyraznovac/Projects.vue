<script setup lang="ts">
// Zvýrazňovač's projects: on black, the number first. The result is the largest thing on the
// page, the client and the story stand beside it and a small black-and-white photograph ends
// each row.
import type { Project } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'projects'>; first?: boolean; anchor?: string; items: Project[] }>()
const words = useSiteWords()
const size = computed(() => byLength(props.block.heading, [
  [40, 'text-[2.9rem] md:text-[4.5rem] lg:text-[5.6rem]'],
  [64, 'text-[2.5rem] md:text-[3.6rem] lg:text-[4.4rem]'],
], 'text-[2.2rem] md:text-[3rem] lg:text-[3.6rem]'))
</script>

<template>
  <section :id="anchor" class="bg-ink text-paper on-ink">
    <div class="wrap py-20 lg:py-28">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
        <component :is="first ? 'h1' : 'h2'" class="lg:col-span-8 tracking-[-0.05em]" :class="size"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'strike' }" /></component>
        <p v-if="block.text" class="lg:col-span-4 text-[1.1rem] max-w-[26rem] lg:pb-3 opacity-90">{{ czText(block.text) }}</p>
      </div>

      <div v-if="items.length" class="mt-12 lg:mt-16 border-b-2 border-paper/30">
        <NuxtLink v-for="p in items" :key="p.id" :to="projectHref(p.slug)" class="group grid lg:grid-cols-12 gap-x-10 gap-y-6 py-9 lg:py-11 border-t-2 border-paper/30 items-center" data-project>
          <div class="lg:col-span-5">
            <p class="font-black text-brand text-[4.2rem] md:text-[6rem] lg:text-[6.8rem] tracking-[-0.06em] leading-[0.85] whitespace-nowrap flex items-center gap-[0.08em]">
              <template v-for="(part, i) in resultParts(p.result)" :key="i"><UIcon v-if="i" name="i-lucide-arrow-right" class="text-[0.55em]" :aria-label="words.arrowTo" />{{ czText(part) }}</template>
            </p>
            <p v-if="p.resultText" class="mono mt-4 opacity-90">{{ czText(p.resultText) }}</p>
          </div>
          <div class="lg:col-span-4">
            <p class="mono opacity-75">{{ czText([p.client, p.year].filter(Boolean).join(' · ')) }}</p>
            <h3 class="mt-3 text-[1.6rem] lg:text-[1.9rem] font-extrabold tracking-[-0.035em] leading-[1.08] group-hover:text-brand transition-colors">{{ czText(p.title) }}</h3>
            <p v-if="p.done" class="mt-3 opacity-90">{{ czText(p.done) }}</p>
          </div>
          <div class="lg:col-span-3 bw aspect-[4/3]"><CmsImage v-if="p.image" :media="p.image" sizes="(min-width: 1024px) 24rem, 100vw" /></div>
        </NuxtLink>
      </div>
      <p v-else class="mt-12">{{ words.noProjects }}</p>

      <p v-if="block.linkLabel && block.linkUrl" class="mt-8"><NuxtLink class="ulink text-brand" :to="siteHref(block.linkUrl)">{{ czText(block.linkLabel) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink></p>
    </div>
  </section>
</template>
