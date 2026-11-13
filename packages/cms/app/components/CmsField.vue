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
// properties panel it is one click away behind an info toggle.
//
// The label is ours, linked to the control by a STABLE id derived from the field
// key (not useId): pages that await data render ids differently on the server and
// in the browser, which left server-rendered labels pointing at nothing.
const props = defineProps<{ field: any; entity: string; error?: string; placement?: 'main' | 'sidebar'; idPrefix?: string }>()
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
const showHelp = ref(false)
const inputId = computed(() => `cms-field-${props.idPrefix ?? ''}${props.field.key}`)
// Composite fields (rich text, images, blocks) have no single control to focus.
const composite = computed(() => ['richtext', 'media', 'blocks', 'gallery'].includes(props.field.type))
// Field widgets that adapt to where they sit (e.g. the image field) read this.
provide('cmsFieldPlacement', computed(() => props.placement ?? 'main'))
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between gap-2">
      <component
        :is="composite ? 'span' : 'label'" :for="composite ? undefined : inputId" :id="`${inputId}-label`"
        class="inline-flex items-center gap-1"
        :class="compact ? 'text-xs font-medium text-muted' : 'text-sm font-medium text-highlighted'"
      >
        {{ label }}
        <button
          v-if="compact && help" type="button" class="text-dimmed hover:text-highlighted"
          :aria-label="t('fields.showHelp')" :aria-expanded="showHelp" @click.prevent="showHelp = !showHelp"
        >
          <UIcon name="i-lucide-info" class="size-3.5 block" />
        </button>
      </component>
      <span v-if="field.optional" class="text-xs text-dimmed">{{ t('common.optional') }}</span>
    </div>
    <UFormField
      :name="field.key" :error="error" :help="compact ? (showHelp ? help : undefined) : help"
      :ui="{ help: 'text-muted', error: 'text-error' }"
    >
      <component
        :is="component" :id="inputId" v-model="model" :field="field" :entity="entity"
        :aria-labelledby="composite ? `${inputId}-label` : undefined"
      />
    </UFormField>
  </div>
</template>
