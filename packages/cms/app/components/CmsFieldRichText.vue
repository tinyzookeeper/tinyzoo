<script setup lang="ts">
import type { CmsCollab } from '../composables/useCmsCollab'

// Built-in rich-text field. Swap it out per host by registering
// `cms.fields.richtext.edit` in app.config.
//
// When the page shares this entry (useCmsCollab) and this is one of the shared
// fields, the text is edited together, with everyone's cursors; otherwise — inside
// blocks, on a new entry, or when the shared document cannot be reached — the field
// edits on its own, as always.
const props = defineProps<{ field?: any }>()
const model = defineModel<any>()
const { t } = useCmsI18n()
const collab = inject<CmsCollab | null>('cmsCollab', null)

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
  <CmsRichTextEditor v-if="ready && current" :key="`shared-${collab!.generation.value}`" v-model="model" :collab="current" />
  <div v-else-if="shared" class="w-full rounded-lg border border-default bg-default">
    <div class="min-h-32 px-3 py-2 text-sm text-muted">{{ t('live.connecting') }}</div>
  </div>
  <CmsRichTextEditor v-else key="alone" v-model="model" />
</template>
