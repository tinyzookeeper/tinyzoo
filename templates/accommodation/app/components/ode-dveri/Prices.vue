<script setup lang="ts">
// Ode dveří's price list: a table without boxes, then what is included and the extra charges
// as two soft panels, and the notes as one quiet paragraph.
import type { Season } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; rooms: RoomRow[]; seasons: Season[] }>()
const { words } = await useStay()
// On a phone a season keeps to its short name when that is where its name begins ("Vánoce" for "Vánoce a Silvestr").
const narrow = (s: Season) => (s.shortName && s.name.startsWith(s.shortName) ? s.shortName : s.name)
// What follows the item's name: after a comma written in the text, else a space.
const joined = (text: string | null | undefined) => (text ? (/^\s*[,.;]/.test(text) ? text.trim() : ` ${text}`) : '')
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
      <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-6"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="lg:col-span-5 lg:col-start-8 text-quiet">{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-8 md:mt-12">
      <table class="w-full table-fixed text-left num">
        <caption class="sr-only">{{ words.priceTable }}</caption>
        <thead>
          <tr class="align-bottom">
            <th scope="col" class="pb-4 pr-2 w-[34%] md:w-[31%] font-medium text-sm text-quiet">{{ words.room }}</th>
            <th v-for="(s, i) in seasons" :key="s.id" scope="col" class="pb-4 text-right font-normal" :class="i === seasons.length - 1 ? 'pl-2 md:pl-4' : 'px-2 md:px-4'">
              <span class="block font-semibold text-ink text-[0.95rem] md:text-lg leading-tight"><span class="md:hidden">{{ narrow(s) }}</span><span class="hidden md:inline">{{ s.name }}</span></span>
              <span class="hidden md:block mt-1 text-sm text-quiet">{{ seasonDates(s) }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="text-ink text-[1.05rem] md:text-[1.35rem] font-medium">
          <tr v-for="r in rooms" :key="r.room.id" class="rule">
            <th scope="row" class="py-4 md:py-5 pr-2 font-normal"><span class="flex items-center gap-2.5 font-semibold text-base md:text-xl">{{ r.room.name }}</span><span class="block text-sm text-quiet"><span class="hidden sm:inline">{{ words.kind[r.room.kind].toLowerCase() }}, </span>{{ words.beds(r.room.beds) }}</span></th>
            <td v-for="(amount, i) in r.amounts" :key="i" class="py-4 text-right whitespace-nowrap" :class="i === r.amounts.length - 1 ? 'pl-2 md:pl-4' : 'px-2 md:px-4'"><template v-if="amount != null">{{ formatPrice(amount) }} <span class="hidden sm:inline">Kč</span></template><template v-else>–</template></td>
          </tr>
          <tr v-if="seasons.some((s) => s.minNights)" class="rule text-sm md:text-base text-quiet font-normal">
            <th scope="row" class="py-4 pr-2 font-normal">{{ words.shortestStay }}</th>
            <td v-for="(s, i) in seasons" :key="s.id" class="py-4 text-right" :class="i === seasons.length - 1 ? 'pl-2 md:pl-4' : 'px-2 md:px-4'">{{ s.minNights ? words.nights(s.minNights) : '' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="md:hidden mt-1 text-sm text-quiet">{{ words.pricesPerNight }} <template v-for="s in seasons" :key="s.id">{{ s.name }}: {{ seasonDates(s) }} </template></p>
    </div>

    <div v-if="block.included.length || block.extras.length" class="mt-10 md:mt-12 grid lg:grid-cols-2 gap-5">
      <div v-if="block.included.length" class="rounded-[24px] bg-soft p-6 md:p-9">
        <h3 class="text-2xl">{{ block.includedHeading }}</h3>
        <ul class="mt-5 space-y-3">
          <li v-for="i in block.included" :key="i.id" class="flex gap-3"><UIcon name="i-lucide-check" class="mt-1 size-5 text-brand flex-none" aria-hidden="true" /><span><strong class="font-semibold text-ink">{{ i.label }}</strong>{{ joined(i.text) }}</span></li>
        </ul>
      </div>
      <div v-if="block.extras.length" class="rounded-[24px] bg-soft p-6 md:p-9">
        <h3 class="text-2xl">{{ block.extrasHeading }}</h3>
        <dl class="mt-5 num">
          <div v-for="(e, i) in block.extras" :key="e.id" class="py-2.5 flex justify-between gap-4" :class="i ? 'rule' : ''"><dt>{{ e.label }}<template v-if="e.note">{{ ' ' }}<span class="text-quiet">{{ e.note }}</span></template></dt><dd class="font-semibold text-ink text-right">{{ e.price }}</dd></div>
        </dl>
      </div>
    </div>
    <p v-if="block.notes.length" class="mt-6 text-quiet max-w-[72ch]">{{ tidyText(block.notes.map((n) => n.text).join(' ')) }}</p>
  </section>
</template>
