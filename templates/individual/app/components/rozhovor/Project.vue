<script setup lang="ts">
// Rozhovor's project page: a photograph on a rounded frame, the result in a bubble on its
// edge, the headline and what was done beside it, then the story.
import type { Project } from '~/lib/cms-content'

defineProps<{ entry: Project }>()
const { settings, words } = await useProfile()
</script>

<template>
  <article>
    <section class="wrap pt-8 lg:pt-12 pb-10">
      <div class="grid lg:grid-cols-12 gap-x-12 gap-y-12 items-center">
        <div class="lg:col-span-6">
          <p class="kicker text-quiet">{{ czText([entry.client, entry.year].filter(Boolean).join(' · ')) }}</p>
          <h1 class="mt-3 text-[2.3rem] leading-[1.1] md:text-[3.2rem] tracking-[-0.03em]">{{ czText(entry.title) }}</h1>
          <p v-if="entry.done" class="mt-6 text-[1.25rem] leading-[1.5] max-w-[34rem]">{{ czText(entry.done) }}</p>
        </div>
        <figure class="lg:col-span-6 relative pb-7">
          <div v-if="entry.image" class="ph aspect-[3/2] rounded-[1.75rem] md:rounded-[2.25rem]"><CmsImage :media="entry.image" eager sizes="(min-width: 1024px) 38rem, 100vw" /></div>
          <p v-if="entry.result" class="absolute left-4 bottom-0 bg-brand text-brand-ink rounded-[1.3rem_1.3rem_1.3rem_0.3rem] px-5 py-3 flex items-center gap-3">
            <span class="serif font-bold text-[2rem] leading-none tracking-[-0.03em] whitespace-nowrap inline-flex items-center gap-1.5">
              <template v-for="(part, i) in resultParts(entry.result)" :key="i"><UIcon v-if="i" name="i-lucide-arrow-right" class="text-[0.65em]" :aria-label="words.arrowTo" />{{ czText(part) }}</template>
            </span>
            <span v-if="entry.resultText" class="text-[0.95rem] leading-[1.2] max-w-[10rem]">{{ czText(entry.resultText) }}</span>
          </p>
        </figure>
      </div>
    </section>
    <section class="wrap pb-16 lg:pb-24">
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />
      <div class="mt-12 lg:mt-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <NuxtLink class="tlink" to="/zakazky"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.backToProjects }}</NuxtLink>
        <NuxtLink v-if="settings?.ctaLabel && settings.ctaUrl" class="btn shrink-0" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel }}</NuxtLink>
      </div>
    </section>
  </article>
</template>
