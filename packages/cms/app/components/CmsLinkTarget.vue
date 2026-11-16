<script setup lang="ts">
// What a stored link points at: the page's title and address, and a warning when
// visitors will not get there (the page is not published yet, or is gone). The link
// follows the page — rename it and the link keeps working — and this says which page
// that is, instead of showing the reference.
const props = defineProps<{ value: string; compact?: boolean }>()
const { t, entityLabel } = useCmsI18n()
const target = useCmsLinkTarget(() => props.value)
const graph = useNuxtData<any[]>('cms-graph').data
const meta = computed(() => graph.value?.find((e: any) => e.name === target.value?.entity))
const icon = computed(() => (target.value?.state === 'missing' ? 'i-lucide-link-2-off' : meta.value?.icon ?? 'i-lucide-file'))
const warning = computed(() => {
  const s = target.value?.state
  return s === 'draft' ? t('link.targetDraft') : s === 'missing' ? t('link.targetMissing') : null
})
</script>

<template>
  <span class="flex min-w-0 items-center gap-2.5" data-cms-link-target :data-state="target?.state ?? 'unknown'">
    <UIcon :name="icon" class="size-4 shrink-0" :class="target?.state === 'missing' ? 'text-error' : 'text-muted'" />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm" :class="target?.state === 'missing' ? 'text-error' : 'text-highlighted'">
        <template v-if="!target">…</template>
        <template v-else-if="target.state === 'missing'">{{ t('link.missingTitle') }}</template>
        <template v-else>{{ target.title || target.path }}</template>
      </span>
      <span v-if="target && target.path && target.state !== 'missing'" class="block truncate font-mono text-xs text-muted">
        <template v-if="meta && !compact">{{ entityLabel(meta) }} · </template>{{ target.path }}
      </span>
      <span v-if="warning" class="mt-0.5 flex items-start gap-1 text-xs text-pretty" :class="target?.state === 'missing' ? 'text-error' : 'text-warning'" role="status">
        <UIcon name="i-lucide-triangle-alert" class="mt-px size-3.5 shrink-0" />{{ warning }}
      </span>
    </span>
  </span>
</template>
