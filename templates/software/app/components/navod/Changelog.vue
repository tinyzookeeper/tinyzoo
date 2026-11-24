<script setup lang="ts">
// Návod's changelog: a revision list, the newest version in a filled tag, the others outlined.
import type { Release } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'changelog'>; first?: boolean; anchor?: string; items: Release[] }>()
const sections = await usePageSections()
const number = computed(() => sectionNumber(sections.value, 'changelog'))
</script>

<template>
  <section :id="anchor" class="border-t border-ink/15">
    <div class="wrap grid gap-10 py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label text-quiet"><span class="text-brand">{{ number }}</span> · {{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink lg:text-[42px]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[26rem]">{{ tidyText(block.text) }}</p>
        <SiteLink v-if="block.linkLabel && block.linkUrl" class="link mt-6 inline-block text-[16px] font-medium text-ink" :to="block.linkUrl">{{ tidyText(block.linkLabel) }}</SiteLink>
      </div>
      <ol class="border-t border-ink lg:col-span-8">
        <li v-for="(r, i) in items" :key="r.id" data-release class="grid gap-x-6 gap-y-1 border-b border-line py-5 sm:grid-cols-[150px_1fr]">
          <p class="font-mono text-[13px] text-quiet"><span class="mr-2 px-1.5 py-0.5" :class="i === 0 ? 'bg-ink text-sheet' : 'border border-ink text-ink'">{{ r.version }}</span>{{ releaseDate(r.date) }}</p>
          <div>
            <h3 class="text-[18px] font-semibold text-ink">{{ tidyText(r.title) }}</h3>
            <p v-if="r.text" class="mt-1 text-[16px]">{{ tidyText(r.text) }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
