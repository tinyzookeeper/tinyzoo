<script setup lang="ts">
// Zpravodaj's club page: the story and three figures, the committee as a ruled list, the framed
// photograph of the ground with its caption, the ground's address and the match-day facts.
import type { Committee } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string; committee: Committee[] }>()
const { settings, words } = await useClub()
// The ground's practical facts as a sentence, for a club that filled in the list only.
// The street and the town on two lines, as an address is written on an envelope.
const addressLines = computed(() => (settings.value?.address ?? '').split(/, (?=\d{3} ?\d{2})/).filter(Boolean))
const groundText = computed(() => props.block.groundText || props.block.groundFacts.map((f) => `${f.label}: ${f.value}`).join(', '))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 py-16 lg:py-24">
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div class="lg:col-span-6">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 max-w-[36rem]">{{ tidyText(block.text) }}</p>
        <dl v-if="block.facts.length" class="mt-8 grid grid-cols-3 border-y border-ink">
          <div v-for="(f, i) in block.facts" :key="f.id" class="py-5" :class="i === 0 ? 'pr-3' : i === block.facts.length - 1 ? 'border-l border-line py-5 pl-4' : 'border-l border-line px-4'"><dt class="label">{{ f.label }}</dt><dd class="mt-1 font-display text-[30px] font-extrabold leading-none text-ink">{{ f.value }}</dd></div>
        </dl>

        <template v-if="committee.length">
          <h3 class="mt-10 text-[22px] font-bold">{{ block.committeeHeading }}</h3>
          <ul class="mt-4 border-t border-line text-[15px]">
            <li v-for="c in committee" :key="c.id" class="grid gap-x-4 border-b border-line py-3 sm:grid-cols-[9rem_1fr_auto]">
              <span class="label self-center">{{ c.role }}</span><span class="font-semibold text-ink">{{ c.name }}</span>
              <a v-if="c.contact" class="hover:text-brand" :class="c.contact.includes('@') ? '' : 'num'" :href="contactHref(c.contact)">{{ c.contact }}</a>
            </li>
          </ul>
        </template>
      </div>
      <div class="lg:col-span-6">
        <figure v-if="block.image">
          <div class="frame"><CmsImage :media="block.image" sizes="(min-width: 1024px) 38rem, 100vw" class="aspect-[3/2] w-full object-cover" /></div>
          <figcaption v-if="block.imageCaption" class="mt-3 text-[13px] text-quiet">{{ tidyText(block.imageCaption) }}</figcaption>
        </figure>
        <div class="grid gap-8 sm:grid-cols-2" :class="block.image ? 'mt-8' : ''">
          <div>
            <h3 class="text-[22px] font-bold">{{ block.groundHeading || settings?.groundName }}</h3>
            <p v-if="addressLines.length" class="mt-3 text-[15px]"><template v-for="(l, i) in addressLines" :key="i"><br v-if="i">{{ l }}</template></p>
            <p v-if="groundText" class="mt-3 text-[15px]">{{ tidyText(groundText) }}</p>
            <p v-if="settings?.mapUrl" class="mt-4"><a class="link" :href="settings.mapUrl" target="_blank" rel="noopener">{{ words.openMap }}</a></p>
          </div>
          <div v-if="block.matchDayHeading || block.matchDayText">
            <h3 class="text-[22px] font-bold">{{ block.matchDayHeading }}</h3>
            <p v-for="(p, i) in paragraphs(block.matchDayText)" :key="i" class="mt-3 text-[15px]">{{ tidyText(p) }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
