<script setup lang="ts">
// Zvýrazňovač's project page: on black, the result at poster size with the client, the
// headline in the heavy type and a black-and-white photograph; then the story.
import type { Project } from '~/lib/cms-content'

defineProps<{ entry: Project }>()
const { settings, words } = await useProfile()
</script>

<template>
  <article>
    <section class="bg-ink text-paper on-ink">
      <div class="wrap pt-16 lg:pt-24 pb-14 lg:pb-20 grid lg:grid-cols-12 gap-x-10 gap-y-8 items-end">
        <div class="lg:col-span-7">
          <p class="mono opacity-75">{{ czText([entry.client, entry.year].filter(Boolean).join(' · ')) }}</p>
          <h1 class="mt-4 text-[2.4rem] md:text-[3.6rem] lg:text-[4.4rem] tracking-[-0.05em]">{{ czText(entry.title) }}</h1>
          <p v-if="entry.done" class="mt-6 text-[1.15rem] max-w-[34rem] opacity-90">{{ czText(entry.done) }}</p>
        </div>
        <div v-if="entry.result" class="lg:col-span-5">
          <p class="font-black text-brand text-[4.2rem] md:text-[6rem] lg:text-[6.8rem] tracking-[-0.06em] leading-[0.85] whitespace-nowrap flex items-center gap-[0.08em]">
            <template v-for="(part, i) in resultParts(entry.result)" :key="i"><UIcon v-if="i" name="i-lucide-arrow-right" class="text-[0.55em]" :aria-label="words.arrowTo" />{{ czText(part) }}</template>
          </p>
          <p v-if="entry.resultText" class="mono mt-4 opacity-90">{{ czText(entry.resultText) }}</p>
        </div>
      </div>
    </section>
    <section class="wrap py-14 lg:py-20">
      <div v-if="entry.image" class="bw aspect-[3/2] lg:max-h-[560px] w-full mb-12 lg:mb-16"><CmsImage :media="entry.image" eager sizes="(min-width: 1440px) 86rem, 100vw" /></div>
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />
      <div class="mt-12 lg:mt-16 border-t-2 border-ink pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <NuxtLink class="ulink" to="/zakazky"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.backToProjects }}</NuxtLink>
        <NuxtLink v-if="settings?.ctaLabel && settings.ctaUrl" class="btn shrink-0" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
      </div>
    </section>
  </article>
</template>
