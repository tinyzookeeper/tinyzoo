<script setup lang="ts">
// Dres's photograph with the last result on a paper tab laid over its corner: the score in a box
// of the colour of the outcome, the two teams, the scorers.
import type { LastView } from '~/composables/useClub'

const props = defineProps<{ block: BlockOf<'lastResult'>; first?: boolean; last: LastView }>()
const { words } = await useClub()
const m = computed(() => props.last.match)
const report = computed(() => m.value?.match.report ?? null)
const stamp = computed(() => (m.value ? [props.block.resultLabel, `${weekday(m.value.at)} ${dayMonth(m.value.at, 'slash')}`, m.value.round ? words.value.round(m.value.round) : ''].filter(Boolean).join(' · ') : props.block.resultLabel))
</script>

<template>
  <section class="relative" :aria-label="block.resultLabel ?? undefined" :data-last-result="m?.score ?? ''">
    <CmsImage v-if="block.image" :media="block.image" sizes="100vw" class="aspect-[4/3] w-full object-cover md:aspect-[21/9]" />
    <div class="bg-paper px-5 pb-2 pt-7" :class="block.image ? 'md:absolute md:bottom-0 md:left-0 md:w-[min(620px,60%)] md:p-8 md:pb-6' : 'wrap pt-14'">
      <p class="cap">{{ stamp }}</p>
      <div v-if="m" class="mt-4 flex items-center gap-4">
        <span class="box !h-16 !min-w-[112px] !text-[32px]" :class="`box-${m.outcome}`"><span class="sr-only">{{ words.outcome[m.outcome!] }} </span>{{ m.score }}</span>
        <p class="head text-[19px] leading-tight sm:text-[22px]"><span class="block" :class="m.home.us ? '' : '!font-semibold opacity-70'">{{ m.home.name }}</span><span class="block" :class="m.away.us ? '' : '!font-semibold opacity-70'">{{ m.away.name }}</span></p>
      </div>
      <p v-if="m && (m.match.scorers || (report && block.reportLabel))" class="mt-4 text-[15px]">
        <template v-if="m.match.scorers">{{ `${block.scorersLabel}: ${m.match.scorers}. ` }}</template>
        <NuxtLink v-if="report && block.reportLabel" class="font-bold underline decoration-2 underline-offset-4 hover:bg-ink hover:text-paper" :to="articleHref(report)">{{ block.reportLabel }}</NuxtLink>
      </p>
    </div>
  </section>
</template>
