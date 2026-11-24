<script setup lang="ts">
// Vizitka's projects: on a tinted band, the first project large (photograph, story and the
// result in a figure), the rest in a row of three, each ending in its own result.
import type { Project } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'projects'>; first?: boolean; anchor?: string; items: Project[] }>()
const words = useSiteWords()
const client = (p: Project) => czText([p.client, p.year].filter(Boolean).join(' · '))
</script>

<template>
  <section :id="anchor" class="bg-tint">
    <div class="wrap py-20 lg:py-28">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-5 items-end">
        <div class="lg:col-span-6">
          <p v-if="block.eyebrow" class="label text-brand">{{ czText(block.eyebrow) }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.1rem] md:text-[2.75rem] leading-[1.12]"><KitMarked :text="block.heading" /></component>
        </div>
        <p v-if="block.text" class="lg:col-span-5 lg:col-start-8 max-w-[34rem]">{{ czText(block.text) }}</p>
      </div>

      <!-- The first project is shown large -->
      <NuxtLink v-if="items[0]" :to="projectHref(items[0].slug)" class="group mt-12 lg:mt-16 grid lg:grid-cols-12 bg-paper" data-project>
        <div class="ph lg:col-span-7 aspect-[3/2] lg:aspect-auto lg:min-h-[480px]"><CmsImage v-if="items[0].image" :media="items[0].image" sizes="(min-width: 1024px) 50rem, 100vw" /></div>
        <div class="lg:col-span-5 p-6 md:p-10 lg:p-12 flex flex-col">
          <p class="label text-quiet">{{ client(items[0]) }}</p>
          <h3 class="mt-4 text-[1.75rem] lg:text-[2.1rem] leading-[1.15] group-hover:text-brand transition-colors">{{ czText(items[0].title) }}</h3>
          <p v-if="items[0].done" class="mt-4">{{ czText(items[0].done) }}</p>
          <div v-if="items[0].result" class="mt-8 lg:mt-auto pt-6 border-t border-line flex items-center gap-6">
            <p class="serif text-brand text-[2.6rem] lg:text-[3rem] font-medium leading-none whitespace-nowrap flex items-center gap-2">
              <template v-for="(part, i) in resultParts(items[0].result)" :key="i"><UIcon v-if="i" name="i-lucide-arrow-right" class="text-[0.6em]" :aria-label="words.arrowTo" />{{ czText(part) }}</template>
            </p>
            <p v-if="items[0].resultText" class="text-[0.95rem] leading-[1.45] text-ink">{{ czText(items[0].resultText) }}</p>
          </div>
        </div>
      </NuxtLink>

      <div v-if="items.length > 1" class="mt-10 lg:mt-12 grid md:grid-cols-3 gap-x-8 gap-y-12">
        <NuxtLink v-for="p in items.slice(1)" :key="p.id" :to="projectHref(p.slug)" class="group flex flex-col" data-project>
          <div class="ph aspect-[3/2]"><CmsImage v-if="p.image" :media="p.image" sizes="(min-width: 1280px) 26rem, (min-width: 768px) 33vw, 100vw" /></div>
          <p class="label text-quiet mt-5">{{ client(p) }}</p>
          <h3 class="mt-3 text-[1.4rem] leading-[1.2] group-hover:text-brand transition-colors">{{ czText(p.title) }}</h3>
          <p v-if="p.done" class="mt-3 text-[1rem]">{{ czText(p.done) }}</p>
          <div v-if="p.result" class="mt-5 md:mt-auto pt-5 border-t border-line flex items-center gap-5">
            <p class="serif text-brand text-[1.9rem] font-medium leading-none whitespace-nowrap flex items-center gap-1.5">
              <template v-for="(part, i) in resultParts(p.result)" :key="i"><UIcon v-if="i" name="i-lucide-arrow-right" class="text-[0.6em]" :aria-label="words.arrowTo" />{{ czText(part) }}</template>
            </p>
            <p v-if="p.resultText" class="text-[0.9rem] leading-[1.4] text-ink">{{ czText(p.resultText) }}</p>
          </div>
        </NuxtLink>
      </div>
      <p v-if="!items.length" class="mt-12">{{ words.noProjects }}</p>

      <p v-if="block.linkLabel && block.linkUrl" class="mt-12"><NuxtLink class="tlink" :to="siteHref(block.linkUrl)">{{ czText(block.linkLabel) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink></p>
    </div>
  </section>
</template>
