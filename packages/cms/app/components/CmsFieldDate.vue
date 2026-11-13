<script setup lang="ts">
// Date & time, edited as wall-clock time in the admin's time zone (cms.admin.timeZone)
// and stored as an exact instant. The browser's own zone plays no part. The zone is
// named in the tooltip rather than as a visible label.
defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
const config = useCmsAdminConfig()
const input = computed({
  get: () => toZonedInput(model.value, config.value.timeZone),
  set: (v: string) => { model.value = fromZonedInput(v, config.value.timeZone) },
})
</script>

<template>
  <UInput v-model="input" type="datetime-local" class="w-full" :title="config.timeZone" />
</template>
