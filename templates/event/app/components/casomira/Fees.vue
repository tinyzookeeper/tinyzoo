<script setup lang="ts">
// Časomíra's fees: a board where only the column that holds today is lit. The head of each
// column says its name and its last day; the lit one says "now".
const props = defineProps<{ block: BlockOf<'fees'>; first?: boolean; anchor?: string; fees: Awaited<ReturnType<typeof useFees>> }>()
const { words, settings } = await useEvent()
const heads = computed(() => props.fees.periods.value.map((p, i) => periodHead(p, shortDay(settings.value?.date), words.value, i === props.fees.current.value, `● ${words.value.feeNowShort}`)))
</script>

<template>
  <section :id="anchor" class="border-t border-line py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap">
      <div class="grid lg:grid-cols-12 gap-x-8 gap-y-4 items-end">
        <div class="lg:col-span-8">
          <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
        </div>
        <p v-if="block.text" class="lg:col-span-4 text-quiet">{{ tidyText(block.text) }}</p>
      </div>
      <div class="board mt-10 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <caption class="sr-only">{{ words.feeCaption }}</caption>
          <thead>
            <tr class="align-bottom mono text-quiet whitespace-nowrap max-sm:!text-[0.66rem] max-sm:!tracking-[0.03em]">
              <th scope="col" class="font-normal p-2.5 sm:p-6 w-[30%]">{{ words.track }}</th>
              <th v-for="(head, i) in heads" :key="fees.periods.value[i]!.id" scope="col" class="font-normal p-2.5 sm:p-6" :class="i === fees.current.value ? 'text-led' : ''">
                <span class="block">{{ head[0] }}</span><span class="block text-text">{{ head[1] }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="track in fees.tracks.value" :key="track.id" class="border-t border-line">
              <th scope="row" class="p-3 sm:p-6 font-bold text-lg sm:text-2xl tracking-[-0.02em] leading-tight">{{ track.name }} <span class="block mono text-quiet font-normal">{{ track.length }}</span></th>
              <td v-for="(p, i) in fees.periods.value" :key="p.id" class="p-3 sm:p-6 led text-[2rem] sm:text-[3.5rem]" :class="i === fees.current.value ? '' : '!text-quiet'" :data-current="i === fees.current.value ? '' : undefined">{{ track.prices?.[i]?.price ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-6 grid md:grid-cols-3 gap-x-8 gap-y-5 text-[0.98rem]">
        <p v-if="block.included.length" class="text-quiet">{{ block.pricesNote }} <span class="text-text">{{ block.includedTitle }}</span> {{ tidyText(block.included.map((l) => l.text).join(', ')) }}.</p>
        <p v-for="note in block.notes" :key="note.id" class="text-quiet">{{ tidyText(note.text) }}</p>
      </div>
    </div>
  </section>
</template>
