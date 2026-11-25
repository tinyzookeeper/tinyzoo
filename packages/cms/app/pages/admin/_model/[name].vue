<script setup lang="ts">
import type { ModelField, ModelType } from '../../../../src/model-doc'
import {
  CMS_MODEL_DEFAULT_ICON, cmsModelDesignKind, cmsModelFieldParts, cmsModelFields, cmsModelHiddenFields, cmsModelKindIcon, cmsModelKindOf, cmsModelMoveKey,
  cmsModelFieldsAtLimit, cmsModelFieldsUsed, cmsModelMoveKeyTo, cmsModelNotesText, cmsModelOrderOp, cmsModelRemovedLine, cmsModelSameKeys,
} from '../../../utils/cmsModel'

// One content type: its fields (in the order the form shows them), what the website adds itself,
// the removed fields (kept until a person restores or deletes them), its settings, and removing it. A type
// that is removed says so and offers to bring it back or delete it for good; a type of the design is shown, and cannot be changed here.
definePageMeta({ layout: 'admin' })
const route = useRoute()
const { t, tl, formatDateWith, formatNumber } = useCmsI18n()
const toast = useToast()

const model = useCmsModel()
await model.ready
const { data, error, refresh } = model

const name = computed(() => String(route.params.name ?? ''))
const status = computed<number | undefined>(() => (error.value as any)?.statusCode ?? (error.value as any)?.status)
const doc = computed(() => data.value?.doc ?? { format: 1, types: [] })
const found = computed(() => doc.value.types.find((x) => x.name === name.value))
const type = computed(() => (found.value && !found.value.removedAt ? found.value : undefined))
const hiddenType = computed(() => (found.value?.removedAt ? found.value : undefined))
const design = computed(() => (found.value ? undefined : data.value?.design.find((d) => d.name === name.value)))

const typeTitle = computed(() => {
  const x = found.value ?? design.value
  return x ? tl(x.label as any, x.name) : name.value
})
useHead({ title: () => typeTitle.value })

const dateCtx = { t: t as any, formatDateWith }

// ── the fields, in the order on screen ──
const modelKeys = computed(() => (type.value ? cmsModelFields(type.value).map((f) => f.key) : []))
const order = ref<string[]>([...modelKeys.value])
const fields = computed(() => order.value.flatMap((key) => type.value?.fields.find((f) => f.key === key && !f.removedAt) ?? []))
const hiddenFields = computed(() => (type.value ? cmsModelHiddenFields(type.value) : []))
// Removed fields do not count toward the limit.
const fieldsFull = computed(() => !!type.value && !!data.value && cmsModelFieldsAtLimit(type.value, data.value.limits.fields))
const entries = computed(() => data.value?.entries[name.value] ?? 0)

const fieldLabel = (f: { key: string; label?: unknown }) => tl(f.label as any, f.key)
const targetName = (to: string) => {
  const own = doc.value.types.find((x) => x.name === to)
  const d = data.value?.design.find((x) => x.name === to)
  const x = own ?? d
  return x ? tl(x.label as any, x.name) : to
}

// ── how many pages show each field (one question for the whole type, asked after the page is shown; a failure says nothing) ──
const usage = ref<Record<string, number | null>>({})
async function loadUsage() {
  const current = type.value
  if (!import.meta.client || !current) return
  const asked = current.name
  try {
    const res = await cmsFetch<{ fields?: Record<string, number> }>(`/api/cms/_model/usage?type=${encodeURIComponent(asked)}`)
    // Only keys above zero are listed: a field not in the answer is shown nowhere.
    if (type.value?.name === asked) usage.value = { ...(res.fields ?? {}) }
  }
  catch {
    if (type.value?.name === asked) usage.value = {}
  }
}
onMounted(loadUsage)
watch(() => [data.value?.version, name.value], loadUsage)

function parts(field: ModelField): string {
  return cmsModelFieldParts(field, { t: t as any, isTitle: field.key === type.value?.titleField, targetName, places: usage.value[field.key] }).join(' · ')
}

