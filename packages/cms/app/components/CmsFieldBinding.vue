<script setup lang="ts">
// The control of a block that shows entries of one of the site's own content types ("Entries", a list
// of one type, and "Chosen entries", picked by hand): the type, which field goes to which place of a
// card, and then the order and the number (a list) or the entries themselves (chosen ones).
// What is stored may name a type or a field that is gone: that is said at its place, the stored value
// stays until a person chooses again, and nothing here throws on a value of an odd shape.
import { BINDING_ENTRIES_MAX, BINDING_LIMIT_DEFAULT, BINDING_LIMIT_MAX, BINDING_MORE_MAX } from '../../src/binding'
import {
  CMS_BINDING_PLACES, cmsBindingDirKind, cmsBindingFieldsFor, cmsBindingMissing, cmsBindingMoreFields, cmsBindingMoveEntry, cmsBindingOrderMode,
  cmsBindingRead, cmsBindingSetEntries, cmsBindingSetLimit, cmsBindingSetOrder, cmsBindingSetPlace, cmsBindingSetType, cmsBindingSortFields,
  cmsBindingToggleMore, cmsBindingTypes, type CmsBindingField, type CmsBindingPlace,
} from '../utils/cmsBinding'

const props = defineProps<{ field: any; entity?: string; id?: string; readOnly?: boolean }>()
const model = defineModel<any>()
const { t, tl } = useCmsI18n()
const { user } = useUserSession()
const { data: graph } = useNuxtData<any[]>('cms-graph')

const base = computed(() => props.id ?? 'cms-binding')
const chosen = computed(() => props.field.meta?.binding === 'chosen')
const isAdmin = computed(() => user.value?.role === 'admin')
const types = computed(() => cmsBindingTypes(graph.value))
const value = computed(() => cmsBindingRead(model.value))
const type = computed(() => types.value.find((x) => x.name === value.value?.type))
const missing = computed(() => cmsBindingMissing(model.value, types.value))
const missingAt = (place: string) => missing.value.fields.filter((m) => m.place === place)
const fieldName = (f: CmsBindingField) => tl(f.label as any, f.key)
const NONE = '\u0000none'

// ── the type ──
const typeItems = computed(() => [
  ...types.value.map((x) => ({ value: x.name, label: tl(x.label, x.name) })),
  ...(type.value ? [{ value: NONE, label: t('model.binding.nothing') }] : []),
])
const typeChoice = computed({
  get: () => type.value?.name,
  set: (v: string | undefined) => { model.value = cmsBindingSetType(model.value, !v || v === NONE ? null : v) },
})

// ── what to show ──
/** The fields that fit a place, and the stored one when the type still has it (so it stays in sight). */
function placeFields(place: CmsBindingPlace): CmsBindingField[] {
  if (!type.value) return []
  const offered = cmsBindingFieldsFor(type.value, place)
  const key = value.value?.show?.[place]
  const held = key && !offered.some((f) => f.key === key) ? type.value.fields.find((f) => f.key === key) : undefined
  return held ? [...offered, held] : offered
}
const places = computed(() => CMS_BINDING_PLACES
  .map((place) => ({ place, fields: placeFields(place), stored: value.value?.show?.[place] ?? null }))
  .filter((p) => p.fields.length || p.stored))
const placeItems = (fields: CmsBindingField[]) => [{ value: NONE, label: t('model.binding.nothing') }, ...fields.map((f) => ({ value: f.key, label: fieldName(f) }))]
const placeChoice = (place: CmsBindingPlace, fields: CmsBindingField[]) => {
  const key = value.value?.show?.[place]
  return key ? (fields.some((f) => f.key === key) ? key : undefined) : NONE
}
function setPlace(place: CmsBindingPlace, v: string) {
  model.value = cmsBindingSetPlace(model.value, place, v === NONE ? null : v)
}

const moreStored = computed(() => value.value?.show?.more ?? [])
const moreFields = computed<CmsBindingField[]>(() => {
  if (!type.value) return []
  const offered = cmsBindingMoreFields(type.value, value.value?.show)
  const held = moreStored.value.map((k) => type.value!.fields.find((f) => f.key === k)).filter((f): f is CmsBindingField => !!f && !offered.some((o) => o.key === f.key))
  return [...offered, ...held]
})
const moreFull = computed(() => moreStored.value.length >= BINDING_MORE_MAX)
const moreMissing = computed(() => missingAt('more'))
const isMore = (key: string) => moreStored.value.includes(key)
const toggleMore = (key: string, on: boolean | 'indeterminate') => { model.value = cmsBindingToggleMore(model.value, key, on === true) }

