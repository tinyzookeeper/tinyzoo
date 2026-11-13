<script setup lang="ts">
// Date & time, edited as wall-clock time in the admin's time zone (cms.admin.timeZone)
// and stored as an exact instant. The browser's own zone plays no part.
defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
const config = useCmsAdminConfig()
const input = computed({
  get: () => toZonedInput(model.value, config.value.timeZone),
  set: (v: string) => { model.value = fromZonedInput(v, config.value.timeZone) },
})
</script>

<template>
  <div class="flex items-center gap-2">
    <UInput v-model="input" type="datetime-local" class="w-full sm:max-w-xs" />
    <span class="text-xs text-muted whitespace-nowrap">{{ config.timeZone }}</span>
  </div>
</template>
