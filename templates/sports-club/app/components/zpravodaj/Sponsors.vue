<script setup lang="ts">
// Zpravodaj's partners: a ruled list by level, the names set in the headline face, the larger
// the more they give.
import type { Sponsor } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'sponsors'>; first?: boolean; anchor?: string; items: Sponsor[] }>()
const words = useSiteWords()
const LEVELS = [
  { level: 'main', head: 'md:pt-3', list: 'gap-x-12 gap-y-2 font-display text-[28px] font-bold leading-tight text-ink lg:text-[36px]' },
  { level: 'partner', head: 'md:pt-1.5', list: 'gap-x-10 gap-y-2 font-display text-[21px] font-semibold leading-tight text-ink lg:text-[24px]' },
  { level: 'supporter', head: 'md:pt-0.5', list: 'gap-x-8 gap-y-1.5 text-[17px] text-ink' },
] as const
const levels = computed(() => LEVELS.map((l) => ({ ...l, items: props.items.filter((s) => s.level === l.level) })).filter((l) => l.items.length))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 pt-16 lg:pt-24">
    <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
    <p v-if="block.text" class="mt-4 max-w-[38rem]">{{ tidyText(block.text) }}</p>
    <dl class="mt-8 border-t border-ink">
      <div v-for="l in levels" :key="l.level" class="grid gap-x-10 gap-y-3 border-b border-line py-7 md:grid-cols-[13rem_1fr]">
        <dt class="label" :class="l.head">{{ words.level[l.level] }}</dt>
        <dd class="flex flex-wrap" :class="l.list">
          <template v-for="s in l.items" :key="s.id">
            <a v-if="s.url" class="hover:text-brand" :href="siteHref(s.url)" :target="isExternal(s.url) ? '_blank' : undefined" :rel="isExternal(s.url) ? 'noopener' : undefined">{{ s.name }}</a>
            <span v-else>{{ s.name }}</span>
          </template>
        </dd>
      </div>
    </dl>
    <p v-if="block.note && block.noteEmail" class="mt-5 text-sm">{{ block.note }} <a class="link !font-medium" :href="`mailto:${block.noteEmail}`">{{ block.noteEmail }}</a>.</p>
  </section>
</template>
