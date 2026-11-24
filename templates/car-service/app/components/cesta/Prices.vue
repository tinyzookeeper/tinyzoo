<script setup lang="ts">
// Cesta's price guide: a sticky column (heading, note, list of the groups) and one soft white
// surface for every group, closable, with ruled rows: name with a short text, duration, price.
// On a phone the groups after the second start closed; a link from the list opens its group.
import type { PriceGroup } from '../../utils/site'

const props = defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; sets: PriceGroup[] }>()
const { words } = await useGarage()
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
})
const unit = (u: string) => (u === 'hour' ? words.value.unitShort.hour : u === 'season' ? words.value.unitShort.season : '')
</script>

<template>
  <section :id="anchor" class="bg-paper py-16 lg:py-24 scroll-mt-4">
    <div class="wrap grid lg:grid-cols-12 gap-x-14 gap-y-10">
      <aside class="lg:col-span-4">
        <div class="lg:sticky lg:top-8">
          <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-2 font-extrabold text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
          <p v-if="block.text" class="mt-5 text-quiet max-w-[26em]">{{ tidyText(block.text) }}</p>
          <nav class="mt-9 hidden lg:block" :aria-label="words.groupsNav">
            <ul class="font-display font-semibold text-[19px]">
              <li v-for="s in sets" :key="s.group.id">
                <a :href="`#g-${s.group.slug}`" class="flex items-baseline justify-between gap-3 py-3 border-b border-[color-mix(in_srgb,var(--ink)_12%,transparent)] hover:text-brand transition-colors" @click="focus = { slug: s.group.slug, at: Date.now() }">
                  <span>{{ s.group.name }}</span><span class="font-sans font-normal text-[15px] text-quiet">{{ words.itemsCount(s.items.length) }}</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </aside>
      <div class="lg:col-span-8 space-y-5">
        <details v-for="s in sets" :data-group="s.group.slug" :id="`g-${s.group.slug}`" :key="s.group.id" class="group rounded-[28px] bg-white scroll-mt-6" :class="flash === s.group.slug ? 'flash' : ''" :open="open[s.group.slug]" @toggle="open[s.group.slug] = ($event.target as HTMLDetailsElement).open">
          <summary class="flex items-center gap-4 sm:gap-5 px-6 sm:px-9 py-6 sm:py-7 rounded-[28px]">
            <span class="disc" aria-hidden="true"><UIcon :name="GROUP_ICONS[s.group.icon]" /></span>
            <div class="flex-1">
              <h3 class="font-bold text-[25px] sm:text-[28px]">{{ s.group.name }}</h3>
              <p v-if="s.group.summary" class="text-[16px] text-quiet leading-snug mt-1">{{ tidyText(s.group.summary) }}</p>
            </div>
            <UIcon name="i-lucide-chevron-down" class="size-6 text-quiet transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul class="px-6 sm:px-9 pb-5">
            <li v-for="i in s.items" data-price-row :key="i.id" class="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_92px_150px] gap-x-5 items-baseline py-3.5 border-t border-line">
              <p class="leading-snug"><span class="font-semibold text-[18px]">{{ i.name }}</span><span v-if="i.text" class="block text-[15.5px] text-quiet mt-0.5">{{ i.text }}</span></p>
              <p class="hidden sm:block text-[16px] text-quiet whitespace-nowrap">{{ i.duration }}</p>
              <p class="num text-right font-bold text-[20px] whitespace-nowrap row-start-1 col-start-2 sm:col-start-3"><span v-if="i.priceFrom" class="font-sans font-normal text-[15px] text-quiet mr-1.5">{{ words.from }}</span>{{ priceOf(i) }}<span v-if="unit(i.unit)" class="font-sans font-normal text-[15px] text-quiet">&nbsp;{{ unit(i.unit).replace(' ', ' ') }}</span></p>
              <p v-if="i.duration" class="sm:hidden col-span-2 text-[15px] text-quiet mt-1">{{ words.lasts(i.duration) }}</p>
            </li>
          </ul>
        </details>
      </div>
    </div>
  </section>
</template>
