<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { isLinkRef } from '../../src/linkref'

// Page builder: an ordered list of typed blocks. Each block is a collapsible card —
// its type, a one-line summary when collapsed, and a marker when something inside
// needs attention. Insert between blocks or at the end through a searchable picker;
// move, duplicate and remove from the block's "…" menu (keyboard- and touch-friendly),
// or drag a block by its handle. A removed block can be brought back from the toast.
// `f.list()` uses the same editor with one item type: items read as their own text
// ("Jana Nováková · Coach"), not as "Item", and a `sub` switch indents an item
// under the one above (menus). A block can hold a list (FAQ questions, feature
// cards): the same editor again, inside the open block, under its full path
// ("sections.2.items"), so a problem in item 3 marks both the item and the block.
const props = defineProps<{ field: any; entity: string }>()
// Text inside blocks is edited on its own (not shared), even on a shared entry.
provide('cmsCollab', null)
const model = defineModel<any[] | null>()
const { t, tl } = useCmsI18n()
const toast = useToast()
const confirm = useCmsConfirm()
const form = inject<{ issues?: Record<string, string> } | null>('cmsForm', null)
const list = computed<{ max: number | null; itemLabel: any } | null>(() => props.field.meta?.list ?? null)
const full = computed(() => !!list.value?.max && blocks.value.length >= list.value.max)

const defs = computed<Record<string, any>>(() => props.field.meta?.blocks ?? {})
const blocks = computed<any[]>(() => (Array.isArray(model.value) ? model.value : []))
const open = reactive<Record<string, boolean>>({})
// A link to a page is stored as a reference (`cms:page/<id>`): the collapsed row says which
// page it is (title and address), asked for in one batch like the expanded row does.
const { request: requestTargets, find: findTarget } = useCmsLinkTargets()
watchEffect(() => {
  const refs: string[] = []
  for (const b of blocks.value) for (const v of Object.values(b ?? {})) if (typeof v === 'string' && isLinkRef(v)) refs.push(v)
  if (refs.length) requestTargets(refs)
})

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 12)

function blank(type: string) {
  const def = defs.value[type]
  const b: Record<string, any> = { id: newId(), type }
  for (const f of def?.fields ?? []) {
    b[f.key] = f.type === 'boolean' ? false : f.type === 'richtext' ? { type: 'doc', content: [] } : null
  }
  return b
}

function update(next: any[]) {
  model.value = next
}
function insertAt(index: number, type: string) {
  const b = blank(type)
  const next = [...blocks.value]
  next.splice(index, 0, b)
  update(next)
  // Only the new one opens: a page with many blocks stays readable.
  for (const k of Object.keys(open)) open[k] = false
  open[b.id] = true
  pickerOpen.value = false
}
function move(index: number, by: number) {
  const next = [...blocks.value]
  const [b] = next.splice(index, 1)
  next.splice(index + by, 0, b)
  update(next)
}
function duplicate(index: number) {
  const copy = { ...structuredClone(toRaw(blocks.value[index])), id: newId() }
  const next = [...blocks.value]
  next.splice(index + 1, 0, copy)
  update(next)
  open[copy.id] = true
}
function remove(index: number) {
  const next = [...blocks.value]
  const [gone] = next.splice(index, 1)
  update(next)
  if (!gone) return
  toast.add({
    title: t('blocks.removed', { label: shortName(gone, index) }),
    icon: 'i-lucide-trash-2',
    actions: [{ label: t('blocks.undo'), color: 'neutral', variant: 'outline', onClick: () => {
      const back = [...blocks.value]
      back.splice(Math.min(index, back.length), 0, gone)
      update(back)
    } }],
  })
}
/** One short name for a block (its first text, else its kind): for messages. */
function shortName(b: any, index: number): string {
  const first = summary(b).split(' · ')[0] ?? ''
  const name = first || itemLabel(b, index)
  return name.length > 40 ? `${name.slice(0, 39).trimEnd()}…` : name
}
/** A list item's name when it has no text yet: "Item 3". */
function itemLabel(b: any, index: number): string {
  return list.value ? `${tl(list.value.itemLabel ?? defs.value[b.type]?.label, t('blocks.item'))} ${index + 1}` : tl(defs.value[b.type]?.label, b.type)
}
const indented = (b: any) => !!list.value && b?.sub === true
// A block of a type the site no longer has, or one whose old shape could not be
// upgraded: kept as stored, shown as a card of its own (not editable), removable.
const isGone = (b: any) => !defs.value[b?.type]
const isStale = (b: any) => !isGone(b) && b?.__upgradeFailed === true
const isLocked = (b: any) => isGone(b) || isStale(b)
/** What a locked card is called: its kind's label when the site still has it, else the stored type. */
const lockedName = (b: any) => tl(defs.value[b?.type]?.label, String(b?.type || t('blocks.item')))
/**
 * What a locked block holds, so an editor can tell which one it is before removing it:
 * its first few texts, whatever their field names are (the site no longer describes them).
 */
