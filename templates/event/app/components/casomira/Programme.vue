<script setup lang="ts">
// Časomíra's programme: a list with the times lit in the dot-matrix face; the starts in the
// colour of the diodes. A photograph and its caption stand beside the heading.
import type { ProgramItem } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'programme'>; first?: boolean; anchor?: string; items: ProgramItem[] }>()
const { words } = await useEvent()
const photo = computed(() => props.block.photos.find((p) => p.image) ?? null)
</script>

<template>
  <section :id="anchor" class="border-t border-line py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-quiet max-w-[28rem]">{{ tidyText(block.text) }}</p>
        <figure v-if="photo?.image" class="mt-8">
          <CmsImage :media="photo.image" sizes="(min-width: 1024px) 30rem, 100vw" class="w-full aspect-[4/3] object-cover rounded-[6px]" />
          <figcaption v-if="photo.caption" class="mono text-quiet mt-3">{{ photo.caption }}</figcaption>
        </figure>
      </div>
      <ol class="lg:col-span-7 border-t border-line">
        <li v-for="item in items" :key="item.id" class="grid grid-cols-[5.75rem_1fr] sm:grid-cols-[8rem_1fr_auto] gap-x-4 items-baseline py-4 border-b border-line">
          <span class="led whitespace-nowrap text-[1.85rem] sm:text-[2.6rem]" :class="item.highlight === 'start' ? '' : '!text-text'">
            <template v-if="clockParts(item.time)">{{ clockParts(item.time)![0] }}<span class="c">:</span>{{ clockParts(item.time)![1] }}</template>
            <template v-else>{{ item.time }}</template>
          </span>
          <div>
            <h3 class="text-xl font-bold tracking-[-0.02em]">{{ item.title }}</h3>
            <p v-if="item.text" class="text-quiet text-[0.98rem]">{{ tidyText(item.text) }}</p>
          </div>
          <p v-if="item.highlight === 'start'" class="col-start-2 sm:col-start-3 mono text-led">{{ words.startWord }}</p>
          <p v-else-if="item.place" class="col-start-2 sm:col-start-3 mono text-quiet">{{ item.place }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>
