<script setup lang="ts">
// List-cell dispatcher. Same precedence as CmsField but for the `cell` slot:
//   app.config `cms.fields[type].cell` → field.ui.cell → CmsCellText
const props = defineProps<{ field: any; row: any; entity: string }>()

const appConfig = useAppConfig()
const component = computed(() => {
  const override = (appConfig.cms as any)?.fields?.[props.field.type]?.cell
  return resolveComponent(override || props.field.ui?.cell || 'CmsCellText')
})
</script>

<template>
  <component :is="component" :field="field" :row="row" :entity="entity" />
</template>
