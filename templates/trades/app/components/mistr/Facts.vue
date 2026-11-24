<script setup lang="ts">
// Mistr's key figures: four numbers in a ruled row under the opening.
defineProps<{ block: BlockOf<'facts'>; first?: boolean }>()
// Where each of the four sits in the two-column grid of a phone and the four of a desktop.
const CELLS = [
  'py-5 pr-4 lg:px-6 lg:first:pl-0 border-b lg:border-b-0 border-line lg:border-r',
  'py-5 pl-4 lg:px-6 border-b lg:border-b-0 border-line border-l lg:border-l-0 lg:border-r',
  'py-5 pr-4 lg:px-6 lg:border-r border-line',
  'py-5 pl-4 lg:px-6 border-l lg:border-l-0 border-line',
]
</script>

<template>
  <section v-if="block.items.length" class="wrap pt-12 md:pt-16">
    <dl class="grid grid-cols-2 lg:grid-cols-4 border-y border-line">
      <div v-for="(item, i) in block.items" :key="item.id" :class="CELLS[i % 4]">
        <dt class="text-[0.9375rem] text-quiet">{{ item.label }}</dt>
        <dd class="mt-1 text-ink text-[1.5rem] md:text-[1.75rem] font-bold tracking-[-0.02em] tabular-nums">{{ item.value }}</dd>
      </div>
    </dl>
  </section>
</template>
