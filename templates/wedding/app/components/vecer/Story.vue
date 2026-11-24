<script setup lang="ts">
// Večer's story: each part a large photograph beside its text under a Roman numeral, sides in turns.
defineProps<{ block: BlockOf<'story'>; first?: boolean; anchor?: string }>()
const ROMAN = ['I.', 'II.', 'III.', 'IV.', 'V.']
</script>

<template>
  <section :id="anchor" class="wrap pb-24 lg:pb-36">
    <div class="text-center max-w-[46rem] mx-auto">
      <span class="stem" aria-hidden="true" />
      <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
    </div>

    <div v-for="(p, i) in block.parts" :key="p.id" class="grid lg:grid-cols-12 gap-x-12 gap-y-8 items-center" :class="i ? 'mt-16 lg:mt-24' : 'mt-14 lg:mt-20'">
      <figure v-if="p.image && i % 2 === 0" class="lg:col-span-7 zoom aspect-[3/2]"><CmsImage :media="p.image" sizes="(min-width: 1024px) 42rem, 100vw" /></figure>
      <div :class="i % 2 ? 'lg:col-span-4 lg:col-start-2 max-lg:order-2' : 'lg:col-span-4 lg:col-start-9'">
        <p class="numeral" aria-hidden="true">{{ ROMAN[i] }}</p>
        <p class="label text-quiet mt-5">{{ p.label }}</p>
        <p v-if="p.text" class="mt-4">{{ tidyText(p.text) }}</p>
        <p v-if="block.closing && i === block.parts.length - 1" class="italic text-ink text-[1.35rem] leading-snug mt-6">{{ tidyText(block.closing) }}</p>
      </div>
      <figure v-if="p.image && i % 2 === 1" class="lg:col-span-6 lg:col-start-7 zoom aspect-[3/2]"><CmsImage :media="p.image" sizes="(min-width: 1024px) 36rem, 100vw" /></figure>
    </div>
  </section>
</template>
