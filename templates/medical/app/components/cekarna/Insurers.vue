<script setup lang="ts">
// Čekárna's insurers: the code in the brand colour, then the name, in two plain columns.
import type { Insurer } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'insurers'>; first?: boolean; items: Insurer[] }>()
</script>

<template>
  <section class="wrap pt-20 lg:pt-28">
    <div class="grid gap-7 lg:gap-20 lg:grid-cols-[21rem_1fr] items-start">
      <component :is="first ? 'h1' : 'h2'" class="text-[1.9rem] lg:text-[2.2rem]"><KitMarked :text="block.heading" plain /></component>
      <ul class="grid sm:grid-cols-2 gap-x-14 gap-y-3 text-ink lg:pt-2">
        <li v-for="i in items" :key="i.id" class="flex gap-4"><span class="num font-semibold text-brand w-9 shrink-0">{{ i.code }}</span>{{ insurerLabel(i) }}</li>
      </ul>
    </div>
  </section>
</template>
