<script setup lang="ts">
// Block "reservation": the table reservation form (the Reservation form of cms.config.ts). The
// reservations arrive in the admin. Drawn by components/<look>/Reservation.vue, its fields by
// <ReservationFields>.
defineProps<{ block: BlockOf<'reservation'>; index?: number }>()
const form = await useSiteForm('reservation', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Reservation" :first="index === 0" :block="block" :form="form" :anchor="anchorOf('reservation')" />
</template>
