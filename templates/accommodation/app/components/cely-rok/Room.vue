<script setup lang="ts">
// Celý rok's page of one room: the name over a large photograph with the others beneath it,
// the facts in Gloock, what the room is like, its equipment, and the price in each season.
import type { Room } from '~/lib/cms-content'

const props = defineProps<{ entry: Room }>()
const { words } = await useStay()
const { pricesOf } = await usePricing()
const draft = useStayDraft()
const room = computed(() => props.entry)
const title = computed(() => roomTitle(words.value, room.value))
const prices = computed(() => pricesOf(room.value.id))
// The photograph shown large (its place in the gallery); the others are small beneath it.
const shown = ref(0)
const text = computed(() => paragraphs(room.value.description || room.value.summary))
const stay = () => { draft.value = { ...draft.value, room: title.value } }
</script>

<template>
  <article class="wrap pt-6 md:pt-10 pb-20 md:pb-28">
    <NuxtLink :to="`/#${anchorOf('rooms')}`" class="tlink"><UIcon name="i-lucide-arrow-left" class="size-[1em]" aria-hidden="true" />{{ words.backToRooms }}</NuxtLink>

    <div class="mt-6 grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end">
      <div class="lg:col-span-8">
        <p class="label">{{ words.kind[room.kind] }} · {{ words.floor[room.floor] }}</p>
        <h1 class="h2 mt-3">{{ title }}</h1>
      </div>
      <p v-if="prices.length" class="lg:col-span-4 lg:text-right"><span class="text-quiet text-sm">{{ words.from }}</span> <span class="font-display text-[2.2rem] leading-tight text-brand num">{{ formatPrice(Math.min(...prices.map((p) => p.amount))) }}&nbsp;Kč</span> <span class="block text-sm text-quiet">{{ words.perNightBreakfast }}</span></p>
    </div>

    <div v-if="room.gallery.length" class="mt-10">
      <div class="ph aspect-[3/2]"><CmsImage :key="room.gallery[shown]!.id" :media="room.gallery[shown]!" eager sizes="(min-width: 1280px) 76rem, 100vw" /></div>
      <ul v-if="room.gallery.length > 1" class="mt-1 grid grid-cols-4 md:grid-cols-6 gap-1" :aria-label="words.roomPhotos">
        <li v-for="(g, i) in room.gallery" :key="g.id">
          <button type="button" class="ph block w-full aspect-[4/3] cursor-pointer" :class="shown === i ? 'outline outline-2 -outline-offset-2 outline-brand' : ''" :aria-label="g.alt || `${words.roomPhotos} ${i + 1}`" :aria-current="shown === i" @click="shown = i">
            <CmsImage :media="g" sizes="12rem" />
          </button>
        </li>
      </ul>
    </div>

    <div class="mt-12 md:mt-16 grid lg:grid-cols-12 gap-x-10 gap-y-12">
      <div class="lg:col-span-6">
        <dl class="grid grid-cols-3 gap-x-6 num">
          <div class="rule py-4"><dt class="text-sm text-quiet">{{ words.roomFacts.beds }}</dt><dd class="font-display text-2xl">{{ room.beds }}</dd></div>
          <div v-if="room.area" class="rule py-4"><dt class="text-sm text-quiet">{{ words.roomFacts.area }}</dt><dd class="font-display text-2xl">{{ room.area }} m²</dd></div>
          <div class="rule py-4"><dt class="text-sm text-quiet">{{ words.roomFacts.floor }}</dt><dd class="font-display text-2xl">{{ words.floor[room.floor] }}</dd></div>
        </dl>
        <div class="mt-8 space-y-4 max-w-[54ch]">
          <p v-for="(p, i) in text" :key="i" :class="i === 0 ? 'font-display text-[1.45rem] leading-snug' : 'text-quiet'">{{ tidyText(p) }}</p>
        </div>
      </div>
      <div class="lg:col-span-5 lg:col-start-8">
        <div v-if="room.equipment.length">
          <h2 class="text-2xl">{{ words.roomEquipment }}</h2>
          <ul class="mt-5">
            <li v-for="e in room.equipment" :key="e.id" class="rule py-3 flex gap-3"><UIcon name="i-lucide-check" class="size-[1em] text-brand mt-1.5 flex-none" aria-hidden="true" />{{ e.text }}</li>
          </ul>
        </div>
        <div v-if="prices.length" class="mt-10">
          <h2 class="text-2xl">{{ words.roomPrices }}</h2>
          <dl class="mt-5 num">
            <div v-for="p in prices" :key="p.season.id" class="rule py-3 flex justify-between gap-4"><dt class="flex items-center gap-3"><span class="sw" :class="`sw-${p.season.tone}`" />{{ p.season.name }}</dt><dd class="font-semibold whitespace-nowrap">{{ formatPrice(p.amount) }}&nbsp;Kč</dd></div>
          </dl>
        </div>
        <NuxtLink :to="`/#${anchorOf('enquiry')}`" class="btn mt-10" data-enquire @click="stay">{{ words.askRoom(words.kind[room.kind], room.name) }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </article>
</template>
