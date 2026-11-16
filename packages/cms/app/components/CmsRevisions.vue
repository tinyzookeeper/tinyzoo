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
    const found = (await cmsFetch<{ revision: any }>(`/api/cms/${props.entity}/${props.id}/revisions/${rev}`)).revision
    // Clicked another one meanwhile: that answer wins, not this one.
    if (selectedId.value === rev) selected.value = found
  }
  finally {
    if (selectedId.value === rev) loading.value = false
  }
}

const byKey = computed(() => new Map(props.fields.map((f: any) => [f.key, f])))

// ── files and related entries: shown by name (and a thumbnail), never by id ──
type Ref = { label: string; thumb: string | null } | null
const names = ref<Record<string, Ref>>({})
const isRefField = (f: any) => f?.type === 'media' || f?.type === 'gallery' || f?.relation?.kind === 'many-to-one' || f?.relation?.kind === 'many-to-many'
const refKey = (f: any, id: string) => (f.type === 'media' || f.type === 'gallery' ? `media:${id}` : `${f.relation.to}:${id}`)
function refIds(f: any, v: any): string[] {
  if (v === null || v === undefined || v === '') return []
  if (f.type === 'media') return typeof v === 'string' ? [v] : []
  if (f.type === 'gallery') return Array.isArray(v) ? v.map((x: any) => x?.mediaId).filter(Boolean) : []
  if (f.relation?.kind === 'many-to-one') return typeof v === 'string' ? [v] : []
  return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []
}
const mediaRef = (m: any): Ref => (m ? { label: String(m.name || m.alt || String(m.key ?? '').split('/').pop() || ''), thumb: String(m.mime ?? '').startsWith('image/') ? m.url ?? null : null } : null)
/** Look up the names of every file and related entry in the picked version and in the form. */
async function resolveNames() {
  const wanted = new Map<string, { f: any; id: string }>()
  const sources = [selected.value?.data, props.current]
  for (const f of props.fields) {
    if (!isRefField(f)) continue
    for (const src of sources) {
      if (!src) continue
      for (const id of refIds(f, src[f.key])) {
        const k = refKey(f, id)
        if (k in names.value) continue
        // The record that came with the version, when it is the one.
        const known = f.type === 'media' && src[`${f.key}__media`]?.id === id ? mediaRef(src[`${f.key}__media`]) : undefined
        if (known) names.value = { ...names.value, [k]: known }
        else wanted.set(k, { f, id })
      }
    }
  }
  if (!wanted.size) return
  const next: Record<string, Ref> = {}
  const byEntity = new Map<string, string[]>()
  await Promise.all([...wanted].map(async ([k, { f, id }]) => {
    if (f.type === 'media' || f.type === 'gallery') {
      next[k] = mediaRef(await cmsFetch(`/api/cms/_media/${id}`).catch(() => null))
    }
    else byEntity.set(f.relation.to, [...(byEntity.get(f.relation.to) ?? []), id])
  }))
  await Promise.all([...byEntity].map(async ([to, ids]) => {
    const found = await cmsFetch<{ id: string; label: string }[]>(`/api/cms/${to}/options`, { query: { selected: ids.join(',') } }).catch(() => [])
    for (const id of ids) {
      const hit = found.find((x) => x.id === id)
      next[`${to}:${id}`] = hit ? { label: String(hit.label ?? ''), thumb: null } : null
    }
  }))
  names.value = { ...names.value, ...next }
}
watch([selected, () => open.value], () => { if (open.value && selected.value) void resolveNames() })
const refParts = (f: any, v: any) => refIds(f, v).map((id) => names.value[refKey(f, id)] ?? undefined).map((r) => (r === undefined ? { label: '…', thumb: null } : r ?? { label: t('revisions.gone'), thumb: null }))
const textOf = (f: any, v: any): string => {
  if (v === null || v === undefined || v === '') return ''
  if (f?.type === 'richtext') return richTextToPlain(v)
  if (f?.type === 'boolean') return v ? t('fields.yes') : t('fields.no')
  if (f?.type === 'datetime') return formatDate(v)
  if (isRefField(f)) return refParts(f, v).map((p) => p.label).join(', ')
  if (Array.isArray(v)) return t('revisions.items', { count: v.length })
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
/** The fields where this version differs from the form now. */
const differences = computed(() => {
  const data = selected.value?.data ?? {}
  return Object.keys(data)
    .filter((k) => !k.endsWith('__media') && byKey.value.has(k) && cmsFormJson(data[k]) !== cmsFormJson(props.current[k]))
    .map((k) => {
      const f = byKey.value.get(k)
      const then = textOf(f, data[k])
      const now = textOf(f, props.current[k])
      const textual = ['text', 'slug', 'richtext', 'number', 'select'].includes(f?.type)
      const refs = isRefField(f) ? { then: refParts(f, data[k]), now: refParts(f, props.current[k]) } : null
      return { key: k, label: fieldLabel(f), then, now, refs, parts: textual ? wordDiff(now, then) : null }
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
            <!-- what the marks in the text mean (they are the only thing that tells added from removed) -->
            <p v-else-if="differences.some((d: any) => d.parts)" class="text-xs text-muted">
              <ins class="no-underline rounded-sm bg-success/15 px-0.5 text-highlighted">{{ t('revisions.legendAddedMark') }}</ins> {{ t('revisions.legendAdded') }}
              · <del class="rounded-sm bg-error/10 px-0.5 text-muted">{{ t('revisions.legendRemovedMark') }}</del> {{ t('revisions.legendRemoved') }}
            </p>
            <div v-for="d in differences" :key="d.key" class="rounded-lg border border-default p-3 space-y-1.5">
              <p class="text-xs font-medium text-muted">{{ d.label }}</p>
              <p v-if="d.parts" class="text-sm whitespace-pre-wrap leading-relaxed">
                <template v-for="(p, i) in d.parts" :key="i">
                  <span v-if="p.kind === 'same'">{{ p.text }}</span>
                  <ins v-else-if="p.kind === 'added'" class="no-underline rounded-sm bg-success/15 text-highlighted">{{ p.text }}</ins>
                  <del v-else class="rounded-sm bg-error/10 text-muted">{{ p.text }}</del>
                </template>
              </p>
              <div v-else-if="d.refs" class="grid grid-cols-2 gap-3 text-sm">
                <div v-for="side in (['then', 'now'] as const)" :key="side" class="min-w-0">
                  <span class="block text-xs text-dimmed">{{ t(`revisions.${side}`) }}</span>
                  <span v-if="!d.refs[side].length">—</span>
                  <ul v-else class="space-y-1.5">
                    <li v-for="(r, i) in d.refs[side]" :key="i" class="flex items-center gap-2 min-w-0">
                      <img v-if="r.thumb" :src="r.thumb" alt="" class="size-9 shrink-0 rounded object-cover border border-default" loading="lazy">
                      <span class="truncate">{{ r.label }}</span>
                    </li>
                  </ul>
                </div>
              </div>
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
