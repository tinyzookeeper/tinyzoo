<script setup lang="ts">
// Zrcadlo's results: one large photograph and four small ones on a grid; a row to swipe on a
// phone (the carousel switches itself off from `md` on, where the grid takes over).
import type { Result } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'results'>; first?: boolean; anchor?: string; items: Result[] }>()
const { settings, words } = await useSalon()
// The first one spans two columns and two rows on the grid.
const cards = computed(() => props.items.map((r, i) => ({ ...r, class: i === 0 ? 'md:col-span-2 md:row-span-2' : '' })))
</script>

<template>
  <section :id="anchor" class="bg-surface scroll-mt-4">
    <div class="wrap pb-20 md:pb-28">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[38px] md:text-[48px] leading-[1.08]">{{ tidyText(block.heading) }}</component>
        </div>
        <a v-if="settings?.instagram" :href="settings.instagram" target="_blank" rel="noopener" class="inline-flex items-center gap-2 min-h-11 font-semibold text-brand hover:text-ink"><UIcon name="i-lucide-instagram" aria-hidden="true" />{{ words.moreOnInstagram }}</a>
      </div>
      <UCarousel
        v-slot="{ item, index }" :items="cards" align="start" contain-scroll="trimSnaps" drag-free :breakpoints="{ '(min-width: 768px)': { active: false } }"
        class="mt-10"
        :ui="{ viewport: '-mx-5 px-5 md:mx-0 md:px-0 md:overflow-visible', container: '-ms-4 md:ms-0 md:grid md:grid-cols-4 md:gap-6 md:items-stretch', item: 'basis-[calc(72%+4.5px)] ps-4 md:ps-0 md:basis-auto md:flex md:flex-col' }"
      >
        <figure class="contents">
          <div class="rounded-[28px] overflow-hidden aspect-[4/5] relative" :class="index === 0 ? 'md:aspect-auto md:flex-1 md:min-h-0' : 'md:aspect-square'">
            <CmsImage v-if="item.photo" :media="item.photo" sizes="(min-width: 1024px) 620px, (min-width: 768px) 50vw, 75vw" class="w-full h-full object-cover" :class="index === 0 ? 'md:absolute md:inset-0' : ''" />
          </div>
          <figcaption class="mt-3 text-[15px]"><span class="font-semibold text-ink">{{ item.title }}</span><template v-if="item.person"> · {{ firstName(item.person.name) }}</template></figcaption>
        </figure>
      </UCarousel>
    </div>
  </section>
</template>
