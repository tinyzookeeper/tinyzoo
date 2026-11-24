<script setup lang="ts">
// Zpravodaj's opening: the next match as a ruled programme card, the two teams as the headline,
// four facts and a framed photograph. Before the first kick-off is known (the server's answer,
// the browser's first drawing) it shows the first match without a score; see useNow.
import type { NextView } from '../../composables/useClub'

const props = defineProps<{ block: BlockOf<'nextMatch'>; first?: boolean; next: NextView }>()
const { settings, name, words } = await useClub()
const m = computed(() => props.next.match)
const eyebrow = computed(() => [words.value.nextMatch, m.value?.round ? words.value.round(m.value.round) : '', props.next.squad?.competition].filter(Boolean).join(' · '))
const ground = computed(() => (m.value?.isHome ? splitFirstWord(settings.value?.groundName) : [words.value.away, ''] as [string, string]))
const entry = computed(() => splitComma(settings.value?.admission))
const before = computed(() => splitComma(props.block.preMatch))
</script>

<template>
  <section class="wrap pt-10 lg:pt-16" data-next-match>
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div class="lg:col-span-7">
        <p v-if="m || eyebrow" class="label">{{ eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[clamp(38px,6.2vw,76px)] font-extrabold leading-[1.02] tracking-[-.02em] [&_em]:block [&_em]:font-medium [&_em]:italic [&_em]:text-brand">
          <KitMarked v-if="block.heading" :text="block.heading" />
          <template v-else-if="m">{{ m.home.name }} <span class="block font-medium italic text-brand">– {{ m.away.name }}</span></template>
          <template v-else>{{ name }}</template>
        </component>
        <p v-if="block.lead" class="mt-6 max-w-[34rem] text-lg leading-relaxed">{{ tidyText(block.lead) }}</p>

        <dl v-if="m" class="mt-9 grid grid-cols-2 border-t border-ink sm:grid-cols-4">
          <div class="border-b border-line py-4 pr-4 sm:border-b-0">
            <dt class="label">{{ words.when }}</dt>
            <dd class="mt-1.5 font-display text-[19px] font-bold leading-tight text-ink">{{ weekday(m.at) }} {{ dayMonth(m.at) }}<br>{{ m.time }}</dd>
          </div>
          <div class="border-b border-line py-4 pr-4 sm:border-b-0">
            <dt class="label">{{ words.where }}</dt>
            <dd class="mt-1.5 font-display text-[19px] font-bold leading-tight text-ink">{{ ground[0] }}<template v-if="ground[1]"><br>{{ ground[1] }}</template></dd>
          </div>
          <div v-if="m.isHome && entry[0]" class="py-4 pr-4">
            <dt class="label">{{ words.admission }}</dt>
            <dd class="mt-1.5 font-display text-[19px] font-bold leading-tight text-ink">{{ entry[0] }}<template v-if="entry[1]"><br><span class="font-sans text-sm font-normal text-body">{{ entry[1] }}</span></template></dd>
          </div>
          <div v-if="before[0]" class="py-4">
            <dt class="label">{{ words.preMatch }}</dt>
            <dd class="mt-1.5 font-display text-[19px] font-bold leading-tight text-ink">{{ before[0] }}<template v-if="before[1]"><br><span class="font-sans text-sm font-normal text-body">{{ before[1] }}</span></template></dd>
          </div>
        </dl>

        <div v-if="block.primaryLabel || block.secondaryLabel" class="mt-6 flex flex-wrap gap-3">
          <NuxtLink v-if="block.primaryLabel" class="btn btn-fill" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-down" aria-hidden="true" /></NuxtLink>
          <NuxtLink v-if="block.secondaryLabel" class="btn btn-line" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
        </div>
      </div>

      <figure v-if="block.image" class="lg:col-span-5">
        <div class="frame"><CmsImage :media="block.image" eager sizes="(min-width: 1024px) 30rem, 100vw" class="aspect-[4/3] w-full object-cover lg:aspect-[5/6]" /></div>
        <figcaption v-if="block.caption" class="mt-3 text-[13px] text-quiet">{{ tidyText(block.caption) }}</figcaption>
      </figure>
    </div>
  </section>
</template>
