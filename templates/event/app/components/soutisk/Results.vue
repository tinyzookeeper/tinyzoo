<script setup lang="ts">
// Soutisk's results: on dark ink, one rounded frame for each route, the winners with their
// times in the display face.
import type { ResultGroup } from '~/utils/site'

defineProps<{ block: BlockOf<'results'>; first?: boolean; anchor?: string; groups: ResultGroup[] }>()
const { words } = await useEvent()
</script>

<template>
  <section :id="anchor" class="on-dark relative bg-ink text-paper pt-6 sm:pt-10 pb-24 sm:pb-36" :class="first ? 'mt-14 sm:mt-28' : ''">
    <svg class="hills text-ink" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><use href="#soutisk-hl2" fill="currentColor" /></svg>
    <div class="wrap">
      <div class="grid lg:grid-cols-12 gap-x-8 gap-y-4 items-end">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="kicker text-c2">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        </div>
        <p v-if="block.text" class="lg:col-span-5 text-lg">{{ tidyText(block.text) }}</p>
      </div>
      <div v-if="groups.length" class="mt-10 grid md:grid-cols-3 gap-5">
        <div v-for="g in groups" :key="g.track.id" class="rounded-[28px] border-[2.5px] border-paper/30 p-6">
          <h3 class="flex items-baseline justify-between gap-3"><span class="disp text-[2.6rem] text-c2">{{ g.track.figure }} km</span><span class="font-bold">{{ g.track.name }}</span></h3>
          <dl class="mt-5">
            <div v-for="(r, i) in g.rows" :key="r.id" class="border-t-2 border-paper/20" :class="i === g.rows.length - 1 ? 'pt-4' : 'py-4'">
              <dt class="text-sm font-bold text-c2">{{ block.all ? `${r.place}. ` : '' }}{{ r.category }}<template v-if="r.record"> · {{ words.courseRecord }}</template></dt>
              <dd class="mt-1"><span class="font-bold text-xl block">{{ r.name }}</span><span v-if="r.club" class="block text-paper/80">{{ r.club }}</span><span class="disp text-[2rem] block mt-2">{{ r.time }}</span></dd>
            </div>
          </dl>
        </div>
      </div>
      <p v-else class="mt-10 text-lg">{{ words.noResults }}</p>
      <div v-if="block.links.length" class="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2">
        <template v-for="(l, i) in block.links" :key="l.id">
          <NuxtLink v-if="i === 0" :to="siteHref(l.url)" class="btn btn-light">{{ l.label }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
          <NuxtLink v-else :to="siteHref(l.url)" class="ulink">{{ l.label }}</NuxtLink>
        </template>
      </div>
    </div>
  </section>
</template>
