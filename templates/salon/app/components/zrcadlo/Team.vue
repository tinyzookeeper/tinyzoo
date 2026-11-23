<script setup lang="ts">
// Zrcadlo's team: tall oval mirrors on a rounded panel, each person with the six days they
// work as dots and a link that starts booking them; a row per person on a phone.
import type { Person } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; people: Person[] }>()
const words = useSiteWords()
const choice = useBookingChoice()
const worksOn = (p: Person) => workDays(p).flatMap((on, i) => (on ? [words.value.weekdays[i]!.toLowerCase()] : []))
</script>

<template>
  <section :id="anchor" class="bg-surface scroll-mt-4">
    <div class="wrap pb-20 md:pb-28">
      <div class="rounded-[36px] md:rounded-[48px] bg-paper px-5 py-14 md:px-14 md:py-20">
        <div class="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
            <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[38px] md:text-[48px] leading-[1.08]">{{ tidyText(block.heading) }}</component>
          </div>
          <p v-if="block.text" class="max-w-[30rem]">{{ tidyText(block.text) }}</p>
        </div>
        <ul class="mt-12 md:mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 md:gap-x-10 gap-y-12 sm:gap-y-14">
          <li v-for="p in people" :key="p.id" class="grid grid-cols-[104px_1fr] gap-x-5 items-start sm:flex sm:flex-col sm:items-stretch">
            <div class="mirror aspect-[4/5] mx-2.5 mt-2.5 sm:mt-0"><CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 1024px) 270px, (min-width: 640px) 40vw, 110px" class="w-full h-full object-cover" /></div>
            <div class="sm:mt-8 sm:flex-1 flex flex-col items-start">
              <h3 class="text-[24px] md:text-[28px] leading-tight">{{ p.name }}</h3>
              <p v-if="p.role" class="label mt-2">{{ p.role }}</p>
              <p v-if="p.bio" class="mt-3 text-[15px]">{{ tidyText(p.bio) }}</p>
              <ul class="mt-4 sm:mt-auto sm:pt-4 flex gap-1 max-[359px]:gap-[2px] sm:gap-1.5" :aria-label="words.worksLabel(worksOn(p))">
                <li
                  v-for="(on, i) in workDays(p)" :key="i" class="w-[26px] h-[26px] max-[359px]:w-[22px] max-[359px]:h-[22px] sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] font-semibold"
                  :class="on ? 'bg-ink text-surface' : 'text-quiet shadow-[inset_0_0_0_1px_var(--line)]'" :aria-hidden="on ? undefined : 'true'"
                >{{ words.weekdaysShort[i] }}</li>
              </ul>
              <NuxtLink :to="`/#${anchorOf('booking')}`" :data-person-book="p.name" class="mt-4 inline-flex items-center gap-2 min-h-11 text-[15px] font-semibold text-brand hover:text-ink" @click="choice.person.value = p.name">{{ p.bookLabel || block.bookLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
