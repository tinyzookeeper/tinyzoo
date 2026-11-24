<script setup lang="ts" generic="T extends { id: string }">
// A row that is swiped sideways on a phone (Embla, never a scrolling box with a scrollbar) and
// a grid from the width the design says. The looks give the classes: `phone` hides the swipe
// row from that width on, `grid` shows the grid from it, `item` is the width of a swiped card.
// The card itself is the slot's.
defineProps<{ items: T[]; phone: string; grid: string; bleed?: string; viewport?: string; container?: string; item?: string; label?: string }>()
</script>

<template>
  <div :class="[phone, bleed]" role="group" :aria-label="label">
    <UCarousel v-slot="{ item: it }" :items="items" align="start" contain-scroll="trimSnaps" drag-free :ui="{ viewport, container, item }">
      <slot :item="(it as T)" />
    </UCarousel>
  </div>
  <ul :class="grid">
    <li v-for="it in items" :key="it.id" class="contents"><slot :item="it" /></li>
  </ul>
</template>
