<script setup lang="ts">
// Edit-field dispatcher. Resolves the renderer component for this field from the
// registry, with precedence:
//   app.config `cms.fields[type].edit`  (host override, by type)
//     → field.ui.edit                   (built-in default, from the descriptor)
//       → CmsFieldText                   (last-resort fallback)
// Host apps add custom field renderers by registering a component name here and
// shipping a same-named component (auto-imported) — no package edits.
//
// One field convention everywhere: required fields carry no marker, optional ones
// say "Optional". Help text sits under the control in the content column; in the
// properties panel it is behind a small info icon, so the panel stays scannable.
const props = defineProps<{ field: any; entity: string; error?: string; placement?: 'main' | 'sidebar' }>()
const model = defineModel<any>()

const appConfig = useAppConfig()
const component = computed(() => {
  const override = (appConfig.cms as any)?.fields?.[props.field.type]?.edit
  return resolveComponent(override || props.field.ui?.edit || 'CmsFieldText')
})

const { t, fieldLabel, fieldHelp } = useCmsI18n()
const label = computed(() => fieldLabel(props.field))
const help = computed(() => fieldHelp(props.field))
const compact = computed(() => props.placement === 'sidebar')
// Field widgets that adapt to where they sit (e.g. the image field) read this.
provide('cmsFieldPlacement', computed(() => props.placement ?? 'main'))
</script>

<template>
  <UFormField
    :name="field.key" :error="error" :help="compact ? undefined : help"
    :ui="{ label: compact ? 'text-xs font-medium text-muted' : 'font-medium text-highlighted', hint: 'text-xs text-dimmed', help: 'text-muted' }"
  >
    <template #label>
      <span class="inline-flex items-center gap-1">
        {{ label }}
        <UTooltip v-if="compact && help" :text="help" :content="{ side: 'top' }">
          <UIcon name="i-lucide-info" class="size-3.5 text-dimmed" :aria-label="help" />
        </UTooltip>
      </span>
    </template>
    <template v-if="field.optional" #hint>{{ t('common.optional') }}</template>
    <component :is="component" v-model="model" :field="field" :entity="entity" />
  </UFormField>
</template>
