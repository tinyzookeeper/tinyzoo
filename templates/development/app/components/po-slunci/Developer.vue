<script setup lang="ts">
// Po slunci's developer: a photograph of a finished building, who builds, and the finished
// buildings as soft rounded rows with the year in a white chip.
import type { Reference } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'developer'>; first?: boolean; anchor?: string; references: Reference[] }>()
</script>

<template>
  <section :id="anchor" class="wrap sec scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
      <div :class="block.image ? 'lg:col-span-6 lg:order-2' : 'lg:col-span-12'">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2">{{ block.heading }}</component>
        <p v-if="block.text" class="lead mt-5">{{ tidyText(block.text) }}</p>
        <ul v-if="references.length" class="mt-8 flex flex-col gap-2.5">
          <li v-for="r in references" :key="r.id" class="flex items-center gap-4 rounded-2xl bg-soft pl-2.5 pr-5 py-2.5">
            <span class="serif text-[1.15rem] bg-paper rounded-xl px-3.5 py-1 num">{{ r.year }}</span><span class="font-medium">{{ r.name }}</span><span class="ml-auto text-quiet whitespace-nowrap">{{ r.size }}</span>
          </li>
        </ul>
        <p v-if="block.note" class="mt-5 text-[0.94rem] text-quiet">{{ tidyText(block.note) }}</p>
      </div>
      <figure v-if="block.image" class="lg:col-span-6 lg:order-1 relative aspect-[3/2] lg:aspect-[5/6]">
        <CmsImage :media="block.image" class="photo" sizes="(min-width: 1024px) 38rem, 100vw" /><figcaption v-if="block.imageCaption" class="pill-cap">{{ block.imageCaption }}</figcaption>
      </figure>
    </div>
  </section>
</template>
