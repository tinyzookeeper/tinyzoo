<script setup lang="ts">
// Reflex's price list: the main rates as black tiles with huge numerals, then every other line
// as one list whose row fills with the signal colour on hover, then what is always included as labels.
import type { Service } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; items: Service[] }>()
const words = useSiteWords()
const rates = computed(() => props.items.filter((s) => s.main))
const rows = computed(() => props.items.filter((s) => !s.main))
</script>

<template>
  <section :id="anchor" class="wrap pt-16 md:pt-24 pb-20 md:pb-28 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
      <div class="lg:col-span-8">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-4 text-[1.125rem] leading-[1.4] font-medium max-w-[30rem] lg:pb-2">{{ tidyText(block.text) }}</p>
    </div>

    <!-- The numbers to know before calling -->
    <div v-if="rates.length" class="mt-10 md:mt-14 grid md:grid-cols-3 gap-1 on-dark">
      <div v-for="s in rates" :key="s.id" class="bg-ink text-white p-5 md:p-7 flex md:flex-col justify-between gap-4 md:min-h-[15rem]" :data-service="s.id">
        <div><h3 class="text-[1.5rem] md:text-[1.75rem]">{{ s.name }}</h3><p v-if="s.text" class="mt-2 text-[1rem] text-[#d6d9d4] max-w-[16rem]">{{ tidyText(s.text) }}</p></div>
        <p class="font-cond font-black text-brand-lit text-[3.5rem] md:text-[4rem] lg:text-[6rem] leading-[0.85] tabular-nums whitespace-nowrap self-end md:self-start">{{ priceParts(s, words).amount }} <span class="text-[0.4em] tracking-[0.02em]">Kč</span></p>
      </div>
    </div>

    <ul v-if="rows.length" class="mt-12 md:mt-16 border-b-2 border-ink">
      <li v-for="s in rows" :key="s.id" class="prow" :data-service="s.id"><h4>{{ s.name }}</h4><p v-if="s.text">{{ tidyText(s.text) }}</p><span class="amt"><small v-if="s.from">{{ words.from }}</small> {{ priceParts(s, words).amount }} <small>Kč<template v-if="s.unit"> / {{ s.unit }}</template></small></span></li>
    </ul>

    <div v-if="block.included.length" class="mt-8 grid lg:grid-cols-12 gap-x-10 gap-y-4">
      <p v-if="block.includedTitle" class="lg:col-span-3 label pt-1">{{ block.includedTitle }}</p>
      <ul class="lg:col-span-9 flex flex-wrap gap-2 text-[1rem] font-bold">
        <li v-for="line in block.included" :key="line.id" class="px-3.5 py-2 border-2 border-ink">{{ tidyText(line.text) }}</li>
      </ul>
    </div>
  </section>
</template>
