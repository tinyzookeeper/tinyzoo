<script setup lang="ts">
// Návod's features: each one a "situation", ruled off, with its text and numbered points on the
// left and a numbered figure of the screen it is about on the right.
import type { Feature } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'features'>; first?: boolean; anchor?: string; items: Feature[] }>()
const words = useSiteWords()
const [sections, figuresBefore] = await Promise.all([usePageSections(), useFiguresBefore()])
const number = computed(() => sectionNumber(sections.value, 'features'))
</script>

<template>
  <section :id="anchor" class="border-t border-ink/15 bg-sheet">
    <div class="wrap py-16 lg:py-24">
      <div class="grid gap-6 lg:grid-cols-12 lg:gap-12">
        <div class="lg:col-span-5">
          <p v-if="block.eyebrow" class="label text-quiet"><span class="text-brand">{{ number }}</span> · {{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink lg:text-[42px]"><KitMarked :text="block.heading" /></component>
        </div>
        <p v-if="block.text" class="max-w-[36rem] lg:col-span-7 lg:pt-2">{{ tidyText(block.text) }}</p>
      </div>

      <article v-for="(f, i) in items" :key="f.id" class="mt-14 grid gap-8 border-t border-ink pt-8 lg:mt-20 lg:grid-cols-12 lg:gap-12 lg:pt-10">
        <div class="lg:col-span-5">
          <p class="label text-quiet"><span class="text-brand">{{ words.situation }} {{ i + 1 }}</span><template v-if="f.when"> · {{ f.when }}</template></p>
          <h3 class="mt-4 text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink lg:text-[30px]">{{ tidyText(f.title) }}</h3>
          <p v-if="f.text" class="mt-4">{{ tidyText(f.text) }}</p>
          <ol v-if="f.points.length" class="mt-6 space-y-2.5 text-[15px] leading-snug text-ink">
            <li v-for="(p, n) in f.points" :key="n" class="flex gap-3"><span class="co">{{ n + 1 }}</span><span class="pt-px">{{ tidyText(p.text) }}</span></li>
          </ol>
        </div>
        <figure v-if="f.image || f.screen !== 'none'" class="lg:col-span-7">
          <NavodScreen :kind="f.screen" :image="f.image" />
          <figcaption v-if="f.caption" class="mt-3 font-mono text-[12px] text-quiet"><span class="text-ink">{{ words.figure }} {{ figuresBefore + i + 1 }}</span> &nbsp;{{ tidyText(f.caption) }}</figcaption>
        </figure>
      </article>
    </div>
  </section>
</template>
