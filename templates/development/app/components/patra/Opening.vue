<script setup lang="ts">
// Patra's opening: the name of the project in a large serif beside a short text and two
// buttons, the visualisation with rounded corners, and the four key facts as a ruled column.
import type { Flat } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; flats: Flat[] }>()
const { settings, name } = await useSite()
const words = useSiteWords()
const size = computed(() => byLength(name.value, [
  [10, 'text-[4.4rem] sm:text-[6rem] xl:text-[7.6rem]'],
  [16, 'text-[3.2rem] sm:text-[4.4rem] xl:text-[5.6rem]'],
], 'text-[2.6rem] sm:text-[3.4rem] xl:text-[4.4rem]'))
const facts = computed(() => keyFacts(props.block.facts, props.flats, settings.value, words.value, { range: ' až ', areaFromTo: false, monthNumbers: false, alwaysYear: false, millions: false }))
</script>

<template>
  <section :id="anchor" class="wrap pt-10 lg:pt-16">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-6 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 leading-[0.92]!" :class="size">{{ name }}</component>
      </div>
      <div class="lg:col-span-5 lg:pb-3">
        <p v-if="block.text" class="text-[1.12rem] text-quiet max-w-[30rem]">{{ tidyText(block.text) }}</p>
        <div class="mt-6 flex flex-wrap gap-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-down" class="size-[1.0625rem]" aria-hidden="true" /></NuxtLink>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="siteHref(block.secondaryUrl)" class="btn btn-line">{{ block.secondaryLabel }}</NuxtLink>
        </div>
      </div>
    </div>

    <div class="mt-10 lg:mt-12 grid lg:grid-cols-12 gap-x-12 gap-y-6">
      <figure v-if="block.image" class="lg:col-span-8">
        <div class="aspect-[3/2] lg:aspect-[16/10]"><CmsImage :media="block.image" class="photo" eager sizes="(min-width: 1024px) 52rem, 100vw" /></div>
        <figcaption v-if="block.imageCaption" class="cap">{{ block.imageCaption }}</figcaption>
      </figure>
      <dl v-if="facts.length" class="grid grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-1 gap-x-6 lg:content-start" :class="block.image ? 'lg:col-span-4' : 'lg:col-span-12'">
        <div v-for="(fact, i) in facts" :key="i" class="py-5 lg:py-6 border-t border-line lg:first:border-t-0 lg:first:pt-0">
          <dt class="label">{{ fact.label }}</dt>
          <dd class="mt-1 serif text-[2.1rem] sm:text-[2.9rem]" :class="fact.kind === 'flats' ? 'num' : fact.kind === 'price' ? 'num whitespace-nowrap' : 'whitespace-nowrap'">{{ fact.value }}</dd>
          <dd v-if="fact.note" class="text-[0.92rem] text-quiet">{{ fact.note }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
