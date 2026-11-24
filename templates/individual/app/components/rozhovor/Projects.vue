<script setup lang="ts">
// Rozhovor's projects: on a rounded tinted panel, photo cards with the result in a coloured
// bubble on the photograph's edge. A row to swipe on a phone, two columns from a tablet's width.
import type { Project } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'projects'>; first?: boolean; anchor?: string; items: Project[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="panel bg-tint on-tint">
    <div class="wrap py-16 lg:py-24">
      <RozhovorQuestion :question="block.question" kicker-class="text-ink" />
      <RozhovorAnswer :heading="block.heading" :first="first" :asked="!!block.question" class="max-w-[46rem]" />

      <UCarousel
        v-if="items.length" v-slot="{ item: p }" :items="items" align="start" contain-scroll="trimSnaps" drag-free class="mt-10 lg:mt-12"
        :ui="{ viewport: '-mx-5 px-5 md:mx-0 md:px-0 pb-3 md:pb-0', container: 'items-stretch -ms-4 md:ms-0 md:grid md:grid-cols-2 md:gap-4 lg:gap-5', item: 'basis-[84%] md:basis-auto ps-4 md:ps-0 flex' }"
      >
        <NuxtLink :to="projectHref(p.slug)" class="card w-full p-3 flex flex-col" data-project>
          <div class="relative">
            <div class="ph aspect-[3/2] rounded-[1.3rem]"><CmsImage v-if="p.image" :media="p.image" sizes="(min-width: 1280px) 36rem, (min-width: 768px) 46vw, 84vw" /></div>
            <p v-if="p.result" class="absolute left-4 -bottom-7 bg-brand text-brand-ink rounded-[1.3rem_1.3rem_1.3rem_0.3rem] px-5 py-3 flex items-center gap-3">
              <span class="serif font-bold text-[1.7rem] leading-none tracking-[-0.03em] whitespace-nowrap inline-flex items-center gap-1.5">
                <template v-for="(part, i) in resultParts(p.result)" :key="i"><UIcon v-if="i" name="i-lucide-arrow-right" class="text-[0.65em]" :aria-label="words.arrowTo" />{{ czText(part) }}</template>
              </span>
              <span v-if="p.resultText" class="text-[0.95rem] leading-[1.2] max-w-[9rem]">{{ czText(p.resultText) }}</span>
            </p>
          </div>
          <div class="px-3 lg:px-5 pt-12 pb-4 lg:pb-6">
            <p class="kicker text-quiet">{{ czText([p.client, p.year].filter(Boolean).join(' · ')) }}</p>
            <h3 class="mt-3 text-[1.45rem] lg:text-[1.65rem] leading-[1.18] font-bold">{{ czText(p.title) }}</h3>
            <p v-if="p.done" class="mt-3">{{ czText(p.done) }}</p>
          </div>
        </NuxtLink>
      </UCarousel>
      <p v-else class="mt-10">{{ words.noProjects }}</p>
      <p v-if="block.linkLabel && block.linkUrl" class="mt-8"><NuxtLink class="tlink" :to="siteHref(block.linkUrl)">{{ czText(block.linkLabel) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink></p>
    </div>
  </section>
</template>
