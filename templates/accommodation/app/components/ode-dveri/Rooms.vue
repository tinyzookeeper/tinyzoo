<script setup lang="ts">
// Ode dveří's rooms: wide rows that alternate sides, each a photograph with its counter beside
// the kind of room, the name, the beds and the area, a sentence, the equipment as soft pills,
// the price from with the other seasons under it, and a button.
import type { Season } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'rooms'>; first?: boolean; anchor?: string; rooms: RoomRow[]; seasons: Season[] }>()
const { words } = await useStay()
const draft = useStayDraft()
const stay = (title: string) => { draft.value = { ...draft.value, room: title } }
/** The seasons that cost more than the cheapest one, for the line under the price from. */
const others = (row: RoomRow) => row.prices.filter((p) => p.amount !== row.from)
</script>

<template>
  <section :id="anchor" class="wrap">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
      <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-6"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="lg:col-span-5 lg:col-start-8 text-quiet">{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-10 md:mt-14 flex flex-col gap-14 md:gap-20">
      <article v-for="(r, i) in rooms" :key="r.room.id" class="room grid lg:grid-cols-12 gap-x-12 gap-y-6 items-center" :data-room="r.room.slug">
        <NuxtLink v-if="r.room.gallery[0]" :to="roomHref(r.room)" class="lg:col-span-7 ph block aspect-[3/2]" :class="i % 2 ? 'lg:order-2' : ''" :aria-label="roomTitle(words, r.room)">
          <CmsImage :media="r.room.gallery[0]" sizes="(min-width: 1024px) 46rem, 100vw" />
          <span class="chip left-4 bottom-4"><UIcon name="i-lucide-images" class="size-[1em]" aria-hidden="true" />{{ words.photoCount(r.room.gallery.length) }}</span>
        </NuxtLink>
        <div class="lg:col-span-5">
          <p class="flex items-center gap-2.5 text-quiet font-medium">{{ words.kind[r.room.kind] }} {{ words.floorIn[r.room.floor] }}</p>
          <h3 class="mt-2 text-[2rem] md:text-[2.3rem]"><NuxtLink :to="roomHref(r.room)" class="hover:text-brand transition-colors">{{ r.room.name }}</NuxtLink></h3>
          <p class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-ink font-medium">
            <span class="inline-flex items-center gap-2"><UIcon name="i-lucide-bed-double" class="size-[1.125rem] text-brand" aria-hidden="true" />{{ words.beds(r.room.beds) }}</span>
            <span v-if="r.room.area" class="inline-flex items-center gap-2"><UIcon name="i-lucide-scan" class="size-[1.125rem] text-brand" aria-hidden="true" />{{ r.room.area }} m²</span>
          </p>
          <p v-if="r.room.summary" class="mt-4 max-w-[46ch]">{{ tidyText(r.room.summary) }}</p>
          <ul v-if="r.room.equipment.length" class="mt-4 flex flex-wrap gap-2"><li v-for="e in r.room.equipment" :key="e.id" class="pill">{{ e.text }}</li></ul>
          <div class="mt-6 pt-6 rule flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div class="num">
              <p v-if="r.from != null" class="text-ink leading-tight"><span class="text-quiet">{{ words.from }}</span> <span class="text-[1.9rem] font-semibold tracking-[-0.02em]">{{ formatPrice(r.from) }}&nbsp;Kč</span> <span class="text-quiet">{{ words.perNight }}</span></p>
              <p v-if="others(r).length" class="mt-1 text-sm text-quiet">{{ others(r).map((p) => `${p.season.shortName || p.season.name} ${formatPrice(p.amount)} Kč`).join(', ') }}</p>
            </div>
            <NuxtLink :to="`/#${anchorOf('enquiry')}`" class="btn" data-enquire @click="stay(roomTitle(words, r.room))">{{ words.askStay }}</NuxtLink>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
