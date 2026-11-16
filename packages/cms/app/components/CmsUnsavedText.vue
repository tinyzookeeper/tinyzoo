<script setup lang="ts">
// Text someone typed into this entry and never saved (their tab closed or crashed):
// it is not in the form. The saved version is what opens; this says the other text
// exists, from when and from whom, and lets the person keep it (it goes into the
// form as their own unsaved change) or discard it. Nothing happens without a click.
import type { CmsCollab } from '../composables/useCmsCollab'

const props = defineProps<{ collab: CmsCollab | null }>()
const emit = defineEmits<{ keep: [values: Record<string, any>] }>()
const { t, formatDate } = useCmsI18n()
const left = computed(() => props.collab?.unsaved.value ?? null)
const title = computed(() => {
  const u = left.value
  if (!u) return ''
  return u.by ? t('live.unsavedLeft', { time: formatDate(u.at), name: u.by }) : t('live.unsavedLeftAnon', { time: formatDate(u.at) })
})
async function keep() {
  const u = left.value
  if (!u) return
  emit('keep', u.values)
  await props.collab?.clearUnsaved()
}
async function discard() {
  await props.collab?.clearUnsaved()
}
</script>

<template>
  <UAlert
    v-if="left" color="warning" variant="subtle" icon="i-lucide-file-clock" class="mb-6" role="alert"
    :title="title" :description="t('live.unsavedLeftBody')"
    :actions="[{ label: t('live.unsavedKeep'), color: 'neutral', variant: 'outline', onClick: keep }, { label: t('live.unsavedDiscard'), color: 'neutral', variant: 'ghost', onClick: discard }]"
  />
</template>
