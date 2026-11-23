<script setup lang="ts">
// Šanony's articles: heavy ruled rows, each a date, a title in heavy type and two sentences, with
// an arrow on ink that turns to the brand colour when the row is pointed at.
import type { Article } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'articles'>; first?: boolean; anchor?: string; items: Article[] }>()
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-28">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <component :is="first ? 'h1' : 'h2'" class="display" :class="displaySize(block.heading)"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
      <SiteLink v-if="block.allLabel && block.allUrl" :to="block.allUrl" class="navlink border-ink text-[16px]">{{ block.allLabel }}</SiteLink>
    </div>
    <div v-if="items.length" class="mt-10 border-t-4 border-ink lg:mt-14">
      <NuxtLink v-for="(a, i) in items" :key="a.id" :to="`/clanek/${a.slug}`" class="group grid gap-x-8 gap-y-2 py-7 transition-colors hover:bg-white lg:grid-cols-[170px_1fr_56px] lg:px-4" :class="i === items.length - 1 ? 'border-b-4 border-ink' : 'border-b-2 border-ink'" data-article>
        <time v-if="a.date" :datetime="dateParts(a.date)?.iso" class="font-display text-[19px] font-bold lg:pt-1.5">{{ numericDate(a.date) }}</time><span v-else />
        <div>
          <h3 class="font-display text-[27px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[34px]">{{ tidyText(a.title) }}</h3>
          <p v-if="a.summary" class="mt-3 max-w-[70ch] text-[16px] leading-[1.55]">{{ tidyText(a.summary) }}</p>
        </div>
        <span class="hidden h-12 w-12 items-center justify-center self-center rounded-[3px] bg-ink text-paper transition-colors group-hover:bg-brand lg:flex" aria-hidden="true"><UIcon name="i-lucide-arrow-right" class="size-[22px]" /></span>
      </NuxtLink>
    </div>
  </section>
</template>
