<script setup lang="ts">
// Modrotisk's opening: the name of the project set very large and thin beside the visualisation
// in its print frame, and the four key facts as one dimension chain.
import type { Flat } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; flats: Flat[] }>()
const { settings, name } = await useSite()
const words = useSiteWords()
// "Starý sad" is set on two lines, the first word above the rest; a long word is set smaller.
const lines = computed<[string, string]>(() => {
  const [head = '', ...rest] = name.value.split(/\s+/)
  return [head, rest.join(' ')]
})
// (a name of long words, "Kadeřnictví a holičství…", needs one more step down)
const longest = computed(() => Math.max(...name.value.split(/\s+/).map((w) => w.length)))
const size = computed(() => longest.value >= 10 ? 'text-[2.4rem] sm:text-[3.4rem] xl:text-[4.4rem]' : byLength(lines.value.reduce((a, b) => (a.length >= b.length ? a : b)), [
  [5, 'text-[5.2rem] sm:text-[7rem] xl:text-[9.6rem]'],
  [7, 'text-[4rem] sm:text-[5.2rem] xl:text-[7rem]'],
], 'text-[3rem] sm:text-[4rem] xl:text-[5rem]'))
const caption = computed(() => captionPair(props.block.imageCaption))
const facts = computed(() => keyFacts(props.block.facts, props.flats, settings.value, words.value, { range: ' – ', areaFromTo: true, monthNumbers: true, alwaysYear: true, millions: false }))
</script>

<template>
  <section :id="anchor" class="wrap pt-8 lg:pt-14">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-9 items-end">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 font-extralight! leading-[0.86]! tracking-[-0.045em]!" :class="size">{{ lines[0] }}<template v-if="lines[1]"><br>{{ lines[1] }}</template></component>
        <p v-if="block.text" class="mt-7 max-w-[30rem] text-[1.08rem] text-quiet">{{ tidyText(block.text) }}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-down" class="size-4" aria-hidden="true" /></NuxtLink>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="siteHref(block.secondaryUrl)" class="btn btn-line">{{ block.secondaryLabel }}</NuxtLink>
        </div>
      </div>
      <figure v-if="block.image" class="lg:col-span-7">
        <div class="frame aspect-[3/2]"><CmsImage :media="block.image" eager sizes="(min-width: 1024px) 46rem, 100vw" /></div>
        <figcaption v-if="caption[0]" class="mt-3 flex items-center gap-4">
          <span class="label whitespace-nowrap">{{ caption[0] }}</span>
          <template v-if="caption[1]"><span class="dim flex-1"><i /><i /></span><span class="label whitespace-nowrap">{{ caption[1] }}</span></template>
        </figcaption>
      </figure>
    </div>

    <dl v-if="facts.length" class="chain mt-12 lg:mt-16 grid grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-4 gap-y-8">
      <div v-for="(fact, i) in facts" :key="i">
        <dt class="label">{{ fact.label }}</dt>
        <dd class="mt-1 font-display font-light text-[1.6rem] sm:text-[2.5rem] lg:text-[3.1rem] leading-none tracking-tight" :class="fact.kind === 'layouts' ? '' : 'num'"><span :class="fact.kind === 'price' ? 'whitespace-nowrap' : ''">{{ fact.value }}</span></dd>
        <dd v-if="fact.note" class="mt-2 text-[0.94rem] text-quiet">{{ fact.note }}</dd>
      </div>
    </dl>
  </section>
</template>
