<script setup lang="ts">
// Reflex's about: the owner's photograph filling the left of the section (a tall band on a
// phone), the text and the licences as heavy ruled lines on the right, and the team's
// photographs as a pair edge to edge under it.
import type { CmsMedia } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string; owner: CmsMedia | null }>()
</script>

<template>
  <section :id="anchor" class="grid lg:grid-cols-12 scroll-mt-0">
    <figure v-if="owner" class="lg:col-span-5 ph aspect-[4/5] sm:aspect-[3/2] lg:aspect-auto lg:min-h-[46rem]"><CmsImage :media="owner" sizes="(min-width: 1024px) 42vw, 100vw" class="lg:absolute lg:inset-0" /></figure>
    <div class="wrap lg:!px-14 py-14 md:py-20 lg:py-24" :class="owner ? 'lg:col-span-7' : 'lg:col-span-12'">
      <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-3 lg:!text-[6.4vw]"><KitMarked :text="block.heading" plain /></component>
      <div class="mt-8 max-w-[38rem] grid gap-4 text-[1.1875rem] leading-[1.45] font-medium">
        <p v-for="(p, i) in paragraphs(block.text)" :key="i">{{ tidyText(p) }}</p>
      </div>
      <template v-if="block.licences.length">
        <h3 v-if="block.licencesTitle" class="label mt-12">{{ block.licencesTitle }}</h3>
        <ul class="mt-3 border-t-2 border-ink text-[1.125rem] font-bold leading-[1.3]">
          <li v-for="l in block.licences" :key="l.id" class="py-3.5 border-b-2 border-ink">{{ tidyText(l.text) }}</li>
        </ul>
      </template>
    </div>
  </section>
  <div v-if="block.photos.some((p) => p.image)" class="grid gap-1 mt-1" :class="block.photos.filter((p) => p.image).length > 1 ? 'grid-cols-2' : ''">
    <figure v-for="p in block.photos.filter((p) => p.image)" :key="p.id" class="ph aspect-[4/3] md:aspect-[2/1]"><CmsImage :media="p.image!" sizes="(min-width: 768px) 50vw, 50vw" /></figure>
  </div>
</template>
