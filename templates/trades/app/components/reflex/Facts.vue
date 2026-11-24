<script setup lang="ts">
// Reflex's key figures: between two heavy rules, each figure in condensed numerals as large as
// a rate tile's, its name in small capitals above.
defineProps<{ block: BlockOf<'facts'>; first?: boolean }>()
</script>

<template>
  <section v-if="block.items.length" class="wrap pt-10 md:pt-14">
    <dl class="grid grid-cols-2 lg:grid-cols-4 border-y-2 border-ink">
      <div v-for="(item, i) in block.items" :key="item.id" class="py-5 border-ink" :class="[i % 2 ? 'pl-4 border-l-2 lg:pl-6' : 'pr-4 lg:pr-6', i < 2 ? 'border-b-2 lg:border-b-0' : '', i ? 'lg:border-l-2 lg:pl-6' : '']">
        <dt class="label">{{ item.label }}</dt>
        <dd class="mt-1 font-cond font-black text-[2.25rem] md:text-[3rem] leading-none tabular-nums">{{ item.value }}</dd>
      </div>
    </dl>
  </section>
</template>
