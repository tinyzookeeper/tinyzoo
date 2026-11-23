<script setup lang="ts">
// Mistr's price list: the price list in ruled groups on the right, the heading and a box of
// what the price always includes (staying in view while the list scrolls) on the left.
import type { Service } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; items: Service[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="wrap py-20 md:py-28 scroll-mt-20">
    <div class="grid lg:grid-cols-12 gap-10 lg:gap-14">
      <div class="lg:col-span-4">
        <div class="lg:sticky lg:top-28">
          <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
          <p v-if="block.text" class="serif mt-5">{{ tidyText(block.text) }}</p>
          <div v-if="block.included.length" class="mt-8 p-6 bg-tint rounded-[4px]">
            <h3 v-if="block.includedTitle" class="text-[1.0625rem] font-bold tracking-[-0.01em]">{{ block.includedTitle }}</h3>
            <ul class="mt-3 grid gap-2.5 text-[0.9375rem]">
              <li v-for="line in block.included" :key="line.id" class="flex gap-2.5"><UIcon name="i-lucide-check" class="size-[18px] text-brand mt-[3px] shrink-0" aria-hidden="true" /> {{ tidyText(line.text) }}</li>
            </ul>
          </div>
          <p v-if="block.note" class="mt-5 text-[0.9375rem] text-quiet">{{ tidyText(block.note) }}</p>
        </div>
      </div>

      <div class="lg:col-span-8">
        <template v-for="(group, gi) in serviceGroups(items)" :key="group.title">
          <h3 v-if="group.title" class="label !text-brand pb-3" :class="gi ? 'mt-12' : ''">{{ group.title }}</h3>
          <ul :class="!group.title && gi ? 'mt-12' : ''">
            <li v-for="(s, i) in group.items" :key="s.id" class="price-row" :class="i === group.items.length - 1 ? 'border-b border-line' : ''" :data-service="s.id">
              <div><h4>{{ s.name }}</h4><p v-if="s.text">{{ tidyText(s.text) }}</p></div>
              <span class="price"><small v-if="s.from">{{ words.from }}</small> {{ priceParts(s, words).amount }}&nbsp;Kč <small v-if="s.unit">/ {{ s.unit }}</small></span>
            </li>
          </ul>
        </template>

        <p v-if="block.linkLabel && block.linkUrl" class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-1">
          <NuxtLink :to="siteHref(block.linkUrl)" class="tlink">{{ block.linkLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink>
          <span v-if="block.linkNote" class="text-[0.9375rem] text-quiet">{{ tidyText(block.linkNote) }}</span>
        </p>
      </div>
    </div>
  </section>
</template>
