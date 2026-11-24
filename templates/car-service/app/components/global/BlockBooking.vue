<script setup lang="ts">
// Block "booking": the phone number and the request form (the booking form of cms.config.ts).
// The requests arrive in the admin. Drawn by components/<look>/Booking.vue.
defineProps<{ block: BlockOf<'booking'>; index?: number }>()
const form = await useSiteForm('booking', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Booking" :first="index === 0" :block="block" :form="form" :anchor="anchorOf('booking')" />
</template>
