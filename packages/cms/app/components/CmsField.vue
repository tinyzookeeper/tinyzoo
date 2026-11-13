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

// Label: the field's `.label()` (one string or per admin locale), else the humanized key.
const { t, fieldLabel, fieldHelp } = useCmsI18n()
const label = computed(() => fieldLabel(props.field))
const help = computed(() => fieldHelp(props.field))
</script>

<template>
  <UFormField
    :label="label" :description="help" :name="field.key" :required="field.required" :error="error"
    :hint="field.optional ? t('common.optional') : undefined"
    :ui="{ label: 'font-medium text-highlighted', description: 'text-muted', hint: 'text-dimmed' }"
  >
    <component :is="component" v-model="model" :field="field" :entity="entity" />
  </UFormField>
</template>
