<script setup lang="ts">
// Sál's kinds of classes: ruled rows, a photograph, the text with a link that filters the
// timetable, and a small table of who it is for, the level and the length.
import type { LessonKind } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'kinds'>; first?: boolean; anchor?: string; kinds: LessonKind[]; slots: Slot[] }>()
const { words } = await useStudio()
const tt = useTimetable(() => props.slots)
const countOf = (k: LessonKind) => props.slots.filter((s) => s.kindId === k.id).length
const show = (k: LessonKind) => { tt.showKind(k.id); showTimetable() }
</script>

<template>
  <section :id="anchor" class="wrap pb-20 md:pb-28">
    <div class="grid lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 lg:pt-10 text-[1.05rem]">{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-10 border-b border-line">
      <article v-for="k in kinds" :key="k.id" class="grid md:grid-cols-12 gap-x-8 gap-y-5 py-7 border-t border-line items-start">
        <div class="ph md:col-span-3 aspect-[4/3]"><CmsImage v-if="k.image" :media="k.image" sizes="(min-width: 768px) 22rem, 100vw" /></div>
        <div class="md:col-span-5">
          <h3 class="text-[2rem] leading-tight">{{ tidyText(k.name) }}</h3>
          <p class="mt-2">{{ tidyText(k.summary) }}</p>
          <button type="button" class="tlink mt-2 cursor-pointer" data-kind-link @click="show(k)">{{ words.lessonsInTimetable(countOf(k)) }} <UIcon name="i-lucide-arrow-up-right" class="size-[1em]" aria-hidden="true" /></button>
        </div>
        <dl class="md:col-span-4 grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-2 text-[0.95rem] leading-snug md:pt-2">
          <dt class="text-quiet">{{ words.forWhom }}</dt><dd class="text-ink">{{ k.audience }}</dd>
          <dt class="text-quiet">{{ words.level }}</dt><dd class="text-ink">{{ k.levelNote }}</dd>
          <dt class="text-quiet">{{ words.length }}</dt><dd class="text-ink">{{ k.duration }}</dd>
        </dl>
      </article>
    </div>
  </section>
</template>
