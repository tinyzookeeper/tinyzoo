<script setup lang="ts">
// An administrator arranges the admin's menu for the whole site: which rows sit beside Home,
// in each group and behind "Settings", and in what order. Rows are dragged, or moved with the
// arrows (which carry a row over to the next place at either end). Saved with PUT /api/cms/_menu;
// "Back to the original" forgets the arrangement (DELETE) and the site's own layout shows again.
import type { CmsMenuRow } from '../composables/useCmsMenu'

const props = defineProps<{ graph: any[] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useCmsI18n()
const toast = useToast()
const confirm = useCmsConfirm()
const menu = useCmsMenu(toRef(props, 'graph'))

type Place = { id: string; label: string; rows: CmsMenuRow[] }
const places = ref<Place[]>([])
const busy = ref(false)
function load() {
  places.value = [
    { id: 'home', label: t('menu.placeHome'), rows: [...menu.home.value] },
    ...menu.groups.value.map((g) => ({ id: `group:${g.id}`, label: g.label, rows: [...g.rows] })),
    { id: 'settings', label: t('nav.settings'), rows: [...menu.settings.value] },
  ]
}
watch(open, (on) => { if (on) load() })

// ── moving rows ──
const dragging = ref<{ place: number; index: number } | null>(null)
function moveTo(place: number, index: number) {
  const from = dragging.value
  if (!from || (from.place === place && from.index === index)) return
  const [row] = places.value[from.place]!.rows.splice(from.index, 1)
  if (!row) return
  const at = Math.min(index, places.value[place]!.rows.length)
  places.value[place]!.rows.splice(at, 0, row)
  dragging.value = { place, index: at }
}
/** One step up or down; at the end of a place, over to the next one. */
function step(place: number, index: number, delta: -1 | 1) {
  const rows = places.value[place]!.rows
  const next = index + delta
  if (next >= 0 && next < rows.length) {
    const [row] = rows.splice(index, 1)
    rows.splice(next, 0, row!)
    return
  }
  const other = places.value[place + delta]
  if (!other) return
  const [row] = rows.splice(index, 1)
  if (delta < 0) other.rows.push(row!)
  else other.rows.unshift(row!)
}
const isFirst = (place: number, index: number) => place === 0 && index === 0
const isLast = (place: number, index: number) => place === places.value.length - 1 && index === places.value[place]!.rows.length - 1

// ── saving ──
async function send(method: 'PUT' | 'DELETE', done: string) {
  busy.value = true
  try {
    const body = method === 'PUT'
      ? {
          home: places.value[0]!.rows.map((r) => r.key),
          groups: Object.fromEntries(places.value.filter((p) => p.id.startsWith('group:')).map((p) => [p.id.slice(6), p.rows.map((r) => r.key)])),
          settings: places.value[places.value.length - 1]!.rows.map((r) => r.key),
        }
      : undefined
    await $fetch('/api/cms/_menu', { method, body })
    await menu.refresh()
    toast.add({ title: done, icon: 'i-lucide-check', color: 'success' })
    open.value = false
  }
  catch (err: any) {
    toast.add({ title: t('menu.failed'), description: cmsErrorMessage(err, ''), icon: 'i-lucide-triangle-alert', color: 'error' })
  }
  finally {
    busy.value = false
  }
}
async function reset() {
  if (!await confirm({ title: t('menu.resetTitle'), description: t('menu.resetBody'), confirmLabel: t('menu.reset'), cancelLabel: t('common.cancel') })) return
  await send('DELETE', t('menu.resetDone'))
}
</script>

<template>
  <!-- the header is the title and the close button, on one line; what the dialog is for is read out as its
       description and shown as the first lines of the body, where it has the full width -->
  <UModal v-model:open="open" :title="t('menu.arrange')" :description="t('menu.description')" :ui="{ content: 'sm:max-w-lg', description: 'sr-only' }">
    <template #body>
      <p class="mb-5 text-sm text-muted text-pretty" aria-hidden="true">{{ t('menu.description') }}</p>
      <div class="flex flex-col gap-5">
        <section v-for="(place, p) in places" :key="place.id" :aria-label="place.label">
          <h3 class="cms-label mb-1.5">{{ place.label }}</h3>
          <ol
            class="cms-card overflow-hidden"
            @dragover.prevent="place.rows.length ? undefined : moveTo(p, 0)" @drop.prevent="dragging = null"
          >
            <li
              v-for="(row, i) in place.rows" :key="row.key" draggable="true"
              class="flex items-center gap-2.5 px-3 py-1.5 border-b border-default last:border-0"
              :class="dragging?.place === p && dragging.index === i ? 'bg-elevated' : ''"
              @dragstart="dragging = { place: p, index: i }" @dragover.prevent.stop="moveTo(p, i)" @dragend="dragging = null" @drop.prevent="dragging = null"
            >
              <UIcon name="i-lucide-grip-vertical" class="size-4 shrink-0 text-dimmed cursor-grab" aria-hidden="true" />
              <UIcon :name="row.icon" class="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span class="flex-1 min-w-0 truncate text-sm text-highlighted">{{ row.label }}</span>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up" :disabled="isFirst(p, i)" :aria-label="t('list.moveUp', { name: row.label })" @click="step(p, i, -1)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-down" :disabled="isLast(p, i)" :aria-label="t('list.moveDown', { name: row.label })" @click="step(p, i, 1)" />
            </li>
            <li v-if="!place.rows.length" class="px-3 py-2.5 text-xs text-muted">{{ t('menu.empty') }}</li>
          </ol>
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <UButton v-if="menu.customized.value" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :disabled="busy" @click="reset">{{ t('menu.reset') }}</UButton>
        <span v-else />
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" :disabled="busy" @click="() => { open = false }">{{ t('common.cancel') }}</UButton>
          <UButton icon="i-lucide-check" :loading="busy" @click="send('PUT', t('menu.saved'))">{{ t('common.save') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
