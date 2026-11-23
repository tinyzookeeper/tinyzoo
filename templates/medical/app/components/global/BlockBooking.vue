<script setup lang="ts">
// Block "booking": how to make an appointment and the request form (the Appointment form of
// cms.config.ts). The requests arrive in the admin. Drawn by components/<look>/Booking.vue,
// its fields by <AppointmentFields>.
defineProps<{ block: BlockOf<'booking'>; index?: number }>()
const [form, insurers, hours] = await Promise.all([useSiteForm('appointment', DEFAULT_LANGUAGE), useInsurers(), useOpeningHours()])
</script>

<template>
  <LookPart part="Booking" :first="index === 0" :block="block" :form="form" :insurers="insurers" :hours="hours" :anchor="anchorOf('booking')" />
</template>
