<script setup lang="ts">
// Block "booking": the form to ask for an appointment (the Appointment form of cms.config.ts).
// The requests arrive in the admin. Drawn by components/<look>/Booking.vue; its choices are
// worked out by `useBooking`, the same in every look.
defineProps<{ block: BlockOf<'booking'>; index?: number }>()
// All asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [form, groups, people] = await Promise.all([useSiteForm('appointment', DEFAULT_LANGUAGE), usePriceList(), useTeam()])
</script>

<template>
  <LookPart part="Booking" :first="index === 0" :block="block" :form="form" :groups="groups" :people="people" :anchor="anchorOf('booking')" />
</template>
