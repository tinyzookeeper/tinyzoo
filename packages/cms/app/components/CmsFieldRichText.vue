<script setup lang="ts">
import type { CmsCollab } from '../composables/useCmsCollab'

// Built-in rich-text field. Swap it out per host by registering
// `cms.fields.richtext.edit` in app.config.
//
// When the page shares this entry (useCmsCollab) and this is one of the shared
// fields, the text is edited together, with everyone's cursors; otherwise — inside
// blocks, on a new entry, or when the shared document cannot be reached — the field
// edits on its own, as always.
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  field?: any
  readOnly?: boolean
  /** Translating: the default language's text, greyed behind the empty editor (else CmsField's `fallback`). */
  fallback?: unknown
}>()
const model = defineModel<any>()
const { t, fieldLabel } = useCmsI18n()
const label = computed(() => (props.field ? fieldLabel(props.field) : undefined))
// The label the field shows (CmsField), when there is one; else the field's name.
const attrs = useAttrs()
const labelledby = computed(() => (attrs['aria-labelledby'] as string | undefined))
// Everything else (the id) stays on the box; the label belongs to the textbox inside, not to the wrapper.
const rest = computed(() => { const { 'aria-labelledby': _l, ...r } = attrs; return r })
const collab = inject<CmsCollab | null>('cmsCollab', null)
// Translating: the default language's text, shown greyed behind the empty editor (CmsField's `fallback`).
const fallbackRef = inject<Ref<unknown> | null>('cmsFieldFallback', null)
const fallback = computed(() => props.fallback ?? fallbackRef?.value ?? null)

const shared = computed(() => !!collab && !!props.field?.key && collab.status.value !== 'off'
  && (collab.status.value === 'connecting' || collab.fields.value.has(props.field.key)))
const ready = computed(() => shared.value && collab!.status.value === 'ready')
const current = computed(() => {
  if (!ready.value) return null
  void collab!.generation.value // a restarted document is a new one
  const live = collab!.current()
  return live ? { doc: live.doc, provider: live.provider, field: props.field.key, user: collab!.user, readOnly: collab!.readOnly.value } : null
})
</script>

<template>
  <CmsRichTextEditor v-if="ready && current" :key="`shared-${collab!.generation.value}`" v-model="model" :collab="current" :label="label" :labelledby="labelledby" :fallback="fallback" v-bind="rest" />
  <!-- while the shared text connects: the saved text, dimmed and not yet editable -->
  <div v-else-if="shared" v-bind="rest" class="cms-field-box w-full rounded-lg border border-default bg-default" aria-busy="true">
    <div class="flex h-9 items-center gap-2 border-b border-default bg-elevated/30 px-3 text-xs text-muted">
      <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />{{ t('live.connecting') }}
    </div>
    <CmsContent v-if="model" :doc="model" class="cms-prose min-h-32 px-4 py-3 opacity-60" />
    <div v-else class="min-h-32" />
  </div>
  <CmsRichTextEditor v-else key="alone" v-model="model" :label="label" :labelledby="labelledby" :fallback="fallback" v-bind="rest" />
</template>
