<script setup lang="ts">
// Čekárna's services: an open two-column list beside a short introduction, no boxes.
import type { Service } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28">
    <div class="grid gap-10 lg:gap-20 lg:grid-cols-[21rem_1fr]">
      <div>
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.5rem] lg:text-[3rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5">{{ tidyText(block.text) }}</p>
        <p v-if="block.coveredNote" class="mt-6 flex items-center gap-3 text-ink font-semibold"><span class="grid place-items-center size-8 rounded-full bg-brand-tint text-brand shrink-0"><UIcon name="i-lucide-shield-check" class="ic size-[18px]" aria-hidden="true" /></span>{{ block.coveredNote }}</p>
      </div>
      <ul class="grid sm:grid-cols-2 gap-x-14 gap-y-9 lg:gap-y-11 content-start lg:pt-9">
        <li v-for="s in items" :key="s.id"><h3 class="text-[1.3rem]">{{ tidyText(s.name) }}</h3><p v-if="s.text" class="mt-2">{{ tidyText(s.text) }}</p></li>
      </ul>
    </div>
  </section>
</template>
