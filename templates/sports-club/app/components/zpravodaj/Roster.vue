<script setup lang="ts">
// Zpravodaj's squad: four framed portraits, then every player in four columns by position.
import type { Player } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'roster'>; first?: boolean; anchor?: string; players: Player[] }>()
const words = useSiteWords()
const portraits = computed(() => portraitPlayers(props.players))
const groups = computed(() => playersByRole(props.players))
const line = computed(() => [props.block.season, props.block.staff.map((s) => words.value.coachOf(s.role, s.name)).join(', ')].filter(Boolean).join(' · '))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 pt-16 lg:pt-20">
    <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b border-ink pb-4">
      <component :is="first ? 'h1' : 'h2'" class="text-[26px] font-bold leading-tight lg:text-[30px]"><KitMarked :text="block.heading" plain /></component>
      <p v-if="line" class="text-sm text-quiet">{{ line }}</p>
    </div>
    <div class="mt-8">
      <ul v-if="portraits.length" class="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:gap-x-8">
        <li v-for="p in portraits" :key="p.id">
          <div class="frame !p-1.5"><CmsImage :media="p.photo" sizes="(min-width: 1024px) 18rem, 45vw" class="aspect-[4/5] w-full object-cover object-top lg:aspect-[5/6]" /></div>
          <p class="mt-4 flex items-baseline gap-3"><span v-if="p.number != null" class="font-display text-[28px] font-extrabold leading-none text-brand">{{ p.number }}</span><span class="font-display text-[19px] font-bold leading-tight text-ink">{{ p.name }}</span></p>
          <p class="mt-1 text-sm text-quiet">{{ playerLine(p, words) }}</p>
        </li>
      </ul>
      <div class="grid grid-cols-2 gap-x-8 gap-y-7 text-[15px] lg:grid-cols-4" :class="portraits.length ? 'mt-12' : ''">
        <div v-for="g in groups" :key="g.role">
          <h3 class="label border-b border-ink pb-2 !font-sans !text-quiet">{{ words.roleGroups[g.role] }}</h3>
          <ul>
            <li v-for="p in g.players" :key="p.id" class="flex items-baseline gap-3 border-b border-line py-2"><span class="num w-6 shrink-0 text-right font-display font-extrabold text-brand">{{ p.number }}</span><span class="text-ink">{{ p.name }}</span></li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
