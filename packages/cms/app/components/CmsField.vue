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

// "publishedAt" → "Published at", "hero_image" → "Hero image". Overridable via .label().
function humanize(key: string) {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}
const label = computed(() => props.field.meta?.label || humanize(props.field.key))
const help = computed(() => props.field.meta?.help as string | undefined)
</script>

<template>
  <UFormField
    :label="label" :description="help" :name="field.key" :required="field.required" :error="error"
    :hint="field.optional ? 'optional' : undefined"
  >
    <component :is="component" v-model="model" :field="field" :entity="entity" />
  </UFormField>
</template>
