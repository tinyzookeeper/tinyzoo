<script setup lang="ts">
// Host-provided custom field renderer. Registered for the `select` type via
// app.config (`cms.fields.select.edit`) — proves a host can replace a built-in
// field editor without touching the @my-cms/core package. Renders the options as
// a segmented control instead of the default dropdown.
//
// NB: lives in components/global/ so it is globally registered — the registry
// resolves renderers by name at runtime, which only works for global components.
const props = defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
const { tl } = useCmsI18n()
</script>

<template>
  <div class="flex gap-1.5">
    <UButton
      v-for="opt in props.field.meta.options" :key="opt"
      size="sm"
      :color="model === opt ? 'primary' : 'neutral'"
      :variant="model === opt ? 'solid' : 'outline'"
      @click="model = opt"
    >
      {{ tl(props.field.meta.labels?.[opt], opt) }}
    </UButton>
  </div>
</template>
