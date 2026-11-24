<script setup lang="ts">
// Večer's programme: two columns of ruled rows with large champagne times on a panel, then a
// photograph across the whole page.
import type { ProgramItem } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'programme'>; first?: boolean; anchor?: string; items: ProgramItem[] }>()
const { day } = await useWedding()
const photo = computed(() => programmePhotos(props.block, 'vecer')[0] ?? null)
const eyebrow = computed(() => props.block.eyebrow || (day.value ? `${day.value.weekday} ${day.value.date}` : ''))
</script>

<template>
  <div :id="anchor">
    <section class="bg-panel">
      <div class="wrap pt-20 lg:pt-32 pb-20 lg:pb-28">
        <div class="text-center max-w-[40rem] mx-auto">
          <span class="stem" aria-hidden="true" />
          <p v-if="eyebrow" class="label text-brand">{{ eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
          <p v-if="block.text" class="mt-5">{{ tidyText(block.text) }}</p>
        </div>

        <ol v-if="items.length" class="lg:columns-2 lg:gap-x-20 mt-12 lg:mt-16">
          <li v-for="item in items" :key="item.id" class="break-inside-avoid grid grid-cols-[4.8rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 sm:gap-x-6 py-6 border-t border-line">
            <p class="font-light text-brand text-[1.8rem] sm:text-[2.25rem] leading-none"><time :datetime="timeAttr(item.time) || undefined">{{ item.time }}</time></p>
            <div>
              <h3 class="text-[1.5rem] leading-tight">{{ tidyText(item.title) }}</h3>
              <p v-if="item.text" class="mt-1.5 text-[1.0625rem] leading-[1.55]">{{ tidyText(item.text) }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <figure v-if="photo">
      <div class="aspect-[4/3] sm:aspect-[2/1] lg:aspect-[21/9] w-full overflow-hidden"><CmsImage :media="photo.image" sizes="(min-width: 640px) 100vw, 130vw" class="w-full h-full object-cover" /></div>
      <figcaption v-if="photo.caption" class="wrap italic text-center text-[1.0625rem] pt-5">{{ tidyText(photo.caption) }}</figcaption>
    </figure>
  </div>
</template>
