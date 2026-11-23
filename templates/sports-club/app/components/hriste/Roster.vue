<script setup lang="ts">
// Hřiště's squad: four colour portraits with the shirt number beside the name, then everybody in
// a list by number, in two or three columns.
import type { Player } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'roster'>; first?: boolean; anchor?: string; players: Player[] }>()
const words = useSiteWords()
const portraits = computed(() => portraitPlayers(props.players))
const byNumber = computed(() => [...props.players].sort((a, b) => (a.number ?? 999) - (b.number ?? 999)))
const line = computed(() => [props.block.season, props.block.staff.map((s) => words.value.coachOf(s.role, s.name)).join(', ')].filter(Boolean).join(' · '))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-24">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
      <component :is="first ? 'h1' : 'h2'" class="disp text-[clamp(27px,2.8vw,36px)]"><span class="slash" aria-hidden="true" /><KitMarked :text="block.heading" plain /></component>
      <p v-if="line" class="text-quiet">{{ line }}</p>
    </div>
    <ul v-if="portraits.length" class="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:mt-8 lg:grid-cols-4 lg:gap-x-6">
      <li v-for="p in portraits" :key="p.id">
        <div class="photo !rounded-3xl"><CmsImage :media="p.photo" sizes="(min-width: 1024px) 18rem, 45vw" class="aspect-[4/5] w-full object-cover object-top" /></div>
        <div class="mt-3 flex items-center gap-3">
          <span v-if="p.number != null" class="num w-9 flex-none text-center text-[34px] text-brand lg:w-12 lg:text-[44px]">{{ p.number }}</span>
          <p class="leading-tight"><span class="block font-display text-[17px] font-extrabold lg:text-[20px]">{{ p.name }}</span><span class="text-[14.5px] text-quiet">{{ playerLine(p, words) }}</span></p>
        </div>
      </li>
    </ul>
    <ol class="gap-x-10 border-t border-line sm:columns-2 lg:columns-3 lg:gap-x-14" :class="portraits.length ? 'mt-8 lg:mt-10' : 'mt-6 lg:mt-8'">
      <li v-for="p in byNumber" :key="p.id" class="flex break-inside-avoid items-baseline gap-3.5 border-b border-line py-2.5">
        <span class="num w-7 flex-none text-right text-[19px] text-brand">{{ p.number }}</span><span class="font-semibold">{{ p.name }}</span><span class="ml-auto text-right text-[14.5px] text-quiet">{{ playerLine(p, words) }}</span>
      </li>
    </ol>
  </section>
</template>
