<script setup lang="ts">
// Oznámení's programme: a ruled list with large serif times beside a matted photograph of the place.
import type { ProgramItem } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'programme'>; first?: boolean; anchor?: string; items: ProgramItem[] }>()
const { day } = await useWedding()
const photo = computed(() => programmePhotos(props.block, 'oznameni')[0] ?? null)
// The line above the heading: the block's own, else the day itself ("Sobota 19. června 2027").
const eyebrow = computed(() => props.block.eyebrow || (day.value ? `${day.value.weekday} ${day.value.date}` : ''))
</script>

<template>
  <section :id="anchor" class="bg-card border-y border-line">
    <div class="wrap py-20 lg:py-28 grid lg:grid-cols-12 gap-x-12 gap-y-12 items-start">
      <figure v-if="photo" class="lg:col-span-4 lg:sticky lg:top-10 max-w-[24rem] w-full mx-auto lg:mx-0 order-2 lg:order-1">
        <div class="frame aspect-[4/5] !bg-paper"><CmsImage :media="photo.image" sizes="(min-width: 1024px) 24rem, 90vw" /></div>
        <figcaption v-if="photo.caption" class="mt-4 italic text-center">{{ tidyText(photo.caption) }}</figcaption>
      </figure>

      <div class="order-1 lg:order-2" :class="photo ? 'lg:col-span-7 lg:col-start-6' : 'lg:col-span-8 lg:col-start-3'">
        <p v-if="eyebrow" class="label text-brand">{{ eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.6rem] lg:text-[3.4rem] leading-[1.08] mt-4"><KitMarked :text="block.heading" :attrs="{ class: 'font-serif italic text-[0.9em]' }" /></component>
        <p v-if="block.text" class="mt-4 max-w-[34rem]">{{ tidyText(block.text) }}</p>

        <ol v-if="items.length" class="mt-10 border-b border-line">
          <li v-for="item in items" :key="item.id" class="grid grid-cols-[4.4rem_1fr] sm:grid-cols-[6.5rem_1fr] gap-x-4 sm:gap-x-6 py-5 border-t border-line">
            <p class="font-display text-brand text-[1.75rem] sm:text-[2.1rem] leading-none pt-1"><time :datetime="timeAttr(item.time) || undefined">{{ item.time }}</time></p>
            <div>
              <h3 class="text-[1.45rem] leading-tight">{{ tidyText(item.title) }}</h3>
              <p v-if="item.text" class="mt-1.5 text-[0.95rem] leading-[1.7]">{{ tidyText(item.text) }}</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
