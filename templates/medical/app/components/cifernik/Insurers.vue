<script setup lang="ts">
// Ciferník's insurers: "coins", each with the insurer's code in a ring and its name beside it.
import type { Insurer } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'insurers'>; first?: boolean; items: Insurer[] }>()
</script>

<template>
  <section class="wrap pt-14 lg:pt-20">
    <component :is="first ? 'h1' : 'h2'" class="text-[1.9rem] lg:text-[2.3rem] max-w-[40rem]"><KitMarked :text="block.heading" plain /></component>
    <ul class="mt-7 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
      <li v-for="i in items" :key="i.id" class="flex items-center gap-4">
        <span class="grid place-items-center size-[4.4rem] rounded-full bg-card shadow-[inset_0_0_0_2.5px_var(--ink)] disp text-[1.5rem] font-medium num shrink-0">{{ i.code }}</span>
        <span class="leading-snug"><strong class="text-ink block">{{ i.short }}</strong>{{ i.name }}</span>
      </li>
    </ul>
  </section>
</template>
