<script setup lang="ts">
// Rozhovor's services: the visitor asks, the owner answers, then cards with whom each is for,
// a pill with how long it takes and the price. A coloured cell closes the grid whatever the
// number of services.
import type { Service } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
const words = useSiteWords()
const { cta } = await useProfile()
</script>

<template>
  <section :id="anchor" class="wrap pt-10 lg:pt-14 pb-20 lg:pb-28">
    <RozhovorQuestion :question="block.question" />
    <RozhovorAnswer :heading="block.heading" :first="first" :asked="!!block.question" class="max-w-[46rem]" />

    <div class="mt-10 lg:mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
      <article v-for="s in items" :key="s.id" class="card card-lift p-6 lg:p-8 flex flex-col" data-service>
        <h3 class="text-[1.55rem] leading-[1.15] font-bold">{{ czText(s.name) }}</h3>
        <p v-if="s.text" class="mt-3">{{ czText(s.text) }}</p>
        <p v-if="s.forWhom" class="mt-4 text-[1.05rem]"><span class="font-bold text-ink">{{ words.forWhom }}:</span> {{ czText(continued(s.forWhom)) }}.</p>
        <div class="mt-auto pt-6 flex items-end justify-between gap-4">
          <span v-if="s.duration" class="inline-flex items-center gap-2 bg-paper rounded-full px-3.5 py-1.5 text-[1rem] text-ink"><UIcon name="i-lucide-clock-3" aria-hidden="true" /> {{ czText(s.duration) }}</span>
          <span class="serif text-brand font-bold text-[1.5rem] leading-none tracking-[-0.02em] whitespace-nowrap">{{ czText(s.price) }}</span>
        </div>
      </article>

      <!-- The last cell closes the grid whatever the number of services -->
      <div v-if="block.helpTitle" class="rounded-[1.75rem] bg-brand text-brand-ink p-6 lg:p-8 flex flex-col on-dark">
        <p class="serif italic text-[1.55rem] leading-[1.2] tracking-[-0.02em]">{{ czText(block.helpTitle) }}</p>
        <p v-if="block.helpText" class="mt-3">{{ czText(block.helpText) }}</p>
        <div v-if="block.linkUrl || cta" class="mt-auto pt-6"><NuxtLink class="btn btn-card" :to="siteHref(block.linkUrl || cta!.url)">{{ words.callUs }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink></div>
      </div>
    </div>
    <p v-if="block.footnote" class="mt-5 text-[1.02rem] text-quiet">{{ czText(block.footnote) }}</p>
  </section>
</template>
