<script setup lang="ts">
// Block "gifts": the gift list, with the button that reserves a gift. Drawn by components/<look>/Gifts.vue.
defineProps<{ block: BlockOf<'gifts'>; index?: number }>()
const gifts = await useGifts()
</script>

<template>
  <LookPart part="Gifts" :first="index === 0" :block="block" :gifts="gifts" :anchor="anchorOf('gifts')" />
</template>
