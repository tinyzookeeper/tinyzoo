<script setup lang="ts">
// Lhůty's page of one case: the title with who and how long, a photograph, the problem, what was
// done and the result on the brand colour (as in the list), then the whole story.
import type { CaseStudy } from '../../lib/cms-content'

defineProps<{ entry: CaseStudy }>()
const { words, cta } = await useOffice()
</script>

<template>
  <article>
    <section class="wrap pt-10 pb-12 lg:pt-14 lg:pb-14">
      <p class="label text-quiet"><span class="ticks" /><NuxtLink class="ulink" :to="`/#${anchorOf('cases')}`">{{ words.backToCases }}</NuxtLink></p>
      <h1 class="mt-6 max-w-[22ch] font-display text-[38px] leading-[1.1] tracking-[-0.01em] sm:text-[48px] xl:text-[58px] xl:leading-[1.08]">{{ tidyText(entry.title) }}</h1>
      <p v-if="entry.client || entry.duration" class="num mt-6 text-[13px] text-quiet">{{ [entry.client, entry.duration && words.took(entry.duration)].filter(Boolean).join(' · ') }}</p>
    </section>
    <figure v-if="entry.image" class="wrap pb-12 lg:pb-16">
      <CmsImage :media="entry.image" eager sizes="(min-width: 1280px) 78rem, 100vw" class="aspect-[16/9] w-full object-cover sm:aspect-[21/9]" />
    </figure>
    <section class="bg-brand text-brand-ink">
      <div class="wrap grid gap-x-10 gap-y-6 py-12 lg:grid-cols-3 lg:py-16">
        <div><p class="label text-[11px] text-brand-soft">{{ words.problem }}</p><p class="mt-2 text-[16.5px] leading-[1.6]">{{ tidyText(entry.problem) }}</p></div>
        <div><p class="label text-[11px] text-brand-soft">{{ words.whatWeDid }}</p><p class="mt-2 text-[16.5px] leading-[1.6]">{{ tidyText(entry.solution) }}</p></div>
        <div class="bg-brand-ink/10 p-5"><p class="label text-[11px] text-signal">{{ words.result }}</p><p class="mt-2 text-[17.5px] font-medium leading-[1.5]">{{ tidyText(entry.outcome) }}</p></div>
      </div>
    </section>
    <section v-if="entry.body" class="wrap py-16 lg:py-20">
      <h2 class="mb-6 font-display text-[28px] leading-[1.15] sm:text-[34px]">{{ words.theWholeStory }}</h2>
      <CmsContent :doc="entry.body" class="prose-look" />
    </section>
    <section class="wrap pb-16 lg:pb-24">
      <div class="flex flex-wrap items-center justify-between gap-6 border-t border-ink pt-8">
        <NuxtLink class="ulink text-[16px]" :to="`/#${anchorOf('cases')}`">{{ words.backToCases }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-brand" :to="cta.url">{{ cta.label }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
      </div>
    </section>
  </article>
</template>
