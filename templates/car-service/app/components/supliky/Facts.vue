<script setup lang="ts">
// Šuplíky's facts (the look's own design has none): four small drawer fronts, each a lacquered
// card with its figure in bold italic.
defineProps<{ block: BlockOf<'facts'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pb-14 lg:pb-20">
    <dl class="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-7">
      <div v-for="item in block.items" :key="item.id" class="slab p-5 sm:p-6">
        <dt class="kicker text-quiet">{{ item.label }}</dt>
        <dd class="num italic mt-2 text-[28px] sm:text-[34px] leading-none">{{ item.value }}</dd>
        <dd v-if="item.note" class="mt-2.5 text-[15px] text-quiet leading-snug">{{ tidyText(item.note) }}</dd>
      </div>
    </dl>
  </section>
</template>
