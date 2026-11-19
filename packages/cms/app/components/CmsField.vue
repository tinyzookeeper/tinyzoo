<script setup lang="ts">
// Edit-field dispatcher. Resolves the renderer component for this field from the
// registry, with precedence:
//   app.config `cms.fields[type].edit`  (host override, by type), then a plugin's renderer for the type
//     → field.ui.edit                   (built-in default, from the descriptor)
//       → CmsFieldText                   (last-resort fallback)
// Host apps add custom field renderers by registering a component name here and
// shipping a same-named component (auto-imported) — no package edits.
//
// One field convention everywhere: required fields carry no marker, optional ones
// say "Optional" (sectioned forms leave that out: empty optional fields wait behind
// "+ Add …" there). Help text sits under the control in the content column; in the
// properties panel it is one click away behind an info toggle. A switch is one row:
// what it is, what it does, the switch.
//
// The label is ours, linked to the control by a STABLE id derived from the field
// key (not useId): pages that await data render ids differently on the server and
// in the browser, which left server-rendered labels pointing at nothing.
import type { Ref } from 'vue'
const props = defineProps<{
  field: any; entity: string; error?: string; placement?: 'main' | 'sidebar'; idPrefix?: string; hideOptional?: boolean
  /** A details row: the label on the left, a quiet control on the right (the writing editor's details). */
  row?: boolean
  /**
   * Translating: what the default language has in this field. An empty text field shows it greyed inside
   * (its placeholder), an empty rich text shows it behind the editor: what visitors see until it is translated.
   */
  fallback?: unknown
}>()
const model = defineModel<any>()
// A field this person may read but not edit (`.access({ edit })`, `readOnly` in the graph): its controls are
// disabled, and the rich-text editor inside reads the same switch the whole form uses when it is read-only.
const formReadOnly = inject<Ref<boolean> | null>('cmsReadOnly', null)
const readOnly = computed(() => !!formReadOnly?.value || !!props.field.readOnly)
provide('cmsReadOnly', readOnly)
// What the renderer is told (`CmsFieldEditProps.readOnly`): not `false` when it is not, so a renderer that
// declares no such prop gets no attribute in the page.
const readOnlyProp = computed(() => readOnly.value || undefined)

const appConfig = useAppConfig()
const pluginFields = (useRuntimeConfig().public.cmsPlugins as any)?.fields as Record<string, { edit?: string }> | undefined
const override = computed(() => ((appConfig.cms as any)?.fields?.[props.field.type]?.edit ?? pluginFields?.[props.field.type]?.edit) as string | undefined)
const component = computed(() => resolveComponent(override.value || props.field.ui?.edit || 'CmsFieldText'))

const { t, fieldLabel, fieldHelp } = useCmsI18n()
// A field that holds fields (a group, a list, blocks) shows its problems where they are, on
// the field inside: the same message over the whole thing too would be said twice.
const form = inject<{ issues?: Record<string, string> } | null>('cmsForm', null)
const nestedIssue = computed(() => !!form?.issues && Object.keys(form.issues).some((p) => p.startsWith(`${props.field.key}.`)))
const shownError = computed(() => (nestedIssue.value ? undefined : props.error))
const label = computed(() => fieldLabel(props.field))
const help = computed(() => fieldHelp(props.field))
const compact = computed(() => props.placement === 'sidebar')
const showHelp = ref(false)
const inputId = computed(() => `cms-field-${props.idPrefix ?? ''}${props.field.key}`)
// Composite fields (rich text, images, blocks, choice buttons) have no single control to focus.
const composite = computed(() => ['richtext', 'media', 'blocks', 'gallery', 'group'].includes(props.field.type)
  || (!override.value && cmsSelectAsButtons(props.field, props.placement ?? 'main')))
const isSwitch = computed(() => props.field.type === 'boolean' && !override.value)
// Field widgets that adapt to where they sit (e.g. the image field) read this; in a
// details row the controls are quiet (no box until hovered).
provide('cmsFieldPlacement', computed(() => props.placement ?? 'main'))
const inRow = computed(() => !!props.row && !composite.value)
provide('cmsFieldVariant', computed(() => (inRow.value ? 'ghost' : 'outline')))
provide('cmsFieldFallback', computed(() => props.fallback))
</script>

<template>
  <CmsFieldLock :locked="!!field.readOnly" :editable-by="field.editableBy" :id="inputId">
  <!-- a switch: one row, the sentence says what it does -->
  <UFormField v-if="isSwitch" :name="field.key" :error="shownError" :ui="{ error: 'text-error' }">
    <div
      class="flex items-center justify-between gap-4"
      :class="compact ? '' : 'cms-field-box rounded-(--ui-radius) border border-default bg-default px-3.5 py-3'"
    >
      <label :for="inputId" :id="`${inputId}-label`" class="min-w-0 cursor-pointer">
        <span class="block" :class="compact ? 'text-xs font-medium text-muted' : 'text-sm font-medium text-highlighted'">{{ label }}</span>
        <span v-if="help && !compact" class="block text-sm text-muted text-pretty">{{ help }}</span>
      </label>
      <component :is="component" :id="inputId" v-model="model" :field="field" :entity="entity" :read-only="readOnlyProp" />
    </div>
  </UFormField>

  <!-- a details row: label | quiet control -->
  <div v-else-if="inRow" class="cms-field-row">
    <label :for="inputId" :id="`${inputId}-label`" class="cms-field-row__label">
      {{ label }}
      <button
        v-if="help" type="button" class="ml-0.5 align-[-2px] text-dimmed hover:text-highlighted"
        :aria-label="t('fields.showHelp')" :aria-expanded="showHelp" @click.prevent="showHelp = !showHelp"
      >
        <UIcon name="i-lucide-info" class="size-3.5 inline-block" />
      </button>
    </label>
    <UFormField :name="field.key" :error="shownError" :help="showHelp ? help : undefined" :ui="{ help: 'text-muted text-xs', error: 'text-error text-xs' }" class="min-w-0">
      <component :is="component" :id="inputId" v-model="model" :field="field" :entity="entity" :read-only="readOnlyProp" />
    </UFormField>
  </div>

  <div v-else class="space-y-1.5">
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
      <!-- a locked field says so under itself (CmsFieldLock), once -->
      <span v-if="field.optional && !hideOptional && !field.readOnly" class="text-xs text-dimmed">{{ t('common.optional') }}</span>
    </div>
    <UFormField
      :name="field.key" :error="shownError" :help="compact ? (showHelp ? help : undefined) : help"
      :ui="{ help: 'text-muted', error: 'text-error' }"
    >
      <component
        :is="component" :id="inputId" v-model="model" :field="field" :entity="entity" :read-only="readOnlyProp"
        :aria-labelledby="composite ? `${inputId}-label` : undefined"
      />
    </UFormField>
  </div>
  </CmsFieldLock>
</template>
