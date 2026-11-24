<script setup lang="ts">
// Ode dveří's page of one room: the kind of room and its name over a large rounded photograph
// with the others beneath it, the beds and the area, what the room is like, its equipment as
// pills, and the price with a button to enquire.
import type { Room } from '../../lib/cms-content'

const props = defineProps<{ entry: Room }>()
const { words } = await useStay()
const { pricesOf } = await usePricing()
const draft = useStayDraft()
const room = computed(() => props.entry)
const title = computed(() => roomTitle(words.value, room.value))
const prices = computed(() => pricesOf(room.value.id))
const cheapest = computed(() => (prices.value.length ? Math.min(...prices.value.map((p) => p.amount)) : null))
// The photograph shown large (its place in the gallery); the others are small beneath it.
const shown = ref(0)
const text = computed(() => paragraphs(room.value.description || room.value.summary))
const stay = () => { draft.value = { ...draft.value, room: title.value } }
</script>

<template>
  <article class="wrap pt-4 md:pt-8 pb-20 md:pb-28">
    <NuxtLink :to="`/#${anchorOf('rooms')}`" class="tlink"><UIcon name="i-lucide-arrow-left" class="size-[1em]" aria-hidden="true" />{{ words.backToRooms }}</NuxtLink>

    <div class="mt-4 grid lg:grid-cols-12 gap-x-12 gap-y-8">
      <div class="lg:col-span-7">
        <div v-if="room.gallery.length" class="ph aspect-[3/2] !rounded-[28px]"><CmsImage :key="room.gallery[shown]!.id" :media="room.gallery[shown]!" eager sizes="(min-width: 1024px) 46rem, 100vw" /></div>
        <ul v-if="room.gallery.length > 1" class="mt-3 grid grid-cols-4 md:grid-cols-5 gap-3" :aria-label="words.roomPhotos">
          <li v-for="(g, i) in room.gallery" :key="g.id">
            <button type="button" class="ph !rounded-[14px] block w-full aspect-[4/3] cursor-pointer" :class="shown === i ? 'outline outline-2 outline-offset-2 outline-brand' : ''" :aria-label="g.alt || `${words.roomPhotos} ${i + 1}`" :aria-current="shown === i" @click="shown = i">
              <CmsImage :media="g" sizes="10rem" />
            </button>
          </li>
        </ul>
      </div>

      <div class="lg:col-span-5">
        <p class="text-quiet font-medium">{{ words.kind[room.kind] }} {{ words.floorIn[room.floor] }}</p>
        <h1 class="h2 mt-2 text-[2.3rem] md:text-[2.8rem]">{{ room.name }}</h1>
        <p class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-ink font-medium">
          <span class="inline-flex items-center gap-2"><UIcon name="i-lucide-bed-double" class="size-[1.125rem] text-brand" aria-hidden="true" />{{ words.beds(room.beds) }}</span>
          <span v-if="room.area" class="inline-flex items-center gap-2"><UIcon name="i-lucide-scan" class="size-[1.125rem] text-brand" aria-hidden="true" />{{ room.area }} m²</span>
        </p>
        <div class="mt-5 space-y-4 max-w-[46ch]">
          <p v-for="(p, i) in text" :key="i" :class="i === 0 ? '' : 'text-quiet'">{{ tidyText(p) }}</p>
        </div>
        <ul v-if="room.equipment.length" class="mt-5 flex flex-wrap gap-2"><li v-for="e in room.equipment" :key="e.id" class="pill">{{ e.text }}</li></ul>

        <div v-if="prices.length" class="mt-6 pt-6 rule num">
          <p v-if="cheapest != null" class="text-ink leading-tight"><span class="text-quiet">{{ words.from }}</span> <span class="text-[1.9rem] font-semibold tracking-[-0.02em]">{{ formatPrice(cheapest) }}&nbsp;Kč</span> <span class="text-quiet">{{ words.perNight }}</span></p>
          <dl class="mt-4 rounded-[24px] bg-soft p-5">
            <div v-for="(p, i) in prices" :key="p.season.id" class="py-2.5 flex justify-between gap-4" :class="i ? 'rule' : ''"><dt>{{ p.season.name }}</dt><dd class="font-semibold text-ink whitespace-nowrap">{{ formatPrice(p.amount) }}&nbsp;Kč</dd></div>
          </dl>
          <NuxtLink :to="`/#${anchorOf('enquiry')}`" class="btn mt-6" data-enquire @click="stay">{{ words.askStay }}</NuxtLink>
        </div>
      </div>
    </div>
  </article>
</template>