// ── arranging: the new order is shown at once and saved after a short pause, one request at a time ──
const saveDelay = 600
let timer: ReturnType<typeof setTimeout> | undefined
const saving = ref(false)
watch(modelKeys, (keys) => {
  if (!saving.value && timer === undefined) order.value = [...keys]
})
onBeforeUnmount(() => { if (timer !== undefined) clearTimeout(timer) })

function queueOrder() {
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(() => { timer = undefined; void saveOrder() }, saveDelay)
}
async function saveOrder() {
  const current = type.value
  if (!current || saving.value) return
  const keys = [...order.value]
  if (cmsModelSameKeys(keys, modelKeys.value)) return
  saving.value = true
  try {
    const res = await model.change([cmsModelOrderOp(current.name, keys)], { quiet: true })
    if (!res.ok) {
      // The model's own order comes back, and the reason is said.
      order.value = [...modelKeys.value]
      toast.add({ title: res.problem.text, icon: 'i-lucide-circle-alert', color: 'error' })
    }
  }
  finally {
    saving.value = false
  }
  // Moved again while that was saved: the newest order goes next.
  if (timer === undefined && !cmsModelSameKeys(order.value, modelKeys.value)) queueOrder()
}
function step(index: number, delta: -1 | 1) {
  order.value = cmsModelMoveKey(order.value, index, delta)
  queueOrder()
}
const dragging = ref<number | null>(null)
function dragOver(index: number) {
  if (dragging.value === null || dragging.value === index) return
  order.value = cmsModelMoveKeyTo(order.value, dragging.value, index)
  dragging.value = index
  queueOrder()
}

// ── hidden fields ──
const restoring = ref('')
async function restoreField(field: ModelField) {
  if (!type.value) return
  restoring.value = field.key
  try {
    const res = await model.change([{ op: 'field.restore', type: type.value.name, key: field.key }])
    if (res.ok) {
      const description = cmsModelNotesText(res.result.notes, t as any)
      toast.add({ title: t('model.field.restored', { name: fieldLabel(field) }), ...(description ? { description } : {}), icon: 'i-lucide-check', color: 'success' })
    }
    else if (res.problem.kind !== 'stale') toast.add({ title: res.problem.text, icon: 'i-lucide-circle-alert', color: 'error' })
  }
  finally {
    restoring.value = ''
  }
}

// ── deleting for good ──
// The dialog is mounted outside the page's branches and holds the type it was opened for: when the type is
// deleted it is gone from the model, and the branch that showed it goes with it.
const deleteOpen = ref(false)
const deleteType = ref<ModelType | null>(null)
const deleteField = ref<ModelField | null>(null)
function askDelete(field: ModelField | null) {
  deleteType.value = (field ? type.value : hiddenType.value) ?? null
  deleteField.value = field
  deleteOpen.value = true
}
// A removed type that is deleted is gone: back to the list.
const deleted = () => { if (!deleteField.value) void navigateTo('/admin/_model') }

// ── a removed type ──
const restoringType = ref(false)
async function restoreType() {
  if (!hiddenType.value) return
  restoringType.value = true
  try {
    const res = await model.change([{ op: 'type.restore', type: hiddenType.value.name }])
    if (res.ok) {
      const description = cmsModelNotesText(res.result.notes, t as any)
      toast.add({ title: t('model.restored', { name: typeTitle.value }), ...(description ? { description } : {}), icon: 'i-lucide-check', color: 'success' })
    }
    else if (res.problem.kind !== 'stale') toast.add({ title: res.problem.text, icon: 'i-lucide-circle-alert', color: 'error' })
  }
  finally {
    restoringType.value = false
  }
}

// ── dialogs ──
const fieldOpen = ref(false)
const editField = ref<ModelField | null>(null)
function openField(field: ModelField | null) {
  editField.value = field
  fieldOpen.value = true
}
const settingsOpen = ref(false)
const removeOpen = ref(false)
const removeField = ref<ModelField | null>(null)
function askRemove(field: ModelField | null) {
  removeField.value = field
  removeOpen.value = true
}

