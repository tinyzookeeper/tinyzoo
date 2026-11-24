<script setup lang="ts">
// Vizitka's project page: the client and the year, the headline, what was done and the result
// as a large figure on a tinted band, then the photograph and the story.
import type { Project } from '../../lib/cms-content'

defineProps<{ entry: Project }>()
const { settings, words } = await useProfile()
</script>

<template>
  <article>
    <section class="bg-tint">
      <div class="wrap py-16 lg:py-24 grid lg:grid-cols-12 gap-x-10 gap-y-10 items-end">
        <div class="lg:col-span-7">
          <p class="label text-brand">{{ czText([entry.client, entry.year].filter(Boolean).join(' · ')) }}</p>
          <h1 class="mt-4 text-[2.1rem] md:text-[3rem] leading-[1.12]">{{ czText(entry.title) }}</h1>
          <p v-if="entry.done" class="mt-6 max-w-[34rem]">{{ czText(entry.done) }}</p>
        </div>
        <div v-if="entry.result" class="lg:col-span-5 lg:col-start-9 pt-6 border-t border-ink">
          <p class="serif text-brand text-[3.2rem] lg:text-[4rem] font-medium leading-none whitespace-nowrap flex items-center gap-2">
            <template v-for="(part, i) in resultParts(entry.result)" :key="i"><UIcon v-if="i" name="i-lucide-arrow-right" class="text-[0.6em]" :aria-label="words.arrowTo" />{{ czText(part) }}</template>
          </p>
          <p v-if="entry.resultText" class="mt-3 text-ink">{{ czText(entry.resultText) }}</p>
        </div>
      </div>
    </section>
    <section class="wrap py-14 lg:py-20">
      <div v-if="entry.image" class="ph aspect-[3/2] lg:max-h-[560px] w-full"><CmsImage :media="entry.image" eager sizes="(min-width: 1280px) 76rem, 100vw" /></div>
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look mt-12 lg:mt-16" />
      <div class="mt-12 lg:mt-16 pt-8 border-t border-ink flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <NuxtLink class="tlink" to="/zakazky"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.backToProjects }}</NuxtLink>
        <NuxtLink v-if="settings?.ctaLabel && settings.ctaUrl" class="btn shrink-0" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel }}</NuxtLink>
      </div>
    </section>
  </article>
</template>
