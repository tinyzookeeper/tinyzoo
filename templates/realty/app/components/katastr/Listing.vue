<script setup lang="ts">
// A property's own page in Katastr: the detail section of the home page, with every photograph
// and the property's name as the page's heading, then the way back to the offer.
import type { Listing } from '../../lib/cms-content'

const props = defineProps<{ entry: Listing }>()
const words = useSiteWords()
const w = words.value.katastr
// (no line above, no link to itself: the page is the detail)
const block = { id: 'listing', type: 'detail', eyebrow: '', caption: '', moreLabel: '', badge: '' } as BlockOf<'detail'>
</script>

<template>
  <article>
    <KatastrDetail :block="block" first page :listing="props.entry" />
    <div class="wrap py-8 md:py-10">
      <NuxtLink class="tlink" to="/nabidka"><UIcon name="i-lucide-arrow-left" class="ic" aria-hidden="true" /> {{ w.back }}</NuxtLink>
    </div>
  </article>
</template>
