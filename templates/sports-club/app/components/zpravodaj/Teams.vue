<script setup lang="ts">
// Zpravodaj's teams: a ruled list, each team with its competition and coach and its training
// times written out. The photograph stands beside the list on wide screens.
import type { Squad } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'teams'>; first?: boolean; anchor?: string; squads: Squad[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 pt-16 lg:pt-24">
    <div class="grid gap-6 lg:grid-cols-12 lg:gap-14">
      <div class="lg:col-span-4">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-4 max-w-sm">{{ tidyText(block.text) }}</p>
        <figure v-if="block.image" class="mt-8 hidden max-w-[19rem] lg:block">
          <div class="frame"><CmsImage :media="block.image" sizes="19rem" class="aspect-[4/3] w-full object-cover" /></div>
          <figcaption v-if="block.imageCaption" class="mt-3 text-[13px] text-quiet">{{ tidyText(block.imageCaption) }}</figcaption>
        </figure>
      </div>
      <ul class="border-t border-ink lg:col-span-8">
        <li v-for="s in squads" :key="s.id" class="grid gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[11rem_1fr_1fr]">
          <h3 class="text-[21px] font-bold leading-tight">{{ s.name }} <span v-if="s.category" class="font-sans text-sm font-normal text-quiet">{{ s.category }}</span></h3>
          <p class="text-[15px]"><span v-if="s.competition" class="block text-ink">{{ s.competition }}</span><template v-if="s.coach">{{ words.coachOf(s.coachRole, s.coach) }}</template></p>
          <p v-if="s.trainings.length" class="text-[15px]"><span class="label mr-2">{{ words.training }}</span>{{ trainingText(s.trainings, words, 'long') }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
