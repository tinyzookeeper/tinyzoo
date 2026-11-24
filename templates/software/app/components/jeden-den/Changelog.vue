<script setup lang="ts">
// One Day's changelog, 17:00: a small timeline of releases (the newest with a large dot), and a
// photograph with a caption beside it (under it on a phone).
import type { Release } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'changelog'>; first?: boolean; anchor?: string; items: Release[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="bg-late">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-12 lg:pt-24" :time="block.time" :note="block.timeNote" />
      <div class="grid gap-10 pb-16 pt-6 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pl-14 lg:pt-24">
        <div class="lg:col-span-5">
          <component :is="first ? 'h1' : 'h2'" class="h2 text-[36px] sm:text-[46px] lg:text-[52px]"><KitMarked :text="block.heading" /></component>
          <p v-if="block.text" class="mt-5 max-w-[26rem]">{{ tidyText(block.text) }}</p>
          <SiteLink v-if="block.linkLabel && block.linkUrl" class="ul mt-5 inline-block font-medium" :to="block.linkUrl">{{ tidyText(block.linkLabel) }}</SiteLink>
          <figure v-if="block.image" class="mt-10 hidden lg:block">
            <CmsImage :media="block.image" sizes="28rem" class="aspect-[4/3] w-full rounded-[22px] object-cover" />
            <figcaption v-if="block.imageCaption" class="mt-3 text-[14px]">{{ tidyText(block.imageCaption) }}</figcaption>
          </figure>
        </div>
        <ol class="relative lg:col-span-7">
          <li v-for="(r, i) in items" :key="r.id" data-release class="relative pl-7" :class="i === items.length - 1 ? 'border-l border-transparent' : 'border-l border-ink/35 pb-8'">
            <span class="absolute rounded-full" :class="i === 0 ? '-left-[7px] top-1.5 h-[13px] w-[13px] bg-brand' : '-left-[5px] top-2 h-[9px] w-[9px] bg-ink'" />
            <p class="time">{{ releaseDate(r.date) }} · {{ words.version }} {{ r.version }}</p>
            <h3 class="mt-1.5 font-display text-[24px] font-semibold leading-tight">{{ tidyText(r.title) }}</h3>
            <p v-if="r.text" class="mt-1.5 max-w-[34rem]">{{ tidyText(r.text) }}</p>
          </li>
        </ol>
        <figure v-if="block.image" class="lg:hidden">
          <CmsImage :media="block.image" sizes="100vw" class="aspect-[4/3] w-full rounded-[22px] object-cover" />
          <figcaption v-if="block.imageCaption" class="mt-3 text-[14px]">{{ tidyText(block.imageCaption) }}</figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
