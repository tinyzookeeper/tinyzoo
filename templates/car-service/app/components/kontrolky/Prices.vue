<script setup lang="ts">
// Kontrolky's price guide: the groups as open lists in two columns, each headed by its warning
// light; a row is the name with a short text, then the price and the duration. A light of the row
// above opens its group and marks its name for a moment. On a phone the groups after the second
// start closed. Under the list: the two rates, the note and the warranty.
import type { PriceGroup } from '../../utils/site'

const props = defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; sets: PriceGroup[] }>()
const { settings, words } = await useGarage()
const open = reactive<Record<string, boolean>>({})
const flash = ref<string | null>(null)
for (const s of props.sets) open[s.group.slug] = true
// (closed after the first drawing: what the server writes and the browser's first drawing agree)
onMounted(() => {
  if (!window.matchMedia('(min-width: 64rem)').matches) props.sets.forEach((s, n) => { if (n > 1) open[s.group.slug] = false })
  // (an address that names a group, #g-pneuservis, opens it)
  const named = decodeURIComponent(location.hash).replace(/^#g-/, '')
  if (location.hash.startsWith('#g-') && named in open) open[named] = true
})
const focus = useGroupFocus()
watch(focus, (f) => {
  if (!f || !(f.slug in open)) return
  open[f.slug] = true
  flash.value = f.slug
  setTimeout(() => { if (flash.value === f.slug) flash.value = null }, 1800)
}, { immediate: true })
const under = (i: { unit: string; duration: string | null }) => (i.unit === 'hour' ? words.value.unitLong.hour : i.unit === 'season' ? words.value.unitLong.season : i.duration)
</script>

<template>
  <section :id="anchor" class="bg-panel py-16 lg:py-28 scroll-mt-2">
    <div class="wrap">
      <div class="grid lg:grid-cols-12 gap-x-14 gap-y-5 items-end">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="cap">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
        </div>
        <p v-if="block.text" class="lg:col-span-5 text-[16.5px] text-quiet">{{ tidyText(block.text) }}</p>
      </div>
      <div class="mt-12 lg:columns-2 lg:gap-x-16 [&>*]:mb-10">
        <details v-for="s in sets" :data-group="s.group.slug" :id="`g-${s.group.slug}`" :key="s.group.id" class="group break-inside-avoid scroll-mt-6" :class="flash === s.group.slug ? 'flash' : ''" :open="open[s.group.slug]" @toggle="open[s.group.slug] = ($event.target as HTMLDetailsElement).open">
          <summary class="flex items-center gap-4 pb-5 min-h-[56px]">
            <LampIcon :path="LAMP_PATHS[s.group.lamp]" class="text-[34px] flex-none" :style="{ color: LAMP_COLORS[s.group.lampColor] }" />
            <h3 class="flex-1 text-[26px] sm:text-[28px]">{{ s.group.name }}</h3>
            <span class="text-[15px] text-quiet whitespace-nowrap">{{ words.itemsCount(s.items.length) }}</span>
            <UIcon name="i-lucide-chevron-down" class="size-5 text-quiet transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul>
            <li v-for="i in s.items" data-price-row :key="i.id" class="flex items-start gap-5 py-4 border-t border-line">
              <p class="flex-1 leading-snug"><span class="font-medium text-[17px]">{{ i.name }}</span><span v-if="i.text" class="block text-[15px] text-quiet mt-1">{{ i.text }}</span></p>
              <p class="text-right leading-none whitespace-nowrap"><span class="dig text-[21px] font-semibold"><span v-if="i.priceFrom" class="font-sans text-[14px] font-normal text-quiet mr-1.5">{{ words.from }}</span>{{ priceOf(i) }}</span><span class="block text-[14.5px] text-quiet mt-2">{{ under(i) }}</span></p>
            </li>
          </ul>
        </details>
      </div>
      <p class="mt-2 pt-7 border-t border-line text-[16.5px] text-quiet">
        {{ words.hourlyRate }} <span class="dig text-text font-semibold text-[19px]">{{ priceOf({ price: settings?.hourlyRate ?? 0 }) }}</span><template v-if="settings?.diagnosticsRate">, {{ words.diagnostics }} <span class="dig text-text font-semibold text-[19px]">{{ priceOf({ price: settings.diagnosticsRate }) }}</span></template>. {{ tidyText(block.footnote) }}
      </p>
    </div>
  </section>
</template>
