<script setup lang="ts">
// Negativ's price list: a table of numbered rows, the highlighted one filled with the accent.
import type { Pack } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'pricing'>; packs: Pack[]; first?: boolean }>()
const no = (i: number) => String(i + 1).padStart(2, '0')
const size = computed(() => byLength(props.block.heading, [
  [10, 'text-[19vw] md:text-[11vw] wide:text-[min(11vw,11rem)]'],
  [22, 'text-[14vw] md:text-[8vw] wide:text-[min(8vw,8rem)]'],
], 'text-[11vw] md:text-[6vw] wide:text-[min(6vw,6rem)]'))
</script>

<template>
  <section class="pt-14 md:pt-24">
    <div class="pad grid md:grid-cols-12 gap-x-10 gap-y-5 items-end mb-8 md:mb-12">
      <div class="md:col-span-7">
        <p v-if="block.eyebrow" class="m text-brand mb-4">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="d" :class="size"><KitMarked :text="block.heading" plain /></component>
      </div>
      <p v-if="block.text" class="md:col-span-5 text-dim max-w-[30rem] md:pb-3">{{ tidyText(block.text) }}</p>
    </div>

    <div class="border-t border-rule">
      <article
        v-for="(p, i) in packs" :key="p.id" class="price-row pad grid md:grid-cols-12 gap-x-10 gap-y-4 py-7 md:py-9"
        :class="p.highlighted ? 'is-top on-brand bg-brand text-brand-ink' : 'border-b border-rule'"
      >
        <span class="m md:col-span-1 md:pt-2" :class="p.highlighted ? '' : 'text-dim'">{{ no(i) }}</span>
        <div class="md:col-span-4">
          <p v-if="p.highlighted && p.highlightLabel" class="m mb-2 font-medium">{{ p.highlightLabel }}</p>
          <h3 class="d text-[2.7rem] md:text-[2.6rem] lg:text-[3.4rem]">{{ p.name }}</h3>
          <p v-if="p.description" class="mt-2" :class="p.highlighted ? '' : 'text-dim'">{{ tidyText(p.description) }}</p>
        </div>
        <ul class="md:col-span-4 m grid gap-y-1.5 content-start md:pt-2">
          <li v-for="line in p.includes" :key="line.id">{{ line.text }}</li>
        </ul>
        <div class="md:col-span-3 md:text-right">
          <p class="d text-[4rem] md:text-[3.1rem] lg:text-[4.6rem] whitespace-nowrap">{{ formatPrice(p.price) }} <span class="text-[0.5em]">Kč</span></p>
          <NuxtLink v-if="p.highlighted && block.buttonLabel && block.buttonUrl" class="btn btn-ink m !font-medium mt-4" :to="siteHref(block.buttonUrl)">{{ block.buttonLabel }}</NuxtLink>
        </div>
      </article>
      <div v-if="block.footnote" class="pad grid md:grid-cols-12 gap-x-10 gap-y-2 py-6 border-b border-rule">
        <span class="m text-dim md:col-span-1 md:pt-1">{{ no(packs.length) }}</span>
        <p class="md:col-span-8">{{ tidyText(block.footnote) }}</p>
        <NuxtLink v-if="block.footnoteLinkLabel && block.footnoteLinkUrl" class="lnk m md:col-span-3 md:justify-end" :to="siteHref(block.footnoteLinkUrl)">{{ block.footnoteLinkLabel.replace(/[.!]$/, '') }} <UIcon name="i-lucide-arrow-right" class="ml-2 size-3.5 shrink-0" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </section>
</template>
