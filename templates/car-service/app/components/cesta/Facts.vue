<script setup lang="ts">
// Cesta's facts: four large figures without boxes, a label above and a note under each.
defineProps<{ block: BlockOf<'facts'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pb-16 lg:pb-24">
    <dl class="grid grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-9">
      <div v-for="item in block.items" :key="item.id">
        <dt class="text-[16px] text-quiet">{{ item.label }}</dt>
        <dd class="num mt-1 text-[34px] sm:text-[40px] font-extrabold leading-none">{{ item.value }}</dd>
        <dd v-if="item.note" class="mt-2.5 text-[16px] text-quiet leading-snug">{{ tidyText(item.note) }}</dd>
      </div>
    </dl>
  </section>
</template>