function storedText(b: any): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(b ?? {})) {
    if (k === 'id' || k === 'type' || k === 'v' || k.startsWith('__')) continue
    if (typeof v === 'string' && v.trim()) parts.push(v.trim())
    else if (v && typeof v === 'object') {
      const text = JSON.stringify(v).match(/"text":"([^"]{1,120})/)?.[1]
      if (text) parts.push(text)
    }
    if (parts.length === 3) break
  }
  const joined = parts.join(' · ')
  return joined.length > 120 ? `${joined.slice(0, 119).trimEnd()}…` : joined
}
/** A block the site no longer has cannot be added again: removing it asks first (the others have "Undo"). */
async function removeLocked(index: number) {
  const b = blocks.value[index]
  if (isGone(b) && !(await confirm({
    title: t('blocks.removeGoneTitle', { type: b.type }), description: t('blocks.removeGoneBody'),
    icon: 'i-lucide-trash-2', color: 'error', confirmLabel: t('blocks.removeGoneConfirm'), cancelLabel: t('common.cancel'),
  }))) return
  remove(blocks.value.indexOf(b))
}

// Drag by the handle (the rest of the card stays clickable and selectable).
const armed = ref<string | null>(null)
const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)
function onDrop(to: number) {
  const from = dragFrom.value
  dragFrom.value = dragOver.value = null
  armed.value = null
  if (from === null || from === to) return
  const next = [...blocks.value]
  const [b] = next.splice(from, 1)
  next.splice(from < to ? to - 1 : to, 0, b)
  update(next)
}
/** A list inside block `index`, keyed by its full path (errors and ids find it). */
function nested(f: any, index: number) {
  return { ...f, key: `${props.field.key}.${index}.${f.key}` }
}
function setField(index: number, key: string, value: unknown) {
  const next = [...blocks.value]
  next[index] = { ...next[index], [key]: value }
  update(next)
}

/** What the block says, for the collapsed header: its first few values, choices by their labels ("Plavání · Úterý · 18:00"). */
function summary(b: any): string {
  const parts: string[] = []
  for (const f of defs.value[b.type]?.fields ?? []) {
    const v = b[f.key]
    if (f.type === 'select' && typeof v === 'string' && v) parts.push(tl(f.meta?.labels?.[v], v))
    else if (typeof v === 'string' && isLinkRef(v)) {
      // Never the raw reference: the page's title and address once they are known.
      const target = findTarget(v)
      if (target) parts.push(target.state === 'missing' ? t('link.missingTitle') : [target.title, target.title && target.path ? `(${target.path})` : target.path].filter(Boolean).join(' '))
    }
    else if (typeof v === 'string' && v.trim() && f.type !== 'media') parts.push(v.trim())
    else if (f.type === 'richtext' && v?.content) {
      const text = JSON.stringify(v).match(/"text":"([^"]{1,120})/)?.[1]
      if (text) parts.push(text)
    }
    if (parts.length === 3) break
  }
  return parts.join(' · ')
}
/**
 * The server's refusal of the block as a whole ("saved by a newer version", "this type no
 * longer exists", fields the website does not know), shown on the block itself: those
 * issues have no field of their own, so they would otherwise only surface under the list.
 */
function blockIssue(index: number): string {
  const prefix = `${props.field.key}.${index}`
  const known = new Set<string>((defs.value[blocks.value[index]?.type]?.fields ?? []).map((f: any) => f.key))
  for (const [key, message] of Object.entries(form?.issues ?? {})) {
    if (key === prefix) return message
    if (key.startsWith(`${prefix}.`) && !known.has(key.slice(prefix.length + 1).split('.')[0]!)) return message
  }
  return ''
}
const hasIssue = (index: number) => Object.keys(form?.issues ?? {}).some((k) => k.startsWith(`${props.field.key}.${index}.`) || k === `${props.field.key}.${index}`)
// A block with a problem opens itself.
watch(() => ({ ...(form?.issues ?? {}) }), () => {
  blocks.value.forEach((b, i) => { if (hasIssue(i)) open[b.id] = true })
})

