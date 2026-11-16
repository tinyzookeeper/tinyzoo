<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// The list of a page tree (definePages({ tree: true })): pages indented under their
// parents with the whole address under each title. Branches fold; a page is dragged
// into place (on a page's middle to put it under that one, near an edge to put it
// before or after) or, without a mouse — on a phone, from the keyboard — moved with
// "Move up / Move down" and the "Move…" dialog, which picks the parent and the place.
// Every move is one call to /_move: the page and everything below it get new
// addresses, and the server says how many changed.
const props = defineProps<{ entity: string; meta: any; canCreate: boolean }>()
const { t, tl, entitySingular, formatNumber } = useCmsI18n()
const toast = useToast()
const router = useRouter()
const confirm = useCmsConfirm()
const entryActions = useCmsEntryActions()

interface Row {
  id: string; parentId: string | null; title: string; slug: string; position: number
  status?: string; publishAt?: string | null; onSite: boolean; paths: Record<string, string>; locales: string[] | null; updatedAt: string
}
const { data, refresh, error } = await useFetch<{ rows: Row[]; maxDepth: number }>(() => `/api/cms/${props.entity}/_tree`, { key: `cms-tree:${props.entity}` })
useCmsLiveTopic(`list:${props.entity}`, () => refresh())
// The graph tells whether the site has redirects: the dialog can promise them.
const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const hasRedirects = computed(() => (graph.value ?? []).some((e: any) => e.preset === 'redirects'))

const publish = computed(() => props.meta?.publish)
const locales = computed(() => props.meta?.locales as { default: string; all: string[] } | null)
const maxDepth = computed(() => data.value?.maxDepth ?? 4)
const rows = computed(() => data.value?.rows ?? [])
const byId = computed(() => new Map(rows.value.map((r) => [r.id, r])))
const sortRows = (list: Row[]) => [...list].sort((a, b) => a.position - b.position || a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1))
// A page whose parent is not in the list (not readable by this person) is shown at the top.
const childrenOf = computed(() => {
  const m = new Map<string | null, Row[]>()
  for (const r of rows.value) {
    const key = r.parentId && byId.value.has(r.parentId) ? r.parentId : null
    m.set(key, [...(m.get(key) ?? []), r])
  }
  for (const [k, v] of m) m.set(k, sortRows(v))
  return m
})
const kids = (id: string | null) => childrenOf.value.get(id) ?? []
function descendants(id: string): Set<string> {
  const out = new Set<string>()
  const walk = (p: string) => { for (const c of kids(p)) if (!out.has(c.id)) { out.add(c.id); walk(c.id) } }
  walk(id)
  return out
}
const depthOf = (id: string): number => { let d = 1; for (let r = byId.value.get(id); r?.parentId && byId.value.has(r.parentId) && d < 50; r = byId.value.get(r.parentId)) d++; return d }
const heightOf = (id: string): number => kids(id).reduce((h, c) => Math.max(h, 1 + heightOf(c.id)), 0)

// ── folding (remembered per collection, in this browser) ──
const folded = ref<Set<string>>(new Set())
const foldKey = computed(() => `cms:tree-folded:${props.entity}`)
onMounted(() => {
  try { folded.value = new Set(JSON.parse(localStorage.getItem(foldKey.value) || '[]')) }
  catch { /* storage blocked: everything open */ }
})
function remember() {
  try { localStorage.setItem(foldKey.value, JSON.stringify([...folded.value])) }
  catch { /* for this visit only */ }
}
function toggle(id: string, open?: boolean) {
  const next = new Set(folded.value)
  const wantOpen = open ?? next.has(id)
  if (wantOpen) next.delete(id)
  else next.add(id)
  folded.value = next
  remember()
}
const branches = computed(() => rows.value.filter((r) => kids(r.id).length))
const allOpen = computed(() => branches.value.every((r) => !folded.value.has(r.id)))
function toggleAll() {
  folded.value = allOpen.value ? new Set(branches.value.map((r) => r.id)) : new Set()
  remember()
}

