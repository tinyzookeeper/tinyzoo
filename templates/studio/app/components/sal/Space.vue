<script setup lang="ts">
// Sál's space: one wide photograph across the page, then the text and the facts on the left
// beside two smaller photographs with captions.
defineProps<{ block: BlockOf<'space'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor">
    <div v-if="spacePhotos(block)[0]" class="wrap">
      <figure class="ph aspect-[4/3] sm:aspect-[16/7] !rounded-[2rem]">
        <CmsImage :media="spacePhotos(block)[0]!.image" sizes="(min-width: 1280px) 75rem, 100vw" />
      </figure>
    </div>
    <div class="wrap pt-12 md:pt-16">
      <div class="grid lg:grid-cols-12 gap-x-12 gap-y-8">
        <div class="lg:col-span-5">
          <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" /></component>
          <p v-for="(p, i) in paragraphs(block.text)" :key="i" class="mt-5">{{ tidyText(p) }}</p>
          <dl v-if="block.facts.length" class="mt-7 grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-4 pt-6 border-t border-line text-[0.95rem] leading-snug">
            <div v-for="fact in block.facts" :key="fact.id"><dt class="text-quiet">{{ fact.label }}</dt><dd class="mt-1 font-display text-[1.7rem] text-ink">{{ fact.value }}</dd></div>
          </dl>
        </div>
        <div v-if="spacePhotos(block).length > 1" class="lg:col-span-7 grid grid-cols-5 gap-4 md:gap-5">
          <figure class="col-span-3">
            <div class="ph aspect-[4/3]"><CmsImage :media="spacePhotos(block)[1]!.image" sizes="(min-width: 1024px) 30rem, 60vw" /></div>
            <figcaption v-if="spacePhotos(block)[1]!.caption" class="mt-2 text-[0.875rem] text-quiet">{{ spacePhotos(block)[1]!.caption }}</figcaption>
          </figure>
          <figure v-if="spacePhotos(block)[2]" class="col-span-2">
            <div class="ph aspect-[8/9] h-auto"><CmsImage :media="spacePhotos(block)[2]!.image" sizes="(min-width: 1024px) 20rem, 40vw" /></div>
            <figcaption v-if="spacePhotos(block)[2]!.caption" class="mt-2 text-[0.875rem] text-quiet">{{ spacePhotos(block)[2]!.caption }}</figcaption>
          </figure>
        </div>
      </div>
    </div>
  </section>
</template>