function menu(index: number): DropdownMenuItem[][] {
  return [
    [
      { label: t('blocks.moveUp'), icon: 'i-lucide-arrow-up', disabled: index === 0, onSelect: () => move(index, -1) },
      { label: t('blocks.moveDown'), icon: 'i-lucide-arrow-down', disabled: index === blocks.value.length - 1, onSelect: () => move(index, 1) },
      ...(isLocked(blocks.value[index]) ? [] : [{ label: t('blocks.duplicate'), icon: 'i-lucide-copy', onSelect: () => duplicate(index) }]),
    ],
    [{ label: t('blocks.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(index) }],
  ]
}

// ── picker ──
const pickerOpen = ref(false)
const pickerAt = ref(0)
const pickerQuery = ref('')
// One block type (e.g. menu links): no picker, the button names the type.
const onlyType = computed(() => {
  const types = Object.keys(defs.value)
  return types.length === 1 ? types[0]! : null
})
// A list says "Add item" (a label like "Opening hours" doesn't bend into a sentence).
const addLabel = computed(() => (list.value ? t('blocks.addItem') : onlyType.value ? t('blocks.addType', { label: tl(defs.value[onlyType.value]?.label, onlyType.value) }) : t('blocks.add')))
function openPicker(at: number) {
  if (onlyType.value) return insertAt(at, onlyType.value)
  pickerAt.value = at
  pickerQuery.value = ''
  pickerOpen.value = true
}
const choices = computed(() => {
  const q = pickerQuery.value.trim().toLowerCase()
  return Object.entries(defs.value)
    .map(([type, d]) => ({ type, label: tl(d.label, type), description: tl(d.description), icon: d.icon }))
    .filter((c) => !q || c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
})
</script>

<template>
  <div class="space-y-2">
    <CmsEmptyState
      v-if="!blocks.length && !onlyType" plain icon="i-lucide-layout-template" :title="t('blocks.emptyTitle')" :description="t('blocks.emptyDescription')"
      class="rounded-(--ui-radius) border border-dashed border-accented !py-10"
    >
      <template #actions>
        <UButton color="neutral" variant="outline" icon="i-lucide-plus" @click="openPicker(0)">{{ t('blocks.emptyAction') }}</UButton>
      </template>
    </CmsEmptyState>
    <p v-else-if="!blocks.length" class="text-sm text-muted">{{ t('blocks.emptyGeneric') }}</p>

    <template v-for="(b, i) in blocks" :key="b.id">
      <!-- insertion point between blocks -->
      <div v-if="i > 0" class="group relative h-2 -my-1 flex items-center justify-center">
        <button
          type="button" class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity size-5 rounded-full border border-default bg-default grid place-items-center text-muted hover:text-highlighted z-10"
          :aria-label="t('blocks.insertHere')" @click="openPicker(i)"
        >
          <UIcon name="i-lucide-plus" class="size-3" />
        </button>
        <span class="absolute inset-x-0 top-1/2 h-px bg-transparent group-hover:bg-(--ui-border)" aria-hidden="true" />
      </div>

      <!-- a block the site no longer knows (or could not bring up to date): kept, not editable -->
      <div
        v-if="isLocked(b)" role="group" :aria-label="lockedName(b)" data-cms-block-locked
        class="cms-card flex items-start gap-3 px-3 py-3" :class="[blockIssue(i) ? 'border-error' : 'border-warning/60', indented(b) ? 'ml-6' : '']"
      >
        <UIcon name="i-lucide-triangle-alert" class="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
        <div class="min-w-0 flex-1 space-y-0.5">
          <p class="text-sm font-medium text-highlighted">{{ t(isGone(b) ? 'blocks.gone' : 'blocks.stale', { type: lockedName(b) }) }}</p>
          <p v-if="storedText(b)" class="line-clamp-2 break-words text-xs text-toned">{{ t('blocks.storedContent', { text: storedText(b) }) }}</p>
          <p class="text-xs text-muted">{{ t(isGone(b) ? 'blocks.goneHelp' : 'blocks.staleHelp') }}</p>
          <p v-if="blockIssue(i)" role="alert" class="pt-1 text-xs font-medium text-error">{{ blockIssue(i) }}</p>
        </div>
        <UButton
          color="error" variant="ghost" size="sm" icon="i-lucide-trash-2" class="shrink-0 pointer-coarse:min-h-11"
          :aria-label="t('blocks.removeNamed', { name: lockedName(b) })" @click="removeLocked(i)"
        >{{ t('blocks.remove') }}</UButton>
      </div>
      <div
        v-else class="cms-card transition-[margin,box-shadow]"
        :class="[hasIssue(i) ? 'border-error' : '', indented(b) ? 'ml-6' : '', dragOver === i && dragFrom !== i ? 'ring-2 ring-(--ui-primary)/40' : '', dragFrom === i ? 'opacity-50' : '']"
        :draggable="armed === b.id"
        @dragstart.stop="(e: DragEvent) => { dragFrom = i; e.dataTransfer?.setData('text/plain', b.id) }"
        @dragover.prevent.stop="dragFrom !== null && (dragOver = i)" @dragleave.stop="dragOver === i && (dragOver = null)"
        @drop.prevent.stop="onDrop(dragOver !== null && dragFrom !== null && dragOver > dragFrom ? i + 1 : i)"
        @dragend.stop="dragFrom = dragOver = null; armed = null"
      >
        <div class="flex items-center gap-2 pl-1.5 pr-1.5 py-2">
          <span
            v-if="blocks.length > 1" class="cursor-grab touch-none text-dimmed hover:text-muted shrink-0 p-1" :title="t('blocks.drag')" aria-hidden="true"
            @pointerdown="armed = b.id" @pointerup="armed = null"
          ><UIcon name="i-lucide-grip-vertical" class="size-4" /></span>
          <button
            type="button" class="flex flex-1 min-w-0 items-center gap-2.5 text-left"
            :aria-expanded="!!open[b.id]"
            @click="open[b.id] = !open[b.id]"
          >
            <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed shrink-0 transition-transform" :class="open[b.id] ? 'rotate-90' : ''" />
            <template v-if="list">
              <UIcon v-if="indented(b)" name="i-lucide-corner-down-right" class="size-4 text-dimmed shrink-0" />
              <span class="text-sm font-medium text-highlighted truncate">{{ summary(b) || itemLabel(b, i) }}</span>
            </template>
            <template v-else>
              <UIcon :name="defs[b.type]?.icon ?? 'i-lucide-square'" class="size-4 text-muted shrink-0" />
              <span class="text-sm font-medium text-highlighted shrink-0">{{ tl(defs[b.type]?.label, b.type) }}</span>
              <span v-if="!open[b.id] && summary(b)" class="text-sm text-muted truncate">{{ summary(b) }}</span>
            </template>
            <span v-if="hasIssue(i)" class="ml-auto shrink-0 inline-flex items-center gap-1 text-xs text-error">
              <span class="size-1.5 rounded-full bg-error" aria-hidden="true" />{{ t('blocks.hasErrors') }}
            </span>
          </button>
          <UDropdownMenu :items="menu(i)" :content="{ align: 'end' }">
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-ellipsis" class="pointer-coarse:size-11" :aria-label="t('blocks.actions')" />
          </UDropdownMenu>
        </div>
        <div v-if="open[b.id]" class="border-t border-default px-4 py-4 space-y-5">
          <p v-if="blockIssue(i)" role="alert" class="flex items-start gap-1.5 text-sm text-error">
            <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />{{ blockIssue(i) }}
          </p>
          <p v-if="!defs[b.type]" class="text-sm text-muted">{{ b.type }}</p>
          <CmsField
            v-for="f in defs[b.type]?.fields ?? []" :key="f.key"
            :model-value="b[f.key]" :field="f.type === 'blocks' || f.type === 'group' ? nested(f, i) : f" :entity="entity" :id-prefix="`${field.key}-${b.id}-`"
            :error="form?.issues?.[`${field.key}.${i}.${f.key}`]"
            @update:model-value="(v: unknown) => setField(i, f.key, v)"
          />
        </div>
      </div>
    </template>

    <UButton v-if="(blocks.length || onlyType) && !full" color="neutral" variant="ghost" icon="i-lucide-plus" size="sm" @click="openPicker(blocks.length)">
      {{ addLabel }}
    </UButton>

    <UModal v-model:open="pickerOpen" :title="t('blocks.pickerTitle')">
      <template #body>
        <UInput v-model="pickerQuery" icon="i-lucide-search" :placeholder="t('blocks.search')" autofocus class="w-full mb-3" />
        <ul class="-mx-2 space-y-0.5">
          <li v-for="c in choices" :key="c.type">
            <button type="button" class="w-full flex items-start gap-3 rounded-(--ui-radius) px-2 py-2 text-left hover:bg-elevated/70" @click="insertAt(pickerAt, c.type)">
              <span class="size-8 shrink-0 rounded-md border border-default grid place-items-center text-muted">
                <UIcon :name="c.icon" class="size-4" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-medium text-highlighted">{{ c.label }}</span>
                <span v-if="c.description" class="block text-xs text-muted">{{ c.description }}</span>
              </span>
            </button>
          </li>
        </ul>
        <p v-if="!choices.length" class="text-sm text-muted px-1 py-2">{{ t('blocks.noMatch') }}</p>
      </template>
    </UModal>
  </div>
</template>
