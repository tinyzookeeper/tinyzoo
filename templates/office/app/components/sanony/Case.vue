<script setup lang="ts">
// Šanony's page of one case: a heavy title with who and how long, a wide photograph, the problem
// on ink, what was done on paper and the result on the brand colour, then the whole story.
import type { CaseStudy } from '~/lib/cms-content'

defineProps<{ entry: CaseStudy }>()
const { words, cta } = await useOffice()
</script>

<template>
  <article>
    <section class="wrap pb-10 pt-6 lg:pb-14 lg:pt-10">
      <p class="kicker"><NuxtLink class="navlink" :to="`/#${anchorOf('cases')}`">{{ words.backToCases }}</NuxtLink></p>
      <h1 class="display mt-5 text-[42px] sm:text-[64px] xl:text-[76px]">{{ tidyText(entry.title) }}</h1>
      <p v-if="entry.client || entry.duration" class="kicker mt-6 text-[13px]">{{ [beforeComma(entry.client), entry.duration].filter(Boolean).join(' · ') }}</p>
    </section>
    <figure v-if="entry.image"><CmsImage :media="entry.image" eager sizes="100vw" class="aspect-[4/3] w-full object-cover sm:aspect-[21/9]" /></figure>
    <section class="bg-soft">
      <div class="wrap grid gap-5 py-12 lg:grid-cols-3 lg:py-16">
        <div class="bg-ink px-6 py-6 text-paper"><p class="kicker text-[12px] text-soft">{{ words.problem }}</p><p class="mt-2 text-[16.5px] leading-[1.55]">{{ tidyText(entry.problem) }}</p></div>
        <div class="bg-paper px-6 py-6"><p class="kicker text-[12px]">{{ words.whatWeDid }}</p><p class="mt-2 text-[16.5px] leading-[1.55]">{{ tidyText(entry.solution) }}</p></div>
        <div class="bg-brand px-6 py-6 text-brand-ink"><p class="kicker text-[12px]">{{ words.result }}</p><p class="mt-2 font-display text-[23px] font-bold leading-[1.2] tracking-[-0.01em]">{{ tidyText(entry.outcome) }}</p></div>
      </div>
    </section>
    <section v-if="entry.body" class="wrap py-16 lg:py-24">
      <h2 class="display mb-8 text-[34px] sm:text-[48px]">{{ words.theWholeStory }}</h2>
      <CmsContent :doc="entry.body" class="prose-look" />
    </section>
    <section class="wrap pb-16 lg:pb-28" :class="entry.body ? '' : 'pt-16'">
      <div class="flex flex-wrap items-center justify-between gap-6 border-t-4 border-ink pt-8">
        <NuxtLink class="navlink border-ink text-[16px]" :to="`/#${anchorOf('cases')}`">{{ words.backToCases }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-ink" :to="cta.url">{{ cta.label }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
      </div>
    </section>
  </article>
</template>
