<script setup lang="ts">
// Magazín's programme: a table across the page (time, title, note) under a strong rule, then
// the photographs captioned with their times.
import type { ProgramItem } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'programme'>; first?: boolean; anchor?: string; items: ProgramItem[] }>()
const { day } = await useWedding()
const photos = computed(() => programmePhotos(props.block, 'magazin'))
const eyebrow = computed(() => props.block.eyebrow || (day.value ? `${day.value.weekday} ${day.value.date}` : ''))
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-36 pb-24 lg:pb-36">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-5 items-end">
      <div class="lg:col-span-7">
        <p v-if="eyebrow" class="label text-brand">{{ eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-4 lg:col-start-9 lg:pb-2 max-w-[30rem]">{{ tidyText(block.text) }}</p>
    </div>

    <ol v-if="items.length" class="mt-10 lg:mt-14 border-t border-ink">
      <li v-for="item in items" :key="item.id" class="grid grid-cols-[4.6rem_minmax(0,1fr)] lg:grid-cols-12 gap-x-4 lg:gap-x-10 items-baseline py-5 lg:py-6 border-b border-line">
        <p class="lg:col-span-2 serif text-ink text-[1.75rem] lg:text-[2.4rem] leading-none"><time :datetime="timeAttr(item.time) || undefined">{{ item.time }}</time></p>
        <h3 class="lg:col-span-4 text-[1.45rem] lg:text-[1.7rem] leading-[1.15]">{{ tidyText(item.title) }}</h3>
        <p v-if="item.text" class="col-start-2 lg:col-start-auto lg:col-span-6 max-lg:mt-1.5 text-[1rem] leading-[1.65]">{{ tidyText(item.text) }}</p>
      </li>
    </ol>

    <div v-if="photos.length" class="grid sm:grid-cols-12 gap-x-5 lg:gap-x-10 gap-y-9 items-end mt-16 lg:mt-24">
      <figure v-for="(p, i) in photos" :key="p.id" :class="photos.length === 1 ? 'sm:col-span-12' : i % 2 ? 'sm:col-span-7' : 'sm:col-span-5'">
        <div class="zoom" :class="photos.length === 1 ? 'aspect-[3/2] lg:aspect-[2/1]' : i % 2 ? 'aspect-[3/2]' : 'aspect-[4/5]'"><CmsImage :media="p.image" sizes="(min-width: 640px) 50vw, 100vw" /></div>
        <figcaption v-if="p.label || p.caption" class="cap"><b v-if="p.label">{{ p.label }}</b>{{ tidyText(p.caption) }}</figcaption>
      </figure>
    </div>
  </section>
</template>
