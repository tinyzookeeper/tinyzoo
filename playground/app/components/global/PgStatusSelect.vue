<script setup lang="ts">
// Host-provided custom field renderer. Registered for the `select` type via
// app.config (`cms.fields.select.edit`) — proves a host can replace a built-in
// field editor without touching the tinyzoo package. Renders the options as
// a segmented control instead of the default dropdown.
//
// NB: lives in components/global/ so it is globally registered — the registry
// resolves renderers by name at runtime, which only works for global components.
// `readOnly`: the person's role may read this field but not edit it (CmsFieldEditProps.readOnly). These
// buttons are not a form control the admin could disable for us, so we do.
const props = defineProps<{ field: any; entity?: string; readOnly?: boolean }>()
const model = defineModel<any>()
const { tl } = useCmsI18n()
</script>

<template>
  <div class="flex gap-1.5">
    <UButton
      v-for="opt in props.field.meta.options" :key="opt"
      size="sm" :disabled="props.readOnly"
      :color="model === opt ? 'primary' : 'neutral'"
      :variant="model === opt ? 'solid' : 'outline'"
      @click="model = opt"
    >
      {{ tl(props.field.meta.labels?.[opt], opt) }}
    </UButton>
  </div>
</template>
