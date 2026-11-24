<script setup lang="ts">
// Časomíra's results: a finish board. One row for each winner, the times lit in the dot-matrix
// face, a photograph from the finish beside it.
import type { ResultGroup } from '../../utils/site'

const props = defineProps<{ block: BlockOf<'results'>; first?: boolean; anchor?: string; groups: ResultGroup[] }>()
const { words } = await useEvent()
const rows = computed(() => props.groups.flatMap((g) => g.rows))
</script>

<template>
  <section :id="anchor" class="border-t border-line py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div :class="block.image ? 'lg:col-span-8' : 'lg:col-span-12'">
        <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-quiet max-w-[36rem]">{{ tidyText(block.text) }}</p>
        <div class="mt-8 border-t border-line">
          <div class="hidden sm:grid grid-cols-[6rem_3rem_1fr_9.5rem] gap-x-4 py-2 mono text-quiet" aria-hidden="true"><span>{{ words.track }}</span><span>{{ words.category }}</span><span>{{ words.winner }}</span><span class="text-right">{{ words.time }}</span></div>
          <ul v-if="rows.length">
            <li v-for="(r, i) in rows" :key="r.id" class="grid grid-cols-[1fr_auto] sm:grid-cols-[5.5rem_2.5rem_1fr_auto] gap-x-4 items-baseline py-3.5" :class="i === rows.length - 1 ? 'border-y border-line' : 'border-t border-line'">
              <span class="font-mono">{{ r.track?.length }}<span class="sm:hidden text-quiet"> · {{ r.category.toLowerCase() }}</span></span><span class="mono text-quiet hidden sm:block">{{ r.category.charAt(0).toUpperCase() }}</span>
              <span class="order-3 sm:order-none col-span-2 sm:col-span-1 mt-1 sm:mt-0">
                <span v-if="block.all" class="mono text-quiet">{{ r.place }}. </span><span class="text-xl font-bold tracking-[-0.02em]">{{ r.name }}</span> <span v-if="r.record" class="mono text-led">{{ words.record }}</span><span v-if="r.club" class="block text-quiet text-[0.95rem]">{{ r.club }}</span>
              </span>
              <span class="led order-2 sm:order-none whitespace-nowrap text-[1.9rem] sm:text-[2.6rem] text-right">
                <template v-for="(part, j) in timeParts(r.time)" :key="j"><span v-if="j" class="c">:</span>{{ part }}</template>
              </span>
            </li>
          </ul>
          <p v-else class="py-6 text-quiet border-b border-line">{{ words.noResults }}</p>
        </div>
        <div v-if="block.links.length" class="mt-7 flex flex-wrap items-center gap-x-8 gap-y-2">
          <template v-for="(l, i) in block.links" :key="l.id">
            <NuxtLink v-if="i === 0" :to="siteHref(l.url)" class="btn btn-line">{{ l.label }} <UIcon name="i-lucide-arrow-right" class="ico" aria-hidden="true" /></NuxtLink>
            <NuxtLink v-else :to="siteHref(l.url)" class="ulink mono">{{ l.label }}</NuxtLink>
          </template>
        </div>
      </div>
      <figure v-if="block.image" class="lg:col-span-4">
        <CmsImage :media="block.image" sizes="(min-width: 1024px) 28rem, 100vw" class="ph w-full h-full max-h-[44rem] aspect-[4/5] lg:aspect-auto object-cover rounded-[6px]" />
      </figure>
    </div>
  </section>
</template>
