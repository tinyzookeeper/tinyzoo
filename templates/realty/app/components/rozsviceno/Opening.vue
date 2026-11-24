<script setup lang="ts">
// Rozsvíceno's opening: a greeting, the question as the heading and the search written as a
// sentence ("Hledám byt ke koupi v Písku a okolí do 5 mil. Kč"), each choice a dashed word as
// wide as its own text; beside them the newest property in a window with a round price sticker.
import type { Listing } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; listings: Listing[]; total: number; fresh: Listing[]; featured: Listing | null }>()
const { settings, words } = await useOffice()
const w = words.value.rozsviceno
const search = useListingSearch(() => props.listings, () => props.anchor)
const cover = computed(() => props.featured?.photos[0] ?? null)
const stickerLines = computed(() => {
  const l = props.featured
  return l ? { state: l.state !== 'none' ? words.value.state[l.state] : words.value.deal[l.deal], price: l.deal === 'rent' ? `${priceKc(l.price)}\u00A0${w.perMonth}` : priceMil(l.price), what: w.sticker(words.value.kind[l.kind].toLowerCase(), l.layout ?? ''), place: placeOf(l) } : null
})
// The price the sentence starts with: the first step that covers the middle of the properties on sale, so the sentence reads as the design's ("do 5 mil. Kč").
const started = ref(false)
watch(search.steps, (steps) => {
  if (started.value || !steps.length) return
  const prices = props.listings.filter((l) => l.deal === search.draft.deal).map((l) => l.price ?? 0).sort((a, b) => a - b)
  const middle = prices[Math.floor(prices.length / 2)] ?? 0
  search.draft.max = steps.find((s) => s >= middle) ?? 0
  started.value = true
}, { immediate: true })

// Every choice is as wide as the words it shows: measured after the page is drawn (fonts
// loaded) and again when a choice or the window changes. Until then each is as wide as its longest option.
const form = ref<HTMLFormElement | null>(null)
let canvas: CanvasRenderingContext2D | null = null
function sizeAll() {
  const selects = [...(form.value?.querySelectorAll<HTMLSelectElement>('.say select') ?? [])]
  canvas ??= document.createElement('canvas').getContext('2d')
  if (!canvas) return
  for (const sel of selects) {
    const cs = getComputedStyle(sel)
    canvas.font = cs.font
    const text = sel.options[sel.selectedIndex]?.text ?? ''
    sel.style.width = `${Math.ceil(canvas.measureText(text).width + Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight) + 2)}px`
  }
}
onMounted(() => {
  sizeAll()
  document.fonts?.ready.then(sizeAll)
  window.addEventListener('resize', sizeAll)
})
onBeforeUnmount(() => { if (import.meta.client) window.removeEventListener('resize', sizeAll) })
watch(() => [search.draft.kind, search.draft.deal, search.draft.town, search.draft.max, search.towns.value.length, search.steps.value.length], () => nextTick(sizeAll))
</script>

<template>
  <section class="wrap pt-6 md:pt-10 pb-6">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-12 items-center">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="hand text-[1.25rem] md:text-[1.45rem]">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3" :class="byLength(block.heading, [[26, 'text-[3.1rem] md:text-[4.6rem] xl:text-[5.4rem] leading-[0.98]'], [48, 'text-[2.4rem] md:text-[3.4rem] xl:text-[4rem] leading-[1]']], 'text-[2rem] md:text-[2.6rem] xl:text-[3rem] leading-[1.05]')"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'hand' }" /></component>

        <form v-if="search.kinds.value.length" ref="form" class="mt-8 md:mt-10 p-6 md:p-8 rounded-[2rem] bg-surface shadow-[inset_0_0_0_1px_var(--line)]" :action="`#${anchor}`" :aria-label="w.searchLabel" data-search @submit.prevent="search.submit">
          <p class="say">
            {{ w.iSearch }}
            <select v-model="search.draft.kind" :aria-label="w.kindLabel"><option v-for="k in search.kinds.value" :key="k" :value="k">{{ w.kinds[k] }}</option></select>{{ ' ' }}
            <select v-model="search.draft.deal" :aria-label="w.dealLabel" data-typ><option v-for="d in search.deals.value" :key="d" :value="d">{{ w.deals[d] }}</option></select>{{ ' ' }}
            <select v-model="search.draft.town" :aria-label="w.placeLabel"><option value="all">{{ w.anywhere(settings?.townIn || settings?.town || '') }}</option><option v-for="t in search.towns.value" :key="t.value" :value="t.value">{{ t.labelIn }}</option></select>{{ ' ' }}
            <select v-model.number="search.draft.max" :aria-label="w.priceLabel"><option v-for="s in search.steps.value" :key="s" :value="s">{{ w.maxOf(s, search.draft.deal) }}</option><option :value="0">{{ w.noLimit }}</option></select>.
          </p>
          <div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button class="btn" type="submit">{{ w.go }} <UIcon name="i-lucide-arrow-right" class="ic size-4" aria-hidden="true" /></button>
            <p class="text-quiet text-[0.97rem]">{{ w.inOffer(total, fresh.length) }}</p>
          </div>
        </form>

        <p v-if="settings?.phone" class="mt-6 text-quiet">{{ w.rather }} <a class="text-cream font-semibold underline decoration-lamp decoration-2 underline-offset-4 hover:text-lamp transition-colors py-2" :href="telHref(settings.phone)">{{ settings.phone }}</a><template v-if="settings.hours">, {{ w.hours(settings.hours) }}</template></p>
      </div>

      <div class="lg:col-span-5 relative">
        <div class="window aspect-[1/1.02] sm:aspect-[4/3] lg:aspect-[1/1.12]">
          <CmsImage v-if="cover" :media="cover" eager sizes="(min-width: 1024px) 34rem, 100vw" :style="{ objectPosition: '88% 50%' }" />
        </div>
        <NuxtLink v-if="featured && stickerLines" :to="`/nabidka/${featured.slug}`" class="absolute -left-1 md:-left-8 -bottom-5 w-[9.6rem] h-[9.6rem] md:w-[10.5rem] md:h-[10.5rem] rounded-full bg-lamp text-lamp-ink flex flex-col items-center justify-center text-center -rotate-[8deg] transition-transform duration-300 hover:rotate-0 hover:scale-105 shadow-[0_14px_30px_-14px_rgba(0,0,0,.7)]">
          <span class="text-[0.78rem] font-semibold uppercase tracking-[0.12em]">{{ stickerLines.state }}</span>
          <span class="fig text-[1.4rem] md:text-[1.55rem] leading-[1.1] mt-1">{{ stickerLines.price }}</span>
          <span class="text-[0.86rem] font-medium leading-tight mt-1">{{ stickerLines.what }}<br>{{ stickerLines.place }}</span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
