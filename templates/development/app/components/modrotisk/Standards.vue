<script setup lang="ts">
// Modrotisk's standards: the heading beside a photograph in its print frame, then the standards
// as a numbered legend (S 1, S 2…) under ruled lines, three columns wide.
import type { Standard } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'standards'>; first?: boolean; index?: number; anchor?: string; standards: Standard[] }>()
const w = useSiteWords().value.modrotisk
const photo = computed(() => props.block.photos.find((p) => p.image) ?? null)
const caption = computed(() => captionPair(photo.value?.caption))
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-4">
    <p class="label sheet"><b>{{ sectionNo(index) }}</b> {{ block.eyebrow }}</p>
    <div class="mt-8 grid lg:grid-cols-12 gap-x-12 gap-y-9 items-end">
      <div :class="photo ? 'lg:col-span-5' : 'lg:col-span-12'">
        <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] lg:text-[3.6rem]">{{ block.heading }}</component>
        <p v-if="block.text" class="mt-6 text-quiet max-w-[30rem]">{{ tidyText(block.text) }}</p>
      </div>
      <figure v-if="photo" class="lg:col-span-7">
        <div class="frame aspect-[3/2] lg:aspect-[16/9]"><CmsImage :media="photo.image!" sizes="(min-width: 1024px) 46rem, 100vw" /></div>
        <figcaption v-if="caption[0]" class="cap"><span>{{ caption[0] }}</span><span>{{ caption[1] }}</span></figcaption>
      </figure>
    </div>
    <dl class="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12">
      <div v-for="(s, i) in standards" :key="s.id" class="chain-item">
        <dt class="flex items-baseline gap-3"><span class="label">{{ w.standard }} {{ i + 1 }}</span><span class="font-display text-[1.45rem]">{{ s.title }}</span></dt>
        <dd class="mt-2 text-quiet text-[0.98rem]">{{ tidyText(s.text) }}</dd>
      </div>
    </dl>
  </section>
</template>
