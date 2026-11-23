<script setup lang="ts">
// Celý rok's rooms: two large cards to a row, each with a photograph and its counter, the name
// and the price from on one line, the beds, the area and the floor, a sentence, and the price
// in each season under a hairline.
import type { Season } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'rooms'>; first?: boolean; anchor?: string; rooms: RoomRow[]; seasons: Season[] }>()
const { words } = await useStay()
const draft = useStayDraft()
const stay = (title: string) => { draft.value = { ...draft.value, room: title } }
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-24">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="text-quiet max-w-[46ch]">{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-12 grid md:grid-cols-2 gap-x-10 gap-y-14">
      <article v-for="r in rooms" :key="r.room.id" class="room" :data-room="r.room.slug">
        <NuxtLink v-if="r.room.gallery[0]" :to="roomHref(r.room)" class="ph block aspect-[3/2]" :aria-label="roomTitle(words, r.room)">
          <CmsImage :media="r.room.gallery[0]" sizes="(min-width: 768px) 40rem, 100vw" />
          <span class="chip left-0 bottom-0"><UIcon name="i-lucide-images" class="size-[1em]" aria-hidden="true" />1 / {{ r.room.gallery.length }}</span>
        </NuxtLink>
        <div class="mt-5 flex items-baseline justify-between gap-6">
          <h3 class="text-[1.9rem] leading-tight"><NuxtLink :to="roomHref(r.room)" class="hover:text-brand transition-colors">{{ roomTitle(words, r.room) }}</NuxtLink></h3>
          <p v-if="r.from != null" class="text-right whitespace-nowrap"><span class="text-quiet text-sm">{{ words.from }}</span> <span class="font-display text-[1.9rem] leading-tight text-brand num">{{ formatPrice(r.from) }}&nbsp;Kč</span></p>
        </div>
        <div class="mt-1 flex items-baseline justify-between gap-6 text-quiet">
          <p>{{ roomFacts(words, r.room).join(' · ') }}</p>
          <p class="text-sm text-right">{{ words.perNightBreakfast }}</p>
        </div>
        <p v-if="r.room.summary" class="mt-4 max-w-[52ch]">{{ tidyText(r.room.summary) }}</p>
        <dl v-if="r.prices.length" class="mt-5 grid rule" :style="{ gridTemplateColumns: `repeat(${r.prices.length}, minmax(0, 1fr))` }">
          <div v-for="p in r.prices" :key="p.season.id" class="py-3"><dt class="text-sm text-quiet flex items-center gap-2"><span class="sw" :class="`sw-${p.season.tone}`" />{{ p.season.shortName || p.season.name }}</dt><dd class="num font-semibold">{{ formatPrice(p.amount) }}&nbsp;Kč</dd></div>
        </dl>
        <div class="flex flex-wrap gap-x-8">
          <NuxtLink :to="`/#${anchorOf('enquiry')}`" class="tlink" data-enquire @click="stay(roomTitle(words, r.room))">{{ words.askRoom(words.kind[r.room.kind], r.room.name) }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
          <NuxtLink :to="roomHref(r.room)" class="tlink max-sm:hidden">{{ words.moreAboutRoom }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
        </div>
      </article>
    </div>
  </section>
</template>
