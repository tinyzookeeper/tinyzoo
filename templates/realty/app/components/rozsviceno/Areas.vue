<script setup lang="ts">
// Rozsvíceno's "where we work": the photograph of the region in a rounded frame, and the places
// as windows of a street: lit (and a link to the properties there) where something is on
// offer, dark where the agency takes a property on by arrangement.
import type { Area } from '~/lib/cms-content'

type Place = Area & { count: number }
defineProps<{ block: BlockOf<'areas'>; first?: boolean; anchor?: string; places: Place[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-16 md:pt-32 grid lg:grid-cols-12 gap-x-12 gap-y-10 items-center">
    <div class="lg:col-span-6">
      <div class="aspect-[4/3] rounded-[2rem] overflow-hidden bg-surface"><CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 38rem, 100vw" class="w-full h-full object-cover" /></div>
    </div>
    <div class="lg:col-span-6">
      <p v-if="block.eyebrow" class="hand text-[1.2rem]">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.3rem] md:text-[3.2rem]"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'hand' }" /></component>
      <p v-if="block.text" class="mt-5 text-quiet max-w-[34rem]">{{ tidyText(block.text) }}</p>
      <ul class="mt-7 flex flex-wrap gap-2.5">
        <li v-for="p in places" :key="p.id">
          <NuxtLink v-if="!p.onRequest && p.count" class="lit" :to="`/nabidka?town=${encodeURIComponent(p.name)}`">{{ p.name }} <small class="num">{{ p.count }}</small></NuxtLink>
          <span v-else class="unlit">{{ p.name }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
