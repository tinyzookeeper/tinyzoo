<script setup lang="ts">
// Šuplíky's price guide: the tool chest. A lid in the brand colour with the heading and the
// hourly rate on a label, then one drawer for every group, each with its aluminium pull and its
// label; an open drawer shows its lines on a cream liner in two columns. On a phone only the first
// two drawers start pulled out.
import type { PriceGroup } from '../../utils/site'

const props = defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; sets: PriceGroup[] }>()
const { settings, words } = await useGarage()
const open = reactive<Record<string, boolean>>({})
for (const s of props.sets) open[s.group.slug] = true
// (closed after the first drawing: what the server writes and the browser's first drawing agree)
onMounted(() => {
  if (!window.matchMedia('(min-width: 48rem)').matches) props.sets.forEach((s, n) => { if (n > 1) open[s.group.slug] = false })
  // (an address that names a group, #g-pneuservis, opens it)
  const named = decodeURIComponent(location.hash).replace(/^#g-/, '')
  if (location.hash.startsWith('#g-') && named in open) open[named] = true
})
const focus = useGroupFocus()
watch(focus, (f) => { if (f && f.slug in open) open[f.slug] = true })
const under = (i: { unit: string; duration: string | null }) => (i.unit === 'hour' ? words.value.unitLong.hour : i.unit === 'season' ? words.value.unitLong.season : i.duration)
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-24 scroll-mt-4">
    <div class="rounded-[34px] bg-brand-deep p-2.5 sm:p-4 shadow-[0_8px_0_rgba(0,0,0,.28)]">
      <div class="rounded-[24px] bg-brand text-white px-5 py-7 sm:px-9 sm:py-9 grid lg:grid-cols-12 gap-x-8 gap-y-6 items-end">
        <div class="lg:col-span-8">
          <p v-if="block.eyebrow" class="kicker text-white">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[40px] sm:text-[58px]">{{ plainEmphasis(block.heading) }}</component>
          <p v-if="block.text" class="mt-3 text-[16.5px] text-white/95 max-w-[38em]">{{ tidyText(block.text) }}</p>
        </div>
        <div v-if="settings?.hourlyRate" class="lg:col-span-4 lg:justify-self-end">
          <div class="tag px-5 py-3.5">
            <p class="text-[13px] font-semibold uppercase tracking-[0.06em] text-quiet">{{ words.hourlyRate }}</p>
            <p class="num text-[38px] leading-none mt-1">{{ priceOf({ price: settings.hourlyRate }) }}</p>
            <p v-if="settings.diagnosticsRate" class="text-[14px] mt-1.5">{{ words.diagnostics }} {{ priceOf({ price: settings.diagnosticsRate }) }}</p>
          </div>
        </div>
      </div>
      <div class="mt-2.5 sm:mt-3 space-y-2.5 sm:space-y-3">
        <details v-for="s in sets" :data-group="s.group.slug" :id="`g-${s.group.slug}`" :key="s.group.id" class="group rounded-[20px] overflow-hidden bg-brand scroll-mt-4" :open="open[s.group.slug]" @toggle="open[s.group.slug] = ($event.target as HTMLDetailsElement).open">
          <summary class="block text-white">
            <span class="pull" />
            <span class="flex items-center gap-4 px-4 sm:px-6 py-4 sm:py-5">
              <h3 class="tag px-4 py-2 sm:px-5 text-[23px] sm:text-[27px] leading-none">{{ s.group.name }}</h3>
              <span class="hidden sm:block text-[15px] text-white/90">{{ words.itemsCount(s.items.length) }} · {{ words.from }} {{ formatPrice(lowestPrice(s.items)) }}&nbsp;Kč</span>
              <span class="ml-auto grid place-items-center w-11 h-11 rounded-full bg-black/20 transition-transform group-open:rotate-180"><UIcon name="i-lucide-chevron-down" class="size-[22px]" aria-hidden="true" /></span>
            </span>
          </summary>
          <div class="mx-2 mb-2 sm:mx-3 sm:mb-3 rounded-[14px] bg-card text-ink px-4 sm:px-7 py-2 sm:py-3">
            <ul class="md:columns-2 md:gap-x-12">
              <li v-for="i in s.items" data-price-row :key="i.id" class="break-inside-avoid flex items-start gap-4 py-3.5 border-b-2 border-tint">
                <p class="flex-1 leading-snug"><span class="font-medium text-[17px]">{{ i.name }}</span><span v-if="i.text" class="block text-[14.5px] text-quiet mt-0.5">{{ i.text }}</span></p>
                <p class="text-right leading-none whitespace-nowrap"><span class="num text-[22px]"><span v-if="i.priceFrom" class="font-sans font-normal text-[14px] text-quiet mr-1">{{ words.from }}</span>{{ priceOf(i) }}</span><span class="block text-[13.5px] text-quiet mt-1.5">{{ under(i) }}</span></p>
              </li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  </section>
</template>
