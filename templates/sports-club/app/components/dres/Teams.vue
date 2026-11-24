<script setup lang="ts">
// Dres's teams: bordered tiles with the team's mark in huge capitals, turning black on hover.
// A row to swipe on a phone, a grid from the width of a tablet.
import type { Squad } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'teams'>; first?: boolean; anchor?: string; squads: Squad[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-24">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <component :is="first ? 'h1' : 'h2'" class="wide h2">{{ plainEmphasis(block.heading) }}</component>
      <p v-if="block.text" class="max-w-md pb-2 lg:text-lg">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-8">
      <SwipeRow
        :items="squads" phone="sm:hidden" grid="hidden sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-3"
        bleed="-mx-5" viewport="px-5" container="-ms-3" item="basis-[78.7%] ps-3"
      >
        <template #default="{ item: s }">
          <div class="flex h-full flex-col border-2 border-ink p-5 transition-colors hover:bg-ink hover:text-paper lg:p-6">
            <p class="wide text-[56px]">{{ s.badge || s.name[0] }}</p>
            <h3 class="head mt-4 text-[22px]">{{ s.name }}</h3>
            <p v-if="s.competition" class="mt-1 text-[15px] opacity-80">{{ s.competition }}</p>
            <p v-if="s.coach" class="mt-5 text-[15px]"><span v-if="s.coachRole" class="cap mr-2 opacity-70">{{ capital(s.coachRole) }}</span>{{ s.coach }}</p>
            <p v-if="s.trainings.length" class="text-[15px]"><span class="cap mr-2 opacity-70">{{ words.training }}</span>{{ trainingText(s.trainings, words, 'short') }}</p>
          </div>
        </template>
      </SwipeRow>
    </div>
  </section>
</template>
