<script setup lang="ts">
// Čekárna's notices: the important one on a soft amber panel, the others as plain text beside
// it. Only what is valid today (the block hands in those); without any, nothing is drawn.
import type { Notice } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'notices'>; first?: boolean; anchor?: string; notices: Notice[] }>()
const words = useSiteWords()
const split = computed(() => splitNotices(props.notices))
const mark = { class: 'num whitespace-nowrap font-semibold' }
</script>

<template>
  <section v-if="notices.length" :id="anchor" class="wrap pt-20 lg:pt-28">
    <component :is="first ? 'h1' : 'h2'" class="text-[1.9rem] lg:text-[2.2rem]"><KitMarked :text="block.heading" plain /></component>
    <div class="mt-7 grid gap-10 lg:gap-16 items-start" :class="split.main ? 'lg:grid-cols-[1.2fr_1fr]' : ''">
      <article v-if="split.main" data-notice class="rounded-[24px] lg:rounded-[28px] bg-note-tint p-7 sm:p-9 lg:p-11">
        <p class="flex items-center gap-2.5 font-semibold text-note"><span class="size-2.5 rounded-full bg-note" />{{ words.important }}</p>
        <h3 class="mt-4 text-[1.9rem] lg:text-[2.3rem]">{{ tidyText(split.main.title) }}</h3>
        <p class="mt-4 text-ink max-w-[34rem]"><KitMarked :text="noticeParts(split.main.text).first" as="span" :attrs="mark" /></p>
        <p v-for="(more, i) in noticeParts(split.main.text).more" :key="i" class="mt-3 text-ink max-w-[34rem] font-semibold"><KitMarked :text="more" as="span" :attrs="mark" /></p>
      </article>
      <div class="grid gap-9" :class="split.main ? 'lg:pt-3' : 'md:grid-cols-2 gap-x-16'">
        <article v-for="n in split.rest" :key="n.id" data-notice>
          <p v-if="n.dateLine" class="text-[.95rem] text-quiet num">{{ n.dateLine }}</p>
          <h3 class="text-[1.4rem]" :class="n.dateLine ? 'mt-1.5' : ''">{{ tidyText(n.title) }}</h3>
          <p class="mt-2.5"><KitMarked :text="n.text" as="span" :attrs="mark" /></p>
        </article>
      </div>
    </div>
  </section>
</template>