// ── the order and the number (a list) ──
const sortFields = computed(() => (type.value ? cmsBindingSortFields(type.value) : []))
const mode = computed(() => cmsBindingOrderMode(value.value?.order))
const modeItems = computed(() => [
  { value: 'own', label: t('model.binding.orderOwn') },
  { value: 'newest', label: t('model.binding.orderNewest') },
  { value: 'oldest', label: t('model.binding.orderOldest') },
  ...(sortFields.value.length || mode.value === 'field' ? [{ value: 'field', label: t('model.binding.orderField') }] : []),
])
function setMode(v: string) {
  const first = sortFields.value[0]
  model.value = cmsBindingSetOrder(model.value, v === 'newest' ? { by: 'createdAt', dir: 'desc' }
    : v === 'oldest' ? { by: 'createdAt', dir: 'asc' }
      : v === 'field' && first ? { by: first.key, dir: 'asc' } : null)
}
const orderBy = computed(() => value.value?.order?.by)
const orderFields = computed(() => sortFields.value.map((f) => ({ value: f.key, label: fieldName(f) })))
const orderByChoice = computed(() => (orderBy.value && sortFields.value.some((f) => f.key === orderBy.value) ? orderBy.value : undefined))
const orderKind = computed(() => cmsBindingDirKind(sortFields.value.find((f) => f.key === orderBy.value)))
const DIR_WORDS = {
  text: ['model.binding.dirTextAsc', 'model.binding.dirTextDesc'],
  date: ['model.binding.dirDateAsc', 'model.binding.dirDateDesc'],
  number: ['model.binding.dirNumberAsc', 'model.binding.dirNumberDesc'],
  other: ['model.binding.dirOtherAsc', 'model.binding.dirOtherDesc'],
} as const
const dirItems = computed(() => [
  { value: 'asc', label: t(DIR_WORDS[orderKind.value][0]) },
  { value: 'desc', label: t(DIR_WORDS[orderKind.value][1]) },
])
const setOrderBy = (by: string) => { model.value = cmsBindingSetOrder(model.value, { by, dir: value.value?.order?.dir ?? 'asc' }) }
const setDir = (dir: string) => { if (orderBy.value && (dir === 'asc' || dir === 'desc')) model.value = cmsBindingSetOrder(model.value, { by: orderBy.value, dir }) }
const limitShown = computed(() => value.value?.limit ?? undefined)
const setLimit = (v: string | number | undefined) => {
  const n = v === '' || v === undefined || v === null ? null : Number(v)
  model.value = cmsBindingSetLimit(model.value, n)
}

// ── chosen entries ──
type Option = { id: string; label: string }
const ids = computed(() => value.value?.entries ?? [])
const full = computed(() => ids.value.length >= BINDING_ENTRIES_MAX)
const options = ref<Option[]>([])
const known = reactive(new Map<string, string>())
const gone = reactive(new Set<string>())
const loading = ref(false)
const search = ref('')
const ask = (query: Record<string, string>) => cmsFetch<Option[]>(`/api/cms/${type.value!.name}/options`, { query })

/** Names the chosen entries; one the options route cannot name is gone. */
async function resolve() {
  const wanted = ids.value.filter((id) => !known.has(id) && !gone.has(id))
  if (!chosen.value || !type.value || !wanted.length) return
  const name = type.value.name
  try {
    const found = await ask({ q: '', selected: wanted.join(',') })
    if (type.value?.name !== name) return
    for (const o of found) known.set(o.id, o.label)
    for (const id of wanted) if (!known.has(id)) gone.add(id)
  }
  catch { /* the names stay unknown; nothing says they are gone */ }
}
let timer: ReturnType<typeof setTimeout> | undefined
async function load(q: string) {
  if (!chosen.value || !type.value) return
  const name = type.value.name
  loading.value = true
  try {
    const found = await ask({ q, selected: '' })
    if (type.value?.name !== name) return
    options.value = found
    for (const o of found) known.set(o.id, o.label)
  }
  catch { options.value = [] }
  finally { loading.value = false }
}
watch(search, (q) => { clearTimeout(timer); timer = setTimeout(() => load(q), 250) })
onBeforeUnmount(() => clearTimeout(timer))
watch(() => type.value?.name, () => { options.value = []; known.clear(); gone.clear(); search.value = ''; void resolve() })
watch(ids, () => { void resolve() })
onMounted(resolve)

