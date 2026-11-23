<script setup lang="ts">
// Block "areas": where the agency works, with the number of properties in each place. A place
// that holds no number of its own counts the published properties of that town. Drawn by
// components/<look>/Areas.vue.
defineProps<{ block: BlockOf<'areas'>; index?: number }>()
const [areas, listings] = await Promise.all([useAreas(), useListings()])
const places = computed(() => areas.value.map((a) => ({
  ...a,
  count: a.count ?? listings.value.filter((l) => l.town === a.name).length,
})))
</script>

<template>
  <LookPart part="Areas" :first="index === 0" :block="block" :places="places" :anchor="anchorOf('areas')" />
</template>
