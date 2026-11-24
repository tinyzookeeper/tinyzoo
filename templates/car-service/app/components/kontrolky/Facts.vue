<script setup lang="ts">
// Kontrolky's facts (the look's own design has none): four readouts, each under a hairline, in the
// style of the frost warning's prices.
defineProps<{ block: BlockOf<'facts'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pb-16 lg:pb-24">
    <dl class="grid grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-8">
      <div v-for="item in block.items" :key="item.id" class="border-t border-line pt-5">
        <dt class="text-[16px]">{{ item.label }}</dt>
        <dd class="dig mt-1 text-[30px] sm:text-[36px] font-semibold leading-none">{{ item.value }}</dd>
        <dd v-if="item.note" class="mt-2 text-[15px] text-quiet">{{ tidyText(item.note) }}</dd>
      </div>
    </dl>
  </section>
</template>
