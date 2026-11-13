<script setup lang="ts">
// The one notice an editor shows when someone else got there first: the entry was
// deleted, a save was refused because a newer version exists (conflict), or a newer
// version arrived while this tab has unsaved changes (incoming). Nothing is lost
// without a click: loading the newer version is always the editor's choice.
import type { LiveChange } from '../composables/useCmsLive'

const props = defineProps<{
  deleted?: LiveChange | null
  conflict?: { updatedByName: string | null } | null
  incoming?: LiveChange | null
  listTo?: string
}>()
const emit = defineEmits<{ load: []; saveAnyway: []; dismiss: [] }>()
const { t } = useCmsI18n()

const notice = computed(() => {
  if (props.deleted) {
    const name = props.deleted.byName
    return {
      color: 'error' as const,
      icon: 'i-lucide-trash-2',
      title: name ? t('live.deleted', { name }) : t('live.deletedSomeone'),
      description: t('live.deletedBody'),
      actions: props.listTo ? [{ label: t('live.backToList'), to: props.listTo, color: 'neutral' as const, variant: 'outline' as const }] : [],
      close: false,
    }
  }
  if (props.conflict) {
    const name = props.conflict.updatedByName
    return {
      color: 'warning' as const,
      icon: 'i-lucide-git-compare-arrows',
      title: name ? t('live.conflict', { name }) : t('live.conflictSomeone'),
      description: t('live.conflictBody'),
      actions: [
        { label: t('live.loadNewer'), color: 'neutral' as const, variant: 'outline' as const, onClick: () => emit('load') },
        { label: t('live.saveAnyway'), color: 'warning' as const, variant: 'ghost' as const, onClick: () => emit('saveAnyway') },
      ],
      close: false,
    }
  }
  if (props.incoming) {
    const name = props.incoming.byName
    return {
      color: 'info' as const,
      icon: 'i-lucide-refresh-cw',
      title: name ? t('live.changed', { name }) : t('live.changedSomeone'),
      description: t('live.changedBody'),
      actions: [{ label: t('live.loadNewer'), color: 'neutral' as const, variant: 'outline' as const, onClick: () => emit('load') }],
      close: true,
    }
  }
  return null
})
</script>

<template>
  <UAlert
    v-if="notice" :color="notice.color" variant="subtle" :icon="notice.icon"
    :title="notice.title" :description="notice.description" :actions="notice.actions"
    :close="notice.close" class="mb-6" role="status" @update:open="(open: boolean) => { if (!open) emit('dismiss') }"
  />
</template>
