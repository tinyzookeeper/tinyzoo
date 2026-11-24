<script setup lang="ts">
// Tabule's kinds of classes: a big typographic list, numbered, ruled in black; on a desktop a
// row turns to the colour of the site under the pointer.
import type { LessonKind } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'kinds'>; first?: boolean; anchor?: string; kinds: LessonKind[]; slots: Slot[] }>()
const { words } = await useStudio()
const tt = useTimetable(() => props.slots)
const countOf = (k: LessonKind) => props.slots.filter((s) => s.kindId === k.id).length
const show = (k: LessonKind) => { tt.showKind(k.id); showTimetable() }
const size = (name: string) => byLength(name, [[18, 'text-[1.9rem] lg:text-[3.1rem]'], [30, 'text-[1.7rem] lg:text-[2.4rem]']], 'text-[1.5rem] lg:text-[1.9rem]')
</script>

<template>
  <section :id="anchor" class="on-light wrap py-16 lg:py-24">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="max-w-[26rem] lg:pb-3">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 border-b-2 border-ink">
      <article v-for="(k, i) in kinds" :key="k.id" class="krow grid lg:grid-cols-12 gap-x-8 gap-y-3 lg:gap-y-4 py-6 lg:py-7 lg:px-5 lg:-mx-5 border-t-2 border-ink items-start">
        <p class="mono lg:col-span-1 lg:pt-3 order-1">{{ String(i + 1).padStart(2, '0') }}</p>
        <h3 class="display lg:col-span-5 leading-[0.98] order-2" :class="size(k.name)">{{ tidyText(k.name) }}</h3>
        <div class="lg:col-span-4 order-4 lg:order-3">
          <p class="text-[1.1rem]">{{ tidyText(k.summary) }}</p>
          <dl class="mono mt-4 grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1">
            <dt class="krow-muted">{{ words.forWhom }}</dt><dd>{{ k.audience }}</dd>
            <dt class="krow-muted">{{ words.level }}</dt><dd>{{ k.levelNote }}</dd>
            <dt class="krow-muted">{{ words.length }}</dt><dd>{{ k.duration }}</dd>
          </dl>
          <button type="button" class="ulink mono mt-3 cursor-pointer" data-kind-link @click="show(k)">{{ words.lessonsInTimetable(countOf(k)) }} <UIcon name="i-lucide-arrow-up-right" class="size-[1em]" aria-hidden="true" /></button>
        </div>
        <div class="ph mt-1 lg:mt-0 lg:col-span-2 aspect-[16/9] lg:aspect-[4/3] order-3 lg:order-4"><CmsImage v-if="k.image" :media="k.image" sizes="(min-width: 1024px) 18rem, 100vw" /></div>
      </article>
    </div>
  </section>
</template>
