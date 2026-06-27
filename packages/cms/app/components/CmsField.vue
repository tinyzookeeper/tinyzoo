<script setup lang="ts">
// Edit-field dispatcher. Resolves the renderer component for this field from the
// registry, with precedence:
//   app.config `cms.fields[type].edit`  (host override, by type)
//     → field.ui.edit                   (built-in default, from the descriptor)
//       → CmsFieldText                   (last-resort fallback)
// Host apps add custom field renderers by registering a component name here and
// shipping a same-named component (auto-imported) — no package edits.
const props = defineProps<{ field: any; entity: string; error?: string }>()
const model = defineModel<any>()

const appConfig = useAppConfig()
const component = computed(() => {
  const override = (appConfig.cms as any)?.fields?.[props.field.type]?.edit
  return resolveComponent(override || props.field.ui?.edit || 'CmsFieldText')
})
</script>

<template>
  <UFormField
    :label="field.key" :name="field.key" :required="field.required" :error="error"
    :hint="field.optional ? 'optional' : undefined"
    :ui="{ label: 'capitalize' }"
  >
    <component :is="component" v-model="model" :field="field" :entity="entity" />
  </UFormField>
</template>