const available = computed(() => options.value.filter((o) => !ids.value.includes(o.id)))
const add = (id: string | undefined) => { if (id && !full.value && !ids.value.includes(id)) model.value = cmsBindingSetEntries(model.value, [...ids.value, id]) }
const removeEntry = (id: string) => { model.value = cmsBindingSetEntries(model.value, ids.value.filter((x) => x !== id)) }
const moveEntry = (index: number, delta: -1 | 1) => { model.value = cmsBindingSetEntries(model.value, cmsBindingMoveEntry(ids.value, index, delta)) }
const entryName = (id: string) => known.get(id) ?? '…'
const labelClass = 'block text-sm font-medium text-highlighted'
</script>

<template>
  <div class="w-full space-y-5">
    <!-- 1. the type -->
    <div class="space-y-1.5">
      <label :for="`${base}-type`" :class="labelClass">{{ t('model.binding.type') }}</label>
      <template v-if="types.length">
        <USelect
          :id="`${base}-type`" v-model="typeChoice" :items="typeItems" :placeholder="t('model.binding.typePlaceholder')"
          :disabled="readOnly" class="w-full"
        />
      </template>
      <p v-else class="text-sm text-muted text-pretty">
        {{ t('model.binding.noTypes') }}
        <NuxtLink v-if="isAdmin" to="/admin/_model" class="font-medium text-highlighted underline underline-offset-2">{{ t('model.binding.makeOne') }}</NuxtLink>
      </p>
      <p v-if="missing.type" role="status" class="flex items-start gap-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-sm text-default">
        <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <span class="min-w-0 break-words">{{ t('model.binding.missingType', { name: value?.type ?? '' }) }}</span>
      </p>
    </div>

    <template v-if="type">
      <!-- 2. what to show -->
      <div v-if="places.length || moreFields.length || moreMissing.length" class="space-y-3">
        <p :class="labelClass">{{ t('model.binding.show') }}</p>
        <div v-if="places.length" class="grid gap-4 sm:grid-cols-2">
          <div v-for="p in places" :key="p.place" class="min-w-0 space-y-1.5">
            <label :for="`${base}-${p.place}`" class="block text-xs font-medium text-muted">{{ t(`model.binding.${p.place}`) }}</label>
            <USelect
              :id="`${base}-${p.place}`" :model-value="placeChoice(p.place, p.fields)" :items="placeItems(p.fields)" :placeholder="p.stored ?? t('model.binding.nothing')"
              :disabled="readOnly" class="w-full" @update:model-value="(v: string) => setPlace(p.place, v)"
            />
            <p v-for="m in missingAt(p.place)" :key="m.key" role="status" class="flex items-start gap-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-sm text-default">
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span class="min-w-0 break-words">{{ t('model.binding.missingField', { key: m.key }) }}</span>
            </p>
          </div>
        </div>

        <fieldset v-if="moreFields.length || moreMissing.length" class="min-w-0 space-y-1.5">
          <legend class="mb-1.5 text-xs font-medium text-muted">{{ t('model.binding.more') }}</legend>
          <ul class="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <li v-for="f in moreFields" :key="f.key" class="min-w-0">
              <UCheckbox
                :model-value="isMore(f.key)" :label="fieldName(f)" :disabled="readOnly || (moreFull && !isMore(f.key))"
                :ui="{ root: 'pointer-coarse:min-h-11 items-center', label: 'truncate' }" @update:model-value="(on: boolean | 'indeterminate') => toggleMore(f.key, on)"
              />
            </li>
          </ul>
          <p v-for="m in moreMissing" :key="m.key" role="status" class="flex items-center gap-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-sm text-default">
            <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0 text-warning" aria-hidden="true" />
            <span class="min-w-0 flex-1 break-words">{{ t('model.binding.missingField', { key: m.key }) }}</span>
            <UButton
              color="neutral" variant="ghost" size="xs" icon="i-lucide-x" :disabled="readOnly" class="shrink-0 pointer-coarse:size-11"
              :aria-label="t('model.binding.removeNamed', { name: m.key })" @click="toggleMore(m.key, false)"
            />
          </p>
          <p v-if="moreFull" class="text-xs text-muted">{{ t('model.binding.moreFull', { count: BINDING_MORE_MAX }) }}</p>
        </fieldset>
      </div>

      <!-- 3. a list: its order and how many -->
      <div v-if="!chosen" class="grid gap-4 sm:grid-cols-2">
        <div class="min-w-0 space-y-1.5">
          <label :for="`${base}-order`" :class="labelClass">{{ t('model.binding.order') }}</label>
          <USelect :id="`${base}-order`" :model-value="mode" :items="modeItems" :disabled="readOnly" class="w-full" @update:model-value="setMode" />
        </div>
        <div class="min-w-0 space-y-1.5">
          <label :for="`${base}-limit`" :class="labelClass">{{ t('model.binding.limit') }}</label>
          <UInput
            :id="`${base}-limit`" type="number" inputmode="numeric" :min="1" :max="BINDING_LIMIT_MAX" :model-value="limitShown" :placeholder="String(BINDING_LIMIT_DEFAULT)"
            :disabled="readOnly" class="w-full" @update:model-value="setLimit"
          />
          <p class="text-xs text-muted">{{ t('model.binding.limitHint', { max: BINDING_LIMIT_MAX, default: BINDING_LIMIT_DEFAULT }) }}</p>
        </div>
        <template v-if="mode === 'field'">
          <div class="min-w-0 space-y-1.5">
            <label :for="`${base}-by`" class="block text-xs font-medium text-muted">{{ t('model.binding.orderBy') }}</label>
            <USelect
              :id="`${base}-by`" :model-value="orderByChoice" :items="orderFields" :placeholder="orderBy ?? ''" :disabled="readOnly" class="w-full"
              @update:model-value="setOrderBy"
            />
            <p v-for="m in missingAt('order')" :key="m.key" role="status" class="flex items-start gap-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-sm text-default">
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span class="min-w-0 break-words">{{ t('model.binding.missingField', { key: m.key }) }}</span>
            </p>
          </div>
          <div class="min-w-0 space-y-1.5">
            <label :for="`${base}-dir`" class="block text-xs font-medium text-muted">{{ t('model.binding.direction') }}</label>
            <USelect
              :id="`${base}-dir`" :model-value="value?.order?.dir" :items="dirItems" :disabled="readOnly || !orderBy" class="w-full"
              @update:model-value="setDir"
            />
          </div>
        </template>
      </div>

      <!-- 4. chosen entries: picked by search, kept in the picked order -->
      <div v-else class="space-y-2">
        <p :class="labelClass">{{ t('model.binding.entries') }}</p>
        <ol v-if="ids.length" class="cms-card divide-y divide-default overflow-hidden text-sm">
          <li
            v-for="(eid, i) in ids" :key="eid" class="flex items-center gap-1 py-1 pl-3 pr-1"
            :class="gone.has(eid) ? 'bg-warning/10' : ''"
          >
            <UIcon v-if="gone.has(eid)" name="i-lucide-triangle-alert" class="mr-1 size-4 shrink-0 text-warning" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate" :class="gone.has(eid) ? 'text-default' : 'font-medium text-highlighted'">
              {{ gone.has(eid) ? t('model.binding.gone') : entryName(eid) }}
            </span>
            <UButton
              v-if="!gone.has(eid)" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-up" :disabled="readOnly || i === 0" class="pointer-coarse:size-11"
              :aria-label="t('model.binding.moveUp')" @click="moveEntry(i, -1)"
            />
            <UButton
              v-if="!gone.has(eid)" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-down" :disabled="readOnly || i === ids.length - 1" class="pointer-coarse:size-11"
              :aria-label="t('model.binding.moveDown')" @click="moveEntry(i, 1)"
            />
            <UButton
              color="neutral" variant="ghost" size="sm" icon="i-lucide-x" :disabled="readOnly" class="pointer-coarse:size-11"
              :aria-label="t('model.binding.removeNamed', { name: gone.has(eid) ? t('model.binding.gone') : entryName(eid) })" @click="removeEntry(eid)"
            />
          </li>
        </ol>
        <p v-else class="text-sm text-muted">{{ t('model.binding.none') }}</p>

        <USelectMenu
          :id="`${base}-pick`" :model-value="undefined" v-model:search-term="search" :items="available" value-key="id" label-key="label" ignore-filter
          :loading="loading" icon="i-lucide-plus" :disabled="readOnly || full" :aria-label="t('model.binding.pick')" class="w-full"
          :search-input="{ placeholder: t('model.binding.search') }" @update:open="(o: boolean) => o && load(search)" @update:model-value="add"
        >
          <span class="truncate text-muted">{{ t('model.binding.pick') }}</span>
          <template #empty>{{ t('model.binding.noResults') }}</template>
        </USelectMenu>
        <p v-if="full" class="text-xs text-muted">{{ t('model.binding.full', { count: BINDING_ENTRIES_MAX }) }}</p>
      </div>
    </template>
  </div>
</template>
