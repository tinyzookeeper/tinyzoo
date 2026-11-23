<script setup lang="ts">
// Dres's club page: a black block. The photograph of the ground with the heading laid over its
// bottom edge, the story and three figures, the ground, the match-day facts and the committee.
import type { Committee } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string; committee: Committee[] }>()
const { settings, words } = await useClub()
const addressLines = computed(() => (settings.value?.address ?? '').split(/, (?=\d{3} ?\d{2})/).filter(Boolean))
const groundText = computed(() => props.block.groundText || props.block.groundFacts.map((f) => `${f.label}: ${f.value}`).join(', '))
</script>

<template>
  <section :id="anchor" class="dark mt-16 scroll-mt-0 bg-ink text-paper lg:mt-24">
    <div v-if="block.image" class="relative">
      <CmsImage :media="block.image" sizes="100vw" class="aspect-[4/3] w-full object-cover md:aspect-[21/8]" />
      <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" aria-hidden="true" />
      <div class="wrap absolute inset-x-0 bottom-0">
        <component :is="first ? 'h1' : 'h2'" class="wide h2 translate-y-[.12em]">{{ plainEmphasis(block.heading) }}</component>
      </div>
    </div>
    <div v-else class="wrap pt-14 lg:pt-20"><component :is="first ? 'h1' : 'h2'" class="wide h2">{{ plainEmphasis(block.heading) }}</component></div>
    <div class="wrap grid gap-12 py-14 lg:grid-cols-12 lg:py-20">
      <div class="flex flex-col justify-between gap-10 lg:col-span-5">
        <p v-if="block.text" class="text-lg text-paper/90">{{ tidyText(block.text) }}</p>
        <dl v-if="block.facts.length" class="grid grid-cols-3 gap-3">
          <div v-for="f in block.facts" :key="f.id" class="border-t-2 border-paper pt-3"><dt class="cap text-paper/70">{{ f.label }}</dt><dd class="wide mt-2 text-[clamp(26px,3vw,40px)]">{{ f.value }}</dd></div>
        </dl>
      </div>
      <div class="lg:col-span-7">
        <div class="grid gap-10 sm:grid-cols-2">
          <div>
            <h3 class="cap text-paper/70">{{ block.groundHeading || settings?.groundName }}</h3>
            <p v-if="addressLines.length" class="head mt-3 text-[22px]"><template v-for="(l, i) in addressLines" :key="i"><br v-if="i">{{ l }}</template></p>
            <p v-if="groundText" class="mt-3 text-[15px] text-paper/80">{{ tidyText(groundText) }}</p>
            <p v-if="settings?.mapUrl" class="mt-4"><a class="font-bold underline decoration-2 underline-offset-4 hover:bg-paper hover:text-ink" :href="settings.mapUrl" target="_blank" rel="noopener">{{ words.openMap }}</a></p>
          </div>
          <div v-if="block.matchDayHeading || block.matchDayText">
            <h3 class="cap text-paper/70">{{ block.matchDayHeading }}</h3>
            <p v-if="block.matchDayTitle" class="head mt-3 text-[22px]">{{ block.matchDayTitle }}</p>
            <p v-for="(p, i) in paragraphs(block.matchDayText)" :key="i" class="mt-3 text-[15px] text-paper/80">{{ tidyText(p) }}</p>
          </div>
        </div>
        <template v-if="committee.length">
          <h3 class="cap mt-12 text-paper/70">{{ block.committeeHeading }}</h3>
          <ul class="mt-3 border-t-2 border-paper">
            <li v-for="c in committee" :key="c.id" class="grid gap-x-4 border-b border-paper/20 py-3.5 sm:grid-cols-[8rem_1fr_auto] sm:items-baseline">
              <span class="cap text-paper/70">{{ c.role }}</span><span class="head text-[19px]">{{ c.name }}</span>
              <a v-if="c.contact" class="hover:underline" :class="c.contact.includes('@') ? '' : 'tabular-nums'" :href="contactHref(c.contact)">{{ c.contact }}</a>
            </li>
          </ul>
        </template>
      </div>
    </div>
  </section>
</template>
