<script setup lang="ts">
// Mistr's about: a photograph of the team with a caption, the text and the licences as ruled lines.
import type { CmsMedia } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string; owner: CmsMedia | null }>()
</script>

<template>
  <section :id="anchor" class="wrap pb-20 md:pb-28 scroll-mt-28" :class="first ? 'pt-10 md:pt-16' : ''">
    <div class="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
      <figure v-if="block.photos[0]?.image" class="lg:col-span-7">
        <div class="ph aspect-[4/3] md:aspect-[3/2]"><CmsImage :media="block.photos[0].image" sizes="(min-width: 1024px) 46rem, 100vw" /></div>
        <figcaption v-if="block.photos[0].caption" class="cap">{{ tidyText(block.photos[0].caption) }}</figcaption>
      </figure>
      <div :class="block.photos[0]?.image ? 'lg:col-span-5' : 'lg:col-span-8'">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p v-for="(p, i) in paragraphs(block.text)" :key="i" class="serif" :class="i ? 'mt-4' : 'mt-5'">{{ tidyText(p) }}</p>

        <template v-if="block.licences.length">
          <h3 v-if="block.licencesTitle" class="mt-9 text-[1.0625rem] font-bold tracking-[-0.01em]">{{ block.licencesTitle }}</h3>
          <ul class="mt-3 text-[0.9375rem] border-t border-line">
            <li v-for="l in block.licences" :key="l.id" class="py-3 border-b border-line">{{ tidyText(l.text) }}</li>
          </ul>
        </template>
      </div>
    </div>
  </section>
</template>