const summary = computed(() => {
  const x = type.value
  if (!x) return ''
  const list = [t('model.entriesCount', { count: entries.value })]
  if (x.page) list.push(t('model.pagesAt', { path: `/${x.page.prefix}/…` }))
  return list.join(' · ')
})

const breadcrumbs = computed(() => [{ label: t('nav.home'), to: '/admin' }, { label: t('model.title'), to: '/admin/_model' }, { label: typeTitle.value }])
const pageIcon = computed(() => (type.value ? type.value.icon || CMS_MODEL_DEFAULT_ICON : design.value ? design.value.icon || CMS_MODEL_DEFAULT_ICON : undefined))
</script>

<template>
  <CmsPage :title="typeTitle" :icon="pageIcon" :breadcrumbs="breadcrumbs">
    <template v-if="type && data" #actions>
      <UButton icon="i-lucide-plus" :disabled="fieldsFull" :aria-label="t('model.type.addField')" :aria-describedby="fieldsFull ? 'cms-model-fields-limit' : undefined" @click="openField(null)">
        <span class="max-sm:sr-only">{{ t('model.type.addField') }}</span>
      </UButton>
    </template>
    <template v-if="design" #badge>
      <UBadge color="neutral" variant="subtle" icon="i-lucide-lock">{{ t('model.design') }}</UBadge>
    </template>

    <div v-if="status === 403" class="cms-card overflow-hidden">
      <CmsEmptyState plain icon="i-lucide-lock" :title="t('model.noAccessTitle')" />
    </div>
    <div v-else-if="status === 404" class="cms-card overflow-hidden">
      <CmsEmptyState plain icon="i-lucide-shapes" :title="t('model.notAvailableTitle')" />
    </div>
    <div v-else-if="error || !data" class="cms-card overflow-hidden">
      <CmsLoadError :error="error" @retry="refresh()" />
    </div>

    <!-- removed: its content is kept, and it can come back or be deleted for good -->
    <div v-else-if="hiddenType" class="cms-card overflow-hidden">
      <CmsEmptyState plain icon="i-lucide-eye-off" :title="t('model.type.hiddenTitle', { name: typeTitle })" :description="cmsModelRemovedLine(hiddenType, dateCtx)">
        <template #actions>
          <!-- one under the other on a phone, so none of the three wraps its words -->
          <div class="flex w-full max-w-64 flex-col gap-2 sm:w-auto sm:max-w-none sm:flex-row sm:items-center">
            <UButton icon="i-lucide-rotate-ccw" class="min-h-11 justify-center" :loading="restoringType" @click="restoreType">{{ t('model.restore') }}</UButton>
            <UButton color="neutral" variant="ghost" icon="i-lucide-trash-2" class="min-h-11 justify-center" :aria-label="t('model.deleteNamed', { name: typeTitle })" @click="askDelete(null)">{{ t('model.deleteForGood') }}</UButton>
            <UButton to="/admin/_model" color="neutral" variant="ghost" class="min-h-11 justify-center">{{ t('model.type.backToList') }}</UButton>
          </div>
        </template>
      </CmsEmptyState>
    </div>

    <!-- a type of the design: read-only -->
    <div v-else-if="design" class="flex flex-col gap-6">
      <p class="max-w-2xl text-sm text-muted text-pretty">{{ t('model.type.designSentence') }}</p>
      <section :aria-label="t('model.type.fields')">
        <h2 class="cms-label mb-1.5">{{ t('model.type.fields') }}</h2>
        <ul class="cms-card overflow-hidden">
          <li v-for="f in design.fields" :key="f.key" class="flex items-center gap-3 border-b border-default px-4 py-3 last:border-0">
            <span class="grid size-9 shrink-0 place-items-center rounded-md border border-default text-muted">
              <UIcon :name="cmsModelDesignKind(f.type).icon" class="size-4" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-highlighted">{{ tl(f.label as any, f.key) }}</span>
              <span class="block text-sm text-muted">{{ t(cmsModelDesignKind(f.type).key as any) }}</span>
            </span>
          </li>
        </ul>
      </section>
      <div>
        <UButton :to="`/admin/${design.name}`" color="neutral" variant="outline" size="sm" trailing-icon="i-lucide-arrow-right">{{ t(design.singleton ? 'common.open' : 'model.type.openEntries') }}</UButton>
      </div>
    </div>

    <!-- one of the site's own types -->
    <div v-else-if="type" class="flex flex-col gap-8">
      <div class="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <UButton :to="`/admin/${type.name}`" color="neutral" variant="outline" size="sm" trailing-icon="i-lucide-arrow-right">{{ t('model.type.openEntries') }}</UButton>
        <span class="text-sm text-muted tabular-nums">{{ summary }}</span>
      </div>

      <section :aria-label="t('model.type.fields')">
        <div class="mb-1.5 flex items-baseline justify-between gap-3">
          <h2 class="cms-label">{{ t('model.type.fields') }}</h2>
          <span class="text-xs text-muted tabular-nums">{{ t('model.usedOf', { used: formatNumber(cmsModelFieldsUsed(type)), limit: formatNumber(data.limits.fields) }) }}</span>
        </div>
        <ol class="cms-card overflow-hidden">
          <li
            v-for="(f, i) in fields" :key="f.key" draggable="true"
            class="flex items-center gap-2.5 border-b border-default px-3 py-2 last:border-0 sm:px-4"
            :class="dragging === i ? 'bg-elevated' : ''"
            @dragstart="dragging = i" @dragover.prevent="dragOver(i)" @dragend="dragging = null" @drop.prevent="dragging = null"
          >
            <UIcon name="i-lucide-grip-vertical" class="size-4 shrink-0 cursor-grab text-dimmed max-sm:hidden" aria-hidden="true" />
            <span class="grid size-9 shrink-0 place-items-center rounded-md border border-default text-muted">
              <UIcon :name="cmsModelKindIcon(cmsModelKindOf(f))" class="size-4" aria-hidden="true" />
            </span>
            <button type="button" class="min-h-11 min-w-0 flex-1 rounded-md py-1 text-left transition-colors hover:text-highlighted" @click="openField(f)">
              <span class="block truncate font-medium text-highlighted">{{ fieldLabel(f) }}</span>
              <span class="block text-sm text-muted text-pretty">{{ parts(f) }}</span>
            </button>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up" :disabled="i === 0" :aria-label="t('list.moveUp', { name: fieldLabel(f) })" @click="step(i, -1)" />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-down" :disabled="i === fields.length - 1" :aria-label="t('list.moveDown', { name: fieldLabel(f) })" @click="step(i, 1)" />
            <!-- phones: the row's name opens it, so the pencil makes room for the arrows -->
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" class="max-sm:hidden" :aria-label="t('model.field.editNamed', { name: fieldLabel(f) })" @click="openField(f)" />
          </li>
        </ol>
        <p v-if="fieldsFull" id="cms-model-fields-limit" class="mt-2 text-sm text-muted text-pretty">{{ t('model.type.fieldsFull', { limit: formatNumber(data.limits.fields) }) }}</p>
      </section>

      <!-- what the website adds by itself -->
      <section v-if="type.page || type.publish || type.order === 'manual'" :aria-label="t('model.type.websiteMakes')">
        <h2 class="cms-label mb-1.5">{{ t('model.type.websiteMakes') }}</h2>
        <ul class="cms-card overflow-hidden text-sm">
          <li v-if="type.page" class="flex items-start gap-3 border-b border-default px-4 py-3 last:border-0">
            <UIcon name="i-lucide-lock" class="mt-0.5 size-4 shrink-0 text-dimmed" aria-hidden="true" />
            <span class="min-w-0"><span class="font-medium text-highlighted">{{ t('model.type.address') }}</span><span class="block text-muted text-pretty">{{ t('model.type.addressHint') }}</span></span>
          </li>
          <li v-if="type.publish" class="flex items-start gap-3 border-b border-default px-4 py-3 last:border-0">
            <UIcon name="i-lucide-lock" class="mt-0.5 size-4 shrink-0 text-dimmed" aria-hidden="true" />
            <span class="min-w-0"><span class="font-medium text-highlighted">{{ t('model.type.statusName') }}</span><span class="block text-muted text-pretty">{{ t('model.type.statusHint') }}</span></span>
          </li>
          <li v-if="type.order === 'manual'" class="flex items-start gap-3 border-b border-default px-4 py-3 last:border-0">
            <UIcon name="i-lucide-lock" class="mt-0.5 size-4 shrink-0 text-dimmed" aria-hidden="true" />
            <span class="min-w-0"><span class="font-medium text-highlighted">{{ t('model.type.position') }}</span><span class="block text-muted text-pretty">{{ t('model.type.positionHint') }}</span></span>
          </li>
        </ul>
      </section>

      <section v-if="hiddenFields.length" :aria-label="t('model.hidden')">
        <h2 class="cms-label mb-1.5">{{ t('model.hidden') }}</h2>
        <ul class="cms-card overflow-hidden">
          <li v-for="f in hiddenFields" :key="f.key" class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-default px-4 py-3 last:border-0">
            <span class="grid size-9 shrink-0 place-items-center rounded-md border border-default text-dimmed">
              <UIcon :name="cmsModelKindIcon(cmsModelKindOf(f))" class="size-4" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1 basis-44">
              <span class="block truncate font-medium text-muted">{{ fieldLabel(f) }}</span>
              <span class="block text-sm text-muted text-pretty">{{ cmsModelRemovedLine(f, dateCtx) }}</span>
            </span>
            <span class="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
              <UButton
                color="neutral" variant="ghost" size="sm" icon="i-lucide-trash-2" class="min-h-11 px-3" :disabled="restoring === f.key"
                :aria-label="t('model.deleteNamed', { name: fieldLabel(f) })" @click="askDelete(f)"
              >{{ t('model.deleteForGood') }}</UButton>
              <UButton
                color="neutral" variant="outline" size="sm" icon="i-lucide-rotate-ccw" class="min-h-11 px-3" :loading="restoring === f.key" :disabled="!!restoring && restoring !== f.key"
                :aria-label="t('model.restoreNamed', { name: fieldLabel(f) })" @click="restoreField(f)"
              >{{ t('model.restore') }}</UButton>
            </span>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-6">
        <button type="button" class="cms-card flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated/60" @click="() => { settingsOpen = true }">
          <span class="grid size-9 shrink-0 place-items-center rounded-md border border-default text-muted"><UIcon name="i-lucide-settings-2" class="size-4" aria-hidden="true" /></span>
          <span class="min-w-0 flex-1">
            <span class="block font-medium text-highlighted">{{ t('model.type.settings') }}</span>
            <span class="block text-sm text-muted text-pretty">{{ t('model.type.settingsHint') }}</span>
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" aria-hidden="true" />
        </button>
        <div>
          <UButton color="error" variant="ghost" icon="i-lucide-trash-2" @click="askRemove(null)">{{ t('model.type.remove') }}</UButton>
        </div>
      </section>

      <CmsModelFieldDialog v-model:open="fieldOpen" :type="type" :data="data" :field="editField" @remove="askRemove" />
      <CmsModelSettingsDialog v-model:open="settingsOpen" :type="type" :data="data" />
      <CmsModelRemoveDialog v-model:open="removeOpen" :type="type" :data="data" :field="removeField" />
    </div>

    <!-- not there -->
    <div v-else class="cms-card overflow-hidden">
      <CmsEmptyState plain icon="i-lucide-shapes" :title="t('model.type.notFoundTitle')">
        <template #actions>
          <UButton to="/admin/_model" color="neutral" variant="outline">{{ t('model.type.backToList') }}</UButton>
        </template>
      </CmsEmptyState>
    </div>
    <CmsModelDeleteDialog v-if="data && deleteType" v-model:open="deleteOpen" :type="deleteType" :field="deleteField" :data="data" @done="deleted" />
  </CmsPage>
</template>
