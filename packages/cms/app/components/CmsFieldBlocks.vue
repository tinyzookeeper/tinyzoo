<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// Page builder: an ordered list of typed blocks. Each block is a collapsible card —
// its type, a one-line summary when collapsed, and a marker when something inside
// needs attention. Insert between blocks or at the end through a searchable picker;
// move, duplicate and remove from the block's "…" menu (keyboard- and touch-friendly,
// no drag required).
const props = defineProps<{ field: any; entity: string }>()
const model = defineModel<any[] | null>()
const { t, tl } = useCmsI18n()
const form = inject<{ issues?: Record<string, string> } | null>('cmsForm', null)

const defs = computed<Record<string, any>>(() => props.field.meta?.blocks ?? {})
const blocks = computed<any[]>(() => (Array.isArray(model.value) ? model.value : []))
const open = reactive<Record<string, boolean>>({})

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
  next.splice(index, 1)
  update(next)
}
function setField(index: number, key: string, value: unknown) {
  const next = [...blocks.value]
  next[index] = { ...next[index], [key]: value }
  update(next)
}

/** First non-empty text-ish value, for the collapsed header. */
function summary(b: any): string {
  for (const f of defs.value[b.type]?.fields ?? []) {
    const v = b[f.key]
    if (typeof v === 'string' && v.trim() && f.type !== 'media') return v.trim()
    if (f.type === 'richtext' && v?.content) {
      const text = JSON.stringify(v).match(/"text":"([^"]{1,120})/)?.[1]
      if (text) return text
    }
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
      { label: t('blocks.duplicate'), icon: 'i-lucide-copy', onSelect: () => duplicate(index) },
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
const addLabel = computed(() => (onlyType.value ? t('blocks.addType', { label: tl(defs.value[onlyType.value]?.label, onlyType.value) }) : t('blocks.add')))
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
      v-if="!blocks.length && !onlyType" icon="i-lucide-layout-template" :title="t('blocks.emptyTitle')" :description="t('blocks.emptyDescription')"
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

      <div class="cms-card" :class="hasIssue(i) ? 'border-error' : ''">
        <div class="flex items-center gap-2 pl-3 pr-1.5 py-2">
          <button
            type="button" class="flex flex-1 min-w-0 items-center gap-2.5 text-left"
            :aria-expanded="!!open[b.id]"
            @click="open[b.id] = !open[b.id]"
          >
            <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed shrink-0 transition-transform" :class="open[b.id] ? 'rotate-90' : ''" />
            <UIcon :name="defs[b.type]?.icon ?? 'i-lucide-square'" class="size-4 text-muted shrink-0" />
            <span class="text-sm font-medium text-highlighted shrink-0">{{ tl(defs[b.type]?.label, b.type) }}</span>
            <span v-if="!open[b.id] && summary(b)" class="text-sm text-muted truncate">{{ summary(b) }}</span>
            <span v-if="hasIssue(i)" class="ml-auto shrink-0 inline-flex items-center gap-1 text-xs text-error">
              <span class="size-1.5 rounded-full bg-error" aria-hidden="true" />{{ t('blocks.hasErrors') }}
            </span>
          </button>
          <UDropdownMenu :items="menu(i)" :content="{ align: 'end' }">
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-ellipsis" :aria-label="t('blocks.actions')" />
          </UDropdownMenu>
        </div>
        <div v-if="open[b.id]" class="border-t border-default px-4 py-4 space-y-5">
          <p v-if="!defs[b.type]" class="text-sm text-muted">{{ b.type }}</p>
          <CmsField
            v-for="f in defs[b.type]?.fields ?? []" :key="f.key"
            :model-value="b[f.key]" :field="f" :entity="entity" :id-prefix="`${field.key}-${b.id}-`"
            :error="form?.issues?.[`${field.key}.${i}.${f.key}`]"
            @update:model-value="(v: unknown) => setField(i, f.key, v)"
          />
        </div>
      </div>
    </template>

    <UButton v-if="blocks.length || onlyType" color="neutral" variant="ghost" icon="i-lucide-plus" size="sm" @click="openPicker(blocks.length)">
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
