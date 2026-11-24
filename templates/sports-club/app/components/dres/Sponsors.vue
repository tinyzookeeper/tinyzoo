<script setup lang="ts">
// Dres's partners: a heavy rule, then the names in capitals, the larger the more they give; a
// name turns into a block of the club colour when hovered.
import type { Sponsor } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'sponsors'>; first?: boolean; anchor?: string; items: Sponsor[] }>()
const words = useSiteWords()
const LEVELS = [
  { level: 'main', list: 'wide mt-3 flex flex-wrap gap-x-10 gap-y-2 text-[clamp(26px,4.6vw,64px)]' },
  { level: 'partner', list: 'wide mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[clamp(17px,2.2vw,28px)] !leading-tight' },
  { level: 'supporter', list: 'head mt-3 flex flex-wrap gap-x-7 gap-y-1 text-[17px] !font-semibold !leading-normal' },
] as const
const levels = computed(() => LEVELS.map((l) => ({ ...l, items: props.items.filter((s) => s.level === l.level) })).filter((l) => l.items.length))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-24">
    <div class="border-t-4 border-ink pt-6">
      <div class="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-2">
        <component :is="first ? 'h1' : 'h2'" class="wide text-[6.4vw] sm:text-[clamp(26px,3.6vw,48px)]">{{ plainEmphasis(block.heading) }}</component>
        <p v-if="block.text" class="max-w-md">{{ tidyText(block.text) }}</p>
      </div>
      <template v-for="(l, i) in levels" :key="l.level">
        <p class="cap opacity-70" :class="i ? 'mt-10' : 'mt-10'">{{ words.level[l.level] }}</p>
        <p :class="l.list">
          <template v-for="s in l.items" :key="s.id">
            <a v-if="s.url" class="hover:bg-brand hover:text-brand-ink" :href="siteHref(s.url)" :target="isExternal(s.url) ? '_blank' : undefined" :rel="isExternal(s.url) ? 'noopener' : undefined">{{ s.name }}</a>
            <span v-else>{{ s.name }}</span>
          </template>
        </p>
      </template>
    </div>
  </section>
</template>
