<script setup lang="ts">
// Soutisk's fees: on yellow, an open table with the period that holds today as one dark
// rounded column, and what is included as a list with ticks.
const props = defineProps<{ block: BlockOf<'fees'>; first?: boolean; anchor?: string; fees: Awaited<ReturnType<typeof useFees>> }>()
const { words, settings } = await useEvent()
const heads = computed(() => props.fees.periods.value.map((p, i) => periodHead(p, shortDay(settings.value?.date), words.value, i === props.fees.current.value, words.value.feeNowLong)))
const rows = computed(() => props.fees.tracks.value)
</script>

<template>
  <section :id="anchor" class="relative bg-c2 pt-6 sm:pt-10 pb-24 sm:pb-36" :class="first ? 'mt-14 sm:mt-28' : ''">
    <svg class="hills text-c2" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><use href="#soutisk-hl3" fill="currentColor" /></svg>
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-9">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-lg">{{ tidyText(block.text) }}</p>
        <template v-if="block.included.length">
          <h3 class="font-bold mt-7">{{ block.includedTitle }}</h3>
          <ul class="mt-2 space-y-1.5">
            <li v-for="line in block.included" :key="line.id" class="flex gap-3"><UIcon name="i-lucide-check" class="mt-1.5 flex-none" aria-hidden="true" />{{ tidyText(line.text) }}</li>
          </ul>
        </template>
      </div>
      <div class="lg:col-span-8">
        <table class="w-full text-left border-separate border-spacing-0">
          <caption class="sr-only">{{ words.feeCaption }}</caption>
          <thead>
            <tr class="align-bottom">
              <th scope="col" class="pb-3 pr-2 font-bold w-[31%]">{{ words.route }}</th>
              <th v-for="(head, i) in heads" :key="fees.periods.value[i]!.id" scope="col" class="font-medium max-[374px]:!px-1.5" :class="i === fees.current.value ? 'p-3 sm:px-6 bg-ink text-paper rounded-t-[24px]' : 'p-2 sm:p-3 sm:px-6'">
                <span class="block text-sm" :class="i === fees.current.value ? 'text-c2 font-bold' : ''">{{ head[0] }}</span><span class="block font-bold sm:text-lg whitespace-nowrap">{{ head[1] }}</span>
              </th>
            </tr>
          </thead>
          <!-- (below 375 px the table is tighter: at 360 the design's own sizes are wider than the screen) -->
          <tbody class="disp text-[1.5rem] max-[374px]:text-[1.2rem] sm:text-[2.4rem]">
            <tr v-for="(track, r) in rows" :key="track.id">
              <th scope="row" class="py-4 sm:py-5 pr-2 border-t-[2.5px] border-ink font-sans tracking-normal"><span class="font-bold text-lg sm:text-xl block leading-tight">{{ track.name }}</span><span class="text-sm sm:text-base font-normal">{{ track.length }}</span></th>
              <td
                v-for="(p, i) in fees.periods.value" :key="p.id" class="p-3 sm:px-6 max-[374px]:!px-1.5 border-t-[2.5px]"
                :class="i === fees.current.value ? ['bg-ink text-paper', r === 0 ? 'border-ink' : 'border-paper/25', r === rows.length - 1 ? 'rounded-b-[24px]' : ''] : 'border-ink'" :data-current="i === fees.current.value ? '' : undefined"
              >{{ track.prices?.[i]?.price ?? '' }}<template v-if="i === fees.current.value">&nbsp;<span class="font-sans text-base font-bold tracking-normal">{{ words.crowns }}</span></template><span v-else class="hidden sm:inline font-sans text-base font-bold tracking-normal">&nbsp;{{ words.crowns }}</span></td>
            </tr>
          </tbody>
        </table>
        <div class="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-2">
          <p v-for="note in block.notes" :key="note.id">{{ tidyText(note.text) }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