// ── filter ──
const q = ref('')
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const addressOf = (r: Row) => r.paths[locales.value?.default ?? ''] ?? Object.values(r.paths)[0] ?? ''
const matching = computed(() => {
  const term = fold(q.value.trim())
  if (!term) return null
  const keep = new Set<string>()
  for (const r of rows.value) {
    if (!fold(r.title).includes(term) && !fold(addressOf(r)).includes(term)) continue
    for (let c: Row | undefined = r; c && !keep.has(c.id); c = c.parentId ? byId.value.get(c.parentId) : undefined) keep.add(c.id)
  }
  return keep
})

// ── what is shown: the tree, flattened, in order ──
interface Shown { row: Row; depth: number; open: boolean; count: number }
const shown = computed<Shown[]>(() => {
  const out: Shown[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const r of kids(parent)) {
      if (matching.value && !matching.value.has(r.id)) continue
      const count = kids(r.id).length
      const open = !!matching.value || !folded.value.has(r.id)
      out.push({ row: r, depth, open, count })
      if (count && open) walk(r.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

const isLive = (r: Row) => !!publish.value && r.status === publish.value.publishedValue
const missingLocales = (r: Row) => (locales.value?.all ?? []).filter((c) => !(r.locales ?? []).includes(c))

// ── moving ──
const moving = ref(false)
async function move(id: string, parent: string | null, index: number): Promise<boolean> {
  const r = byId.value.get(id)
  if (moving.value || !r) return false
  // Told before asking the server (which checks it all again).
  if (parent && (parent === id || descendants(id).has(parent))) {
    toast.add({ title: t('tree.moveFailed'), description: t('validation.treeCycle', { loop: `${r.title} → … → ${r.title}` }), icon: 'i-lucide-x', color: 'error' })
    return false
  }
  if ((parent ? depthOf(parent) : 0) + 1 + heightOf(id) > maxDepth.value) {
    toast.add({ title: t('tree.moveFailed'), description: t('validation.treeDepth', { max: maxDepth.value }), icon: 'i-lucide-x', color: 'error' })
    return false
  }
  moving.value = true
  try {
    const res = await cmsFetch<{ moved: { from: string; to: string }[]; redirects: number }>(`/api/cms/${props.entity}/_move`, { method: 'POST', body: { id, parent, index } })
    await refresh()
    if (parent) toggle(parent, true)
    const changed = res.moved.length
    toast.add({
      title: t('tree.moved'),
      description: changed
        ? `${t('tree.movedAddresses', { count: changed })} ${res.redirects ? t('tree.redirectsMade') : hasRedirects.value ? '' : t('tree.noRedirects')}`.trim()
        : undefined,
      icon: 'i-lucide-check', color: 'success',
    })
    announce.value = t('tree.movedAnnounce', { name: r.title })
    return true
  }
  catch (err: any) {
    const issue = Array.isArray(err?.data?.data) ? err.data.data[0] : null
    toast.add({ title: t('tree.moveFailed'), description: issue ? cmsIssueMessage(issue, { type: 'slug' }, t as any) : cmsRequestError(err, t as any), icon: 'i-lucide-x', color: 'error' })
    return false
  }
  finally {
    moving.value = false
  }
}
const announce = ref('')

/** One place up or down among the siblings: the keyboard's (and the phone's) way to arrange. */
async function nudge(r: Row, delta: -1 | 1) {
  const sibs = kids(r.parentId && byId.value.has(r.parentId) ? r.parentId : null)
  const i = sibs.findIndex((s) => s.id === r.id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= sibs.length) return
  await move(r.id, r.parentId, j)
}

// Drag: the middle of a row puts the page under it, the top and bottom edges before and after it.
const dragId = ref<string | null>(null)
const drop = ref<{ id: string; mode: 'before' | 'after' | 'into' } | null>(null)
const blocked = computed(() => (dragId.value ? new Set([dragId.value, ...descendants(dragId.value)]) : new Set<string>()))
function onDragStart(e: DragEvent, r: Row) {
  dragId.value = r.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', r.id)
  }
}
function onDragOver(e: DragEvent, r: Row) {
  if (!dragId.value || blocked.value.has(r.id)) { drop.value = null; return }
  e.preventDefault()
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = (e.clientY - box.top) / box.height
  drop.value = { id: r.id, mode: y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'into' }
}
function endDrag() {
  dragId.value = null
  drop.value = null
}
async function onDrop(e: DragEvent, r: Row) {
  e.preventDefault()
  const id = dragId.value
  const d = drop.value
  endDrag()
  if (!id || !d || blocked.value.has(r.id)) return
  if (d.mode === 'into') return void await move(id, r.id, kids(r.id).filter((c) => c.id !== id).length)
  const parent = r.parentId && byId.value.has(r.parentId) ? r.parentId : null
  const sibs = kids(parent).filter((c) => c.id !== id)
  const at = sibs.findIndex((c) => c.id === r.id)
  await move(id, parent, d.mode === 'before' ? at : at + 1)
}

// ── the "Move…" dialog: where it goes and in which place ──
const dialog = ref<{ row: Row; parent: string | null; place: string } | null>(null)
const dialogOpen = computed({ get: () => !!dialog.value, set: (v: boolean) => { if (!v) dialog.value = null } })
const trail = (r: Row): string => {
  const parts: string[] = []
  for (let c: Row | undefined = r; c && parts.length < 12; c = c.parentId ? byId.value.get(c.parentId) : undefined) parts.unshift(c.title || t('common.untitled'))
  return parts.join(' / ')
}
/** Where the page may go: the top level, or any page that is not it or below it, as deep as the tree allows. */
const parentChoices = computed(() => {
  const d = dialog.value
  if (!d) return []
  const own = new Set([d.row.id, ...descendants(d.row.id)])
  const height = heightOf(d.row.id)
  const items = [{ value: '__top', label: t('tree.moveTop') }]
  const walk = (parent: string | null) => {
    for (const r of kids(parent)) {
      if (own.has(r.id)) continue
      if (depthOf(r.id) + 1 + height <= maxDepth.value) items.push({ value: r.id, label: trail(r) })
      walk(r.id)
    }
  }
  walk(null)
  return items
})
const placeChoices = computed(() => {
  const d = dialog.value
  if (!d) return []
  const sibs = kids(d.parent).filter((s) => s.id !== d.row.id)
  if (!sibs.length) return [{ value: '__first', label: t('tree.moveOnly') }]
  return [{ value: '__first', label: t('tree.moveFirst') }, ...sibs.map((s) => ({ value: s.id, label: t('tree.moveAfter', { name: s.title || t('common.untitled') }) }))]
})
/** Where the page sits among its siblings after a move: where it is now, or last under a new parent. */
function placeIn(parent: string | null, r: Row): string {
  const sibs = kids(parent).filter((s) => s.id !== r.id)
  const same = (r.parentId && byId.value.has(r.parentId) ? r.parentId : null) === parent
  if (!sibs.length) return '__first'
  if (!same) return sibs[sibs.length - 1]!.id
  const before = kids(parent).findIndex((s) => s.id === r.id) - 1
  return before < 0 ? '__first' : kids(parent)[before]!.id
}
function openMove(r: Row) {
  const parent = r.parentId && byId.value.has(r.parentId) ? r.parentId : null
  dialog.value = { row: r, parent, place: placeIn(parent, r) }
}
watch(() => dialog.value?.parent, (parent) => { if (dialog.value && parent !== undefined) dialog.value.place = placeIn(parent, dialog.value.row) })
async function confirmMove() {
  const d = dialog.value
  if (!d) return
  const sibs = kids(d.parent).filter((s) => s.id !== d.row.id)
  const index = d.place === '__first' ? 0 : sibs.findIndex((s) => s.id === d.place) + 1
  if (await move(d.row.id, d.parent, index)) dialog.value = null
}

// ── a row's own actions ──
async function setPublished(r: Row, next: boolean) {
  const p = publish.value
  if (!p) return
  // The pages under this one that are on the website go off it with this one.
  const below = next ? 0 : [...descendants(r.id)].filter((id) => rows.value.find((x) => x.id === id)?.onSite).length
  if (!next && !await confirm({
    title: t('list.unpublishTitle', { count: 1 }), description: below ? t('tree.unpublishBranchCount', { count: below }) : t('list.unpublishBody', { count: 1 }),
    icon: 'i-lucide-eye-off', confirmLabel: t('editor.unpublish'), color: 'warning',
  })) return
  try {
    await cmsFetch(`/api/cms/${props.entity}/${r.id}`, { method: 'PATCH', body: { [p.field]: next ? p.publishedValue : p.draftValue } })
    toast.add({ title: next ? t('editor.publishedToast') : t('editor.unpublishedToast'), icon: 'i-lucide-check', color: 'success' })
    refresh()
  }
  catch (e: any) {
    toast.add({ title: t('team.actionFailed'), description: cmsRequestError(e, t as any), icon: 'i-lucide-x', color: 'error' })
  }
}
async function duplicate(r: Row) {
  const copy = await entryActions.duplicate(props.entity, props.meta, r.id)
  if (copy) await router.push(`/admin/${props.entity}/${copy}`)
}
async function remove(r: Row) {
  if (await entryActions.remove(props.entity, props.meta, r.id, r.title)) refresh()
}
function menu(r: Row, index: number, count: number): DropdownMenuItem[][] {
  const groups: DropdownMenuItem[][] = []
  const p = publish.value
  if (p && props.meta?.can?.publish !== false) {
    groups.push([isLive(r)
      ? { label: t('editor.unpublish'), icon: 'i-lucide-eye-off', onSelect: () => setPublished(r, false) }
      : { label: t('editor.publish'), icon: 'i-lucide-globe', onSelect: () => setPublished(r, true) }])
  }
  const entry: DropdownMenuItem[] = []
  const address = addressOf(r)
  if (address && r.onSite) entry.push({ label: t('editor.viewOnSite'), icon: 'i-lucide-arrow-up-right', to: address, target: '_blank' })
  if (props.canCreate) entry.push({ label: t('tree.addSubpage'), icon: 'i-lucide-corner-down-right', to: `/admin/${props.entity}/new?parent=${r.id}` })
  if (props.meta?.can?.create !== false) entry.push({ label: t('editor.duplicate'), icon: 'i-lucide-copy', onSelect: () => duplicate(r) })
  if (entry.length) groups.push(entry)
  if (props.meta?.can?.update !== false) {
    groups.push([
      { label: t('tree.move'), icon: 'i-lucide-folder-input', onSelect: () => openMove(r) },
      { label: t('tree.up'), icon: 'i-lucide-arrow-up', disabled: index === 0, onSelect: () => nudge(r, -1) },
      { label: t('tree.down'), icon: 'i-lucide-arrow-down', disabled: index === count - 1, onSelect: () => nudge(r, 1) },
    ])
  }
  if (props.meta?.can?.delete !== false) groups.push([{ label: t('editor.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(r) }])
  return groups
}
const siblingIndex = (r: Row) => kids(r.parentId && byId.value.has(r.parentId) ? r.parentId : null).findIndex((s) => s.id === r.id)
const siblingCount = (r: Row) => kids(r.parentId && byId.value.has(r.parentId) ? r.parentId : null).length
const canMove = computed(() => props.meta?.can?.update !== false)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
      <p class="text-sm text-muted max-sm:hidden">{{ canMove ? t('tree.hint') : '' }}</p>
      <div class="flex items-center gap-1 w-full sm:w-auto">
        <UInput
          v-model="q" icon="i-lucide-search" :placeholder="t('common.search')" size="sm" variant="ghost" class="w-full sm:w-64" :aria-label="t('common.search')"
        >
          <template v-if="q" #trailing>
            <UButton color="neutral" variant="link" size="xs" icon="i-lucide-x" :aria-label="t('common.clear')" @click="q = ''" />
          </template>
        </UInput>
        <UTooltip v-if="branches.length" :text="allOpen ? t('tree.collapseAll') : t('tree.expandAll')">
          <UButton
            color="neutral" variant="ghost" size="sm" :icon="allOpen ? 'i-lucide-chevrons-down-up' : 'i-lucide-chevrons-up-down'"
            :aria-label="allOpen ? t('tree.collapseAll') : t('tree.expandAll')" @click="toggleAll"
          />
        </UTooltip>
      </div>
    </div>

    <div class="cms-card overflow-hidden">
      <CmsLoadError v-if="error" :error="error" @retry="refresh()" />
      <CmsEmptyState
        v-else-if="!rows.length" :icon="meta?.icon" :character="entity"
        :title="t('list.emptyTitle', { label: (tl(meta?.label) || entity).toLowerCase() })" :description="tl(meta?.description) || t('list.emptyDescription')"
      >
        <template v-if="canCreate" #actions>
          <UButton :to="`/admin/${entity}/new`" icon="i-lucide-plus">{{ t('list.emptyAction') }}</UButton>
        </template>
      </CmsEmptyState>
      <CmsEmptyState v-else-if="!shown.length" variant="no-results" :title="t('list.noResultsTitle', { q })" :description="t('list.noResultsDescription')">
        <template #actions>
          <UButton color="neutral" variant="outline" @click="q = ''">{{ t('list.clearSearch') }}</UButton>
        </template>
      </CmsEmptyState>

      <ul v-else :aria-label="t('tree.label')">
        <li
          v-for="s in shown" :key="s.row.id"
          class="cms-tree-row relative flex items-center gap-1.5 border-b border-(--ui-border-muted) last:border-0 py-2 pr-2 hover:bg-elevated/40 transition-colors"
          :class="[
            dragId === s.row.id ? 'opacity-40' : '',
            drop?.id === s.row.id && drop.mode === 'into' ? 'bg-elevated ring-2 ring-inset ring-(--ui-border-accented)' : '',
            drop?.id === s.row.id && drop.mode === 'before' ? 'cms-tree-before' : '',
            drop?.id === s.row.id && drop.mode === 'after' ? 'cms-tree-after' : '',
          ]"
          :style="{ paddingLeft: `${0.5 + s.depth * 1.5}rem` }" :aria-level="s.depth + 1"
          @dragover="onDragOver($event, s.row)" @drop="onDrop($event, s.row)" @dragleave="drop = drop?.id === s.row.id ? null : drop"
        >
          <!-- fold / unfold -->
          <UButton
            v-if="s.count" size="xs" color="neutral" variant="ghost" class="shrink-0"
            :icon="s.open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" :aria-expanded="s.open"
            :aria-label="t(s.open ? 'tree.collapse' : 'tree.expand', { name: s.row.title })" @click="toggle(s.row.id)"
          />
          <span v-else class="size-6 shrink-0" aria-hidden="true" />
          <!-- the handle: a mouse drags here (not offered on touch screens: use Move…) -->
          <span
            v-if="canMove && !q" class="shrink-0 cursor-grab text-dimmed hover:text-default [@media(pointer:coarse)]:hidden" draggable="true"
            :title="t('tree.drag', { name: s.row.title })" @dragstart="onDragStart($event, s.row)" @dragend="endDrag"
          >
            <UIcon name="i-lucide-grip-vertical" class="size-4" aria-hidden="true" />
          </span>
          <div class="relative min-w-0 flex-1">
            <NuxtLink :to="`/admin/${entity}/${s.row.id}`" class="block truncate text-sm font-medium text-highlighted after:absolute after:-inset-y-2 after:inset-x-0">
              {{ s.row.title || t('common.untitled') }}
            </NuxtLink>
            <p class="truncate font-mono text-xs text-muted">{{ addressOf(s.row) || '/' + s.row.slug }}</p>
            <!-- below the wide layout the columns are gone: the state (and the missing language) sit under the address -->
            <p v-if="publish || missingLocales(s.row).length" class="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap lg:hidden">
              <span class="sm:hidden">
                <span v-if="isLive(s.row) && !s.row.onSite" class="inline-flex items-center gap-1.5 text-xs text-muted">
                  <UIcon name="i-lucide-eye-off" class="size-3.5" aria-hidden="true" />{{ t('tree.hiddenShort') }}
                </span>
                <CmsStatusBadge v-else-if="publish" :published="isLive(s.row)" :scheduled-for="publish.dateField ? s.row.publishAt : null" class="!text-xs" />
              </span>
              <span v-if="meta?.locales && missingLocales(s.row).length" class="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium cms-unsaved">
                {{ t('translation.missing', { lang: missingLocales(s.row).map((c: string) => c.toUpperCase()).join(', ') }) }}
              </span>
            </p>
          </div>
          <span v-if="s.count && !s.open" class="shrink-0 text-xs text-dimmed max-sm:hidden">{{ t('tree.subpages', { count: formatNumber(s.count) }) }}</span>
          <span v-if="meta?.locales && missingLocales(s.row).length" class="shrink-0 hidden lg:inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium cms-unsaved">
            {{ t('translation.missing', { lang: missingLocales(s.row).map((c: string) => c.toUpperCase()).join(', ') }) }}
          </span>
          <span class="shrink-0 max-sm:hidden">
            <UTooltip v-if="isLive(s.row) && !s.row.onSite" :text="t('tree.hiddenByParent')">
              <span class="inline-flex items-center gap-1.5 text-sm text-muted" tabindex="0">
                <UIcon name="i-lucide-eye-off" class="size-3.5" aria-hidden="true" />{{ t('tree.hiddenShort') }}
              </span>
            </UTooltip>
            <CmsStatusBadge v-else-if="publish" :published="isLive(s.row)" :scheduled-for="publish.dateField ? s.row.publishAt : null" />
          </span>
          <UDropdownMenu :items="menu(s.row, siblingIndex(s.row), siblingCount(s.row))" :content="{ align: 'end' }">
            <UButton class="relative z-10 shrink-0" color="neutral" variant="ghost" size="sm" icon="i-lucide-ellipsis" :aria-label="t('editor.moreActions')" />
          </UDropdownMenu>
        </li>
      </ul>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ announce }}</p>

    <UModal
      v-model:open="dialogOpen" :title="t('tree.moveTitle', { name: dialog?.row.title ?? '' })" :description="t('tree.moveBody')"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <template #body>
        <div v-if="dialog" class="space-y-4">
          <UFormField :label="t('tree.moveParent')">
            <USelectMenu
              :model-value="dialog.parent ?? '__top'" :items="parentChoices" value-key="value" class="w-full" icon="i-lucide-folder-tree" :aria-label="t('tree.moveParent')"
              @update:model-value="(v: string) => { dialog!.parent = v === '__top' ? null : v }"
            />
          </UFormField>
          <UFormField :label="t('tree.movePosition')">
            <USelectMenu v-model="dialog.place" :items="placeChoices" value-key="value" class="w-full" icon="i-lucide-arrow-up-down" :aria-label="t('tree.movePosition')" />
          </UFormField>
          <p class="text-sm text-muted">{{ hasRedirects ? t('tree.moveRedirects') : t('tree.moveNoRedirects') }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="dialog = null">{{ t('common.cancel') }}</UButton>
          <UButton icon="i-lucide-folder-input" :loading="moving" @click="confirmMove">{{ t('tree.moveConfirm') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* A line where the dragged page would land: before or after this one. */
.cms-tree-before::before,
.cms-tree-after::after {
  content: '';
  position: absolute;
  inset-inline: 0.5rem;
  height: 2px;
  background: var(--ui-text-highlighted);
  border-radius: 1px;
  pointer-events: none;
}
.cms-tree-before::before { top: -1px; }
.cms-tree-after::after { bottom: -1px; }
</style>
