<script setup lang="ts">
// Block "overview": the building at a glance, drawn from the flats (an elevation, squares or a
// floor plan, by look). Drawn by components/<look>/Overview.vue.
defineProps<{ block: BlockOf<'overview'>; index?: number }>()
const [flats, floors] = await Promise.all([useFlats(), useFloors()])
</script>

<template>
  <LookPart part="Overview" :first="index === 0" :index="index" :block="block" :flats="flats" :floors="floors" :anchor="anchorOf('overview')" />
</template>
