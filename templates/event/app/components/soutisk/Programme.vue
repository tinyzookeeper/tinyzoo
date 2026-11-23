<script setup lang="ts">
// Soutisk's programme: rows with time pills (the starts in vermilion, the ceremonies in
// yellow) beside a photograph whose top edge is cut as a line of hills, with a printed sun at its corner.
import type { ProgramItem } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'programme'>; first?: boolean; anchor?: string; items: ProgramItem[] }>()
const photo = computed(() => [...props.block.photos].reverse().find((p) => p.image) ?? null)
</script>

<template>
  <section :id="anchor" class="relative bg-paper pt-6 sm:pt-10 pb-16 sm:pb-24" :class="first ? 'mt-14 sm:mt-28' : ''">
    <svg class="hills text-paper" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><use href="#soutisk-hl1" fill="currentColor" /></svg>
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-lg text-quiet max-w-[28rem]">{{ tidyText(block.text) }}</p>
        <div v-if="photo?.image" class="relative mt-8 max-w-[30rem]">
          <span class="ink-m absolute -left-5 -bottom-6 w-36 h-36 rounded-full bg-c2 z-10" aria-hidden="true" />
          <CmsImage :media="photo.image" sizes="(min-width: 1024px) 30rem, 100vw" class="hillclip w-full aspect-[4/5] object-cover rounded-b-[28px]" />
        </div>
      </div>
      <ol class="lg:col-span-7 lg:pt-4">
        <li v-for="(item, i) in items" :key="item.id" class="grid grid-cols-[5.75rem_1fr] gap-x-4 sm:gap-x-6 py-4" :class="i < items.length - 1 ? 'border-b-2 border-ink/15' : ''">
          <span class="pill" :class="item.highlight === 'start' ? '!bg-c1' : item.highlight === 'ceremony' ? '!bg-c2' : ''">{{ item.time }}</span>
          <div v-if="item.highlight === 'start'" class="self-center">
            <h3 class="disp text-[1.15rem] sm:text-2xl leading-[1.15]">{{ item.title }}</h3>
            <p v-if="item.place || item.text" class="text-quiet"><span v-if="item.place" class="font-medium text-ink">{{ ucfirst(item.place) }}.</span> {{ tidyText(item.text) }}</p>
          </div>
          <div v-else>
            <h3 class="font-bold text-xl leading-snug">{{ item.title }}</h3>
            <p v-if="item.place || item.text" class="text-quiet"><span v-if="item.place" class="font-medium text-ink">{{ ucfirst(item.place) }}.</span> {{ tidyText(item.text) }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
