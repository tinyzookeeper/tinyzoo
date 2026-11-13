<script setup lang="ts">
// The history of an entry (or one translation): every save, newest first, and for
// the one picked, the fields that differ from what is in the form now, with the
// words that changed highlighted. "Restore this version" puts it into the form —
// nothing is saved until the editor saves.
const props = defineProps<{ entity: string; id: string; locale: string | null; fields: any[]; current: Record<string, any> }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ restore: [data: Record<string, any>] }>()
const { t, fieldLabel, formatDate, formatRelative } = useCmsI18n()

const query = computed(() => (props.locale ? `?locale=${props.locale}` : ''))
const { data: list, status, refresh } = useFetch<{ revisions: any[] }>(() => `/api/cms/${props.entity}/${props.id}/revisions${query.value}`, { immediate: false, server: false })
watch(open, (o) => { if (o) refresh() })
const revisions = computed(() => list.value?.revisions ?? [])

const selectedId = ref<string | null>(null)
const selected = ref<any>(null)
const loading = ref(false)
watch(revisions, (rs) => { if (rs.length && !rs.some((r) => r.id === selectedId.value)) pick(rs[0].id) })
async function pick(rev: string) {
  selectedId.value = rev
  loading.value = true
  try {
    const found = (await $fetch<{ revision: any }>(`/api/cms/${props.entity}/${props.id}/revisions/${rev}`)).revision
    // Clicked another one meanwhile: that answer wins, not this one.
    if (selectedId.value === rev) selected.value = found
  }
  finally {
    if (selectedId.value === rev) loading.value = false
  }
}

const byKey = computed(() => new Map(props.fields.map((f: any) => [f.key, f])))
const textOf = (f: any, v: any): string => {
  if (v === null || v === undefined || v === '') return ''
  if (f?.type === 'richtext') return richTextToPlain(v)
  if (f?.type === 'boolean') return v ? t('fields.yes') : t('fields.no')
  if (f?.type === 'datetime') return formatDate(v)
  if (Array.isArray(v)) return t('revisions.items', { count: v.length })
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
/** The fields where this version differs from the form now. */
const differences = computed(() => {
  const data = selected.value?.data ?? {}
  return Object.keys(data)
    .filter((k) => !k.endsWith('__media') && byKey.value.has(k) && stableJson(data[k]) !== stableJson(props.current[k]))
    .map((k) => {
      const f = byKey.value.get(k)
      const then = textOf(f, data[k])
      const now = textOf(f, props.current[k])
      const textual = ['text', 'slug', 'richtext', 'number', 'select'].includes(f?.type)
      return { key: k, label: fieldLabel(f), then, now, parts: textual ? wordDiff(now, then) : null }
    })
})

const actionLabel = (r: any) => {
  const names = (r.changed ?? []).map((k: string) => fieldLabel(byKey.value.get(k))).filter(Boolean)
  switch (r.action) {
    case 'entry.created': return t('revisions.created')
    case 'entry.published': return t('revisions.published')
    case 'entry.unpublished': return t('revisions.unpublished')
    default: return names.length ? t('revisions.edited', { fields: names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') }) : t('revisions.saved')
  }
}

function restore() {
  if (!selected.value) return
  emit('restore', selected.value.data)
  open.value = false
}
</script>

<template>
  <USlideover v-model:open="open" :title="t('revisions.title')" :description="t('revisions.description')" :ui="{ content: 'max-w-4xl' }">
    <template #body>
      <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
        <section class="min-w-0 space-y-4" :aria-label="t('revisions.compare')">
          <p v-if="!selected && status !== 'pending'" class="text-sm text-muted">{{ t('revisions.empty') }}</p>
          <template v-else-if="selected">
            <p class="text-sm text-muted">
              {{ t('revisions.versionOf', { date: formatDate(selected.createdAt) }) }}
            </p>
            <p v-if="!differences.length" class="text-sm text-muted">{{ t('revisions.same') }}</p>
            <div v-for="d in differences" :key="d.key" class="rounded-lg border border-default p-3 space-y-1.5">
              <p class="text-xs font-medium text-muted">{{ d.label }}</p>
              <p v-if="d.parts" class="text-sm whitespace-pre-wrap leading-relaxed">
                <template v-for="(p, i) in d.parts" :key="i">
                  <span v-if="p.kind === 'same'">{{ p.text }}</span>
                  <ins v-else-if="p.kind === 'added'" class="no-underline rounded-sm bg-success/15 text-highlighted">{{ p.text }}</ins>
                  <del v-else class="rounded-sm bg-error/10 text-muted">{{ p.text }}</del>
                </template>
              </p>
              <div v-else class="grid grid-cols-2 gap-3 text-sm">
                <div><span class="block text-xs text-dimmed">{{ t('revisions.then') }}</span>{{ d.then || '—' }}</div>
                <div><span class="block text-xs text-dimmed">{{ t('revisions.now') }}</span>{{ d.now || '—' }}</div>
              </div>
            </div>
          </template>
        </section>

        <nav class="md:border-l md:border-default md:pl-4" :aria-label="t('revisions.list')">
          <ol class="space-y-1">
            <li v-for="r in revisions" :key="r.id">
              <button
                type="button" class="w-full rounded-md px-2 py-1.5 text-left hover:bg-elevated/60"
                :class="r.id === selectedId ? 'bg-elevated' : ''" :aria-current="r.id === selectedId ? 'true' : undefined" @click="pick(r.id)"
              >
                <span class="block text-sm text-highlighted">{{ formatRelative(r.createdAt) }}</span>
                <span class="block truncate text-xs text-muted">{{ r.byName || t('revisions.someone') }} · {{ actionLabel(r) }}</span>
              </button>
            </li>
          </ol>
        </nav>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">{{ t('common.close') }}</UButton>
        <UButton :disabled="!selected || !differences.length" :loading="loading" icon="i-lucide-history" @click="restore">{{ t('revisions.restore') }}</UButton>
      </div>
    </template>
  </USlideover>
</template>
