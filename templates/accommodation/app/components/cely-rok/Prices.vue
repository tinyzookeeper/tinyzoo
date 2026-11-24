<script setup lang="ts">
// Celý rok's price list on the raised surface: the table of rooms against seasons with a
// swatch for each, then what is included, the extra charges and what is good to know in three columns.
import type { Season } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; rooms: RoomRow[]; seasons: Season[] }>()
const { words } = await useStay()
// (the detail after "Snídani ·": a leading comma belongs to the other look's wording)
const detail = (text: string | null | undefined) => (text ?? '').replace(/^[\s,;·]+/, '')
</script>

<template>
  <section :id="anchor" class="mt-20 md:mt-24 bg-surface">
    <div class="wrap py-20 md:py-24">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6">
        <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-5"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="lg:col-span-5 lg:col-start-8 text-quiet">{{ tidyText(block.text) }}</p>
      </div>

      <div class="mt-10 md:mt-14">
        <table class="w-full text-left num">
          <caption class="sr-only">{{ words.priceTable }}</caption>
          <thead>
            <tr class="align-bottom">
              <th scope="col" class="py-4 pr-3 font-normal label w-[34%]">{{ words.room }}</th>
              <th v-for="(s, i) in seasons" :key="s.id" scope="col" class="py-4 text-right font-normal" :class="i === seasons.length - 1 ? 'pl-2 md:pl-4' : 'px-2 md:px-4'">
                <span class="flex items-center justify-end gap-2 font-semibold text-sm md:text-base"><span class="sw hidden sm:inline-block" :class="`sw-${s.tone}`" />{{ s.name }}</span>
                <span class="hidden md:block text-sm text-quiet">{{ seasonDates(s, ', ') }}</span>
              </th>
            </tr>
          </thead>
          <tbody class="text-[1rem] md:text-xl">
            <tr v-for="r in rooms" :key="r.room.id" class="rule">
              <th scope="row" class="py-4 md:py-5 pr-3 font-normal"><span class="font-display text-xl md:text-2xl block leading-tight">{{ r.room.name }}</span><span class="text-sm text-quiet font-sans">{{ words.kind[r.room.kind].toLowerCase() }} · {{ words.beds(r.room.beds) }}</span></th>
              <td v-for="(amount, i) in r.amounts" :key="i" class="py-4 text-right whitespace-nowrap" :class="i === r.amounts.length - 1 ? 'pl-2 md:pl-4' : 'px-2 md:px-4'"><template v-if="amount != null">{{ formatPrice(amount) }} <span class="hidden sm:inline">Kč</span></template><template v-else>–</template></td>
            </tr>
            <tr v-if="seasons.some((s) => s.minNights)" class="rule text-sm md:text-base text-quiet">
              <th scope="row" class="py-4 pr-3 font-normal">{{ words.shortestStay }}</th>
              <td v-for="(s, i) in seasons" :key="s.id" class="py-4 text-right" :class="i === seasons.length - 1 ? 'pl-2 md:pl-4' : 'px-2 md:px-4'">{{ s.minNights ? words.nights(s.minNights) : '' }}</td>
            </tr>
          </tbody>
        </table>
        <p class="sm:hidden mt-2 text-sm text-quiet">{{ words.pricesPerNight }}</p>
      </div>

      <div class="mt-14 md:mt-20 grid lg:grid-cols-12 gap-x-10 gap-y-12">
        <div v-if="block.included.length" class="lg:col-span-5">
          <h3 class="text-2xl">{{ block.includedHeading }}</h3>
          <ul class="mt-5">
            <li v-for="i in block.included" :key="i.id" class="rule py-3 flex gap-3"><UIcon name="i-lucide-check" class="size-[1em] text-brand mt-1.5 flex-none" aria-hidden="true" /><span><strong class="font-semibold">{{ i.label }}</strong> <span v-if="detail(i.text)" class="text-quiet">· {{ detail(i.text) }}</span></span></li>
          </ul>
        </div>
        <div v-if="block.extras.length" class="lg:col-span-3 lg:col-start-7">
          <h3 class="text-2xl">{{ block.extrasHeading }}</h3>
          <dl class="mt-5 num">
            <div v-for="e in block.extras" :key="e.id" class="rule py-3 flex justify-between gap-4"><dt>{{ e.label }}<template v-if="e.note">{{ ' ' }}<span class="text-quiet">{{ e.note }}</span></template></dt><dd class="text-right whitespace-nowrap">{{ e.price }}</dd></div>
          </dl>
        </div>
        <div v-if="block.notes.length" class="lg:col-span-3 lg:col-start-10">
          <h3 v-if="block.notesHeading" class="text-2xl">{{ block.notesHeading }}</h3>
          <ul class="mt-5 text-quiet">
            <li v-for="n in block.notes" :key="n.id" class="rule py-3">{{ tidyText(n.text) }}</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
