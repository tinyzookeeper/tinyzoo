<script setup lang="ts">
// Výloha's price list: one framed panel like a price list painted on glass. A centred heading, two
// columns of groups with flanked capitals, and rows with dotted leaders, minutes and price. The
// groups keep the editor's order and are split where the two columns come out most even; the
// shorter column ends with the note and a booking plate. One column on a phone.
const props = defineProps<{ block: BlockOf<'pricelist'>; first?: boolean; anchor?: string; groups: ServiceGroupWithItems[] }>()
const words = useSiteWords()
const choice = useBookingChoice()
// How tall a group is, roughly: a line each, and a little more for a note, and the heading.
const weight = (g: ServiceGroupWithItems) => g.items.length + g.items.filter((s) => s.note).length * 0.4 + 2
const split = computed(() => {
  const total = props.groups.reduce((a, g) => a + weight(g), 0)
  let at = 1
  let acc = 0
  let best = Infinity
  props.groups.slice(0, -1).forEach((g, i) => {
    acc += weight(g)
    if (Math.abs(total - 2 * acc) < best) { best = Math.abs(total - 2 * acc); at = i + 1 }
  })
  const columns = [props.groups.slice(0, at), props.groups.slice(at)]
  const shorter = columns[0]!.reduce((a, g) => a + weight(g), 0) <= total / 2 ? 0 : 1
  return { columns, shorter }
})
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28 scroll-mt-4">
    <div class="panel px-5 py-12 md:px-14 md:py-20" style="--r:26px">
      <div class="text-center max-w-[40rem] mx-auto">
        <p v-if="block.eyebrow" class="caps text-brass">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="lettering mt-4 text-[48px] md:text-[76px] leading-[1]">{{ tidyText(block.heading) }}</component>
        <p v-if="block.text" class="mt-6">{{ tidyText(block.text) }}</p>
      </div>
      <div class="mt-12 md:mt-16 grid lg:grid-cols-2 lg:gap-x-20">
        <div v-for="(col, ci) in split.columns" :key="ci" class="flex flex-col">
          <div v-for="g in col" :id="`g-${g.group.id}`" :key="g.group.id" class="pb-12 scroll-mt-6">
            <h3 class="flanked font-display uppercase tracking-[.2em] text-[17px] !text-brass">{{ g.group.name }}</h3>
            <ul class="mt-4">
              <li v-for="s in g.items" :key="s.id">
                <NuxtLink :to="`/#${anchorOf('booking')}`" :data-service-row="s.name" class="crow flex items-baseline gap-3 py-2.5 min-h-12" @click="choice.service.value = s.name">
                  <span class="min-w-0"><span class="cname text-[18px] text-cream transition-colors">{{ s.name }}</span><span class="block text-[14px] leading-snug"><span class="sm:hidden">{{ s.minutes }} {{ words.min }}{{ s.note ? ' · ' : '' }}</span>{{ s.note || '' }}</span></span>
                  <span class="leader" />
                  <span class="hidden sm:block text-[14px] whitespace-nowrap">{{ s.minutes }} {{ words.min }}</span>
                  <span class="sm:w-[7.2rem] text-right whitespace-nowrap font-display text-[21px] text-cream"><span v-if="s.priceFrom" class="font-sans text-[14px] mr-1.5" style="color:color-mix(in srgb,var(--cream) 80%,var(--glass))">{{ words.from }}</span>{{ kc(s.price) }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
          <div v-if="ci === split.shorter" class="hidden lg:block mt-auto pb-12 text-center">
            <p class="flanked" aria-hidden="true"><span class="dia" /></p>
            <p v-if="block.footnote" class="mt-7 font-display text-[22px] leading-[1.4] text-cream">{{ tidyText(block.footnote) }}</p>
            <NuxtLink :to="`/#${anchorOf('booking')}`" class="plate btn btn-cream mt-7">{{ words.book }}</NuxtLink>
          </div>
        </div>
      </div>
      <p v-if="block.footnote" class="lg:hidden text-center text-[15px]">{{ tidyText(block.footnote) }}</p>
    </div>
  </section>
</template>
