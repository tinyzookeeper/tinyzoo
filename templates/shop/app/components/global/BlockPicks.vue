<script setup lang="ts">
// Block "picks": the products in the window, as many as the block says. Drawn by
// components/<look>/Picks.vue; its buttons fill in the enquiry form (useEnquiryDraft).
const props = defineProps<{ block: BlockOf<'picks'>; index?: number }>()
const products = await useProducts()
const items = computed(() => products.value.slice(0, props.block.count || 9))
</script>

<template>
  <LookPart part="Picks" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('picks')" />
</template>
