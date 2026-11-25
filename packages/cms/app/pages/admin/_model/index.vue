<script setup lang="ts">
import {
  CMS_MODEL_DEFAULT_ICON, cmsModelDayText, cmsModelFields, cmsModelHiddenTypes, cmsModelNotesText, cmsModelPlaceBlock, cmsModelRemovedLine, cmsModelTypesAtLimit, cmsModelVisibleTypes,
  type CmsModelAttentionPlace,
} from '../../../utils/cmsModel'

// Content types: the kinds of content the site's owner made (Courses, Branches…), the removed ones
// (kept until a person restores or deletes them), and the ones that come with the website's design. Administrators only;
// a site without the feature answers 404 and the page says so calmly.
definePageMeta({ layout: 'admin' })
const { t, tl, formatDateWith, formatNumber, entityLabel, languageName } = useCmsI18n()
const toast = useToast()
useHead({ title: () => t('model.title') })

const model = useCmsModel()
await model.ready
const { data, error, refresh } = model
const history = useCmsModelHistory()

const status = computed<number | undefined>(() => (error.value as any)?.statusCode ?? (error.value as any)?.status)
const doc = computed(() => data.value?.doc ?? { format: 1, types: [] })
const visible = computed(() => cmsModelVisibleTypes(doc.value))
const hidden = computed(() => cmsModelHiddenTypes(doc.value))
const limit = computed(() => data.value?.limits.types ?? 0)
// Removed types do not count toward the limit.
const used = computed(() => visible.value.length)
const atLimit = computed(() => !!data.value && cmsModelTypesAtLimit(doc.value, limit.value))
const empty = computed(() => !!data.value && !visible.value.length && !hidden.value.length)

// Collections first, then single pages, each in the order the server gave.
const design = computed(() => {
  const all = data.value?.design ?? []
  return [...all.filter((d) => !d.singleton), ...all.filter((d) => d.singleton)]
})

const typeOf = (name: string) => doc.value.types.find((x) => x.name === name)
const typeName = (x: { name: string; label?: unknown }) => tl(x.label as any, x.name)

function subtitle(type: (typeof visible.value)[number]): string {
  const parts = [
    t('model.fieldsCount', { count: cmsModelFields(type).length }),
    t('model.entriesCount', { count: data.value?.entries[type.name] ?? 0 }),
  ]
  if (type.page) parts.push(t('model.pagesAt', { path: `/${type.page.prefix}` }))
  return parts.join(' · ')
}

// "Courses › Teacher": where something that cannot be shown is, in the owner's words.
const problems = computed(() => (data.value?.problems ?? []).map((p, i) => {
  const type = typeOf(p.type)
  const field = type?.fields.find((f) => f.key === p.field)
  const where = [type ? typeName(type) : p.type, p.field ? (field ? tl(field.label, field.key) : p.field) : ''].filter(Boolean).join(' › ')
  return { id: i, where, message: p.message }
}))

// ── entries whose blocks show a type or a field that is gone (asked after the page is shown; a failure says nothing) ──
const { data: graph } = useNuxtData<any[]>('cms-graph')
const attention = ref<CmsModelAttentionPlace[]>([])
async function loadAttention() {
  if (!import.meta.client) return
  try {
    const res = await cmsFetch<{ places: CmsModelAttentionPlace[] }>('/api/cms/_model/attention')
    attention.value = res.places ?? []
  }
  catch {
    attention.value = []
  }
}
onMounted(loadAttention)
watch(() => data.value?.version, loadAttention)
const attentionRows = computed(() => attention.value.map((p, i) => {
  const entry = p.title || entityLabel((graph.value ?? []).find((g: any) => g.name === p.entity)) || p.entity
  const block = cmsModelPlaceBlock(p, tl)
  const fields = p.missing?.fields ?? []
  return {
    id: `${p.entity}-${p.id}-${p.block?.id ?? i}`,
    to: p.admin,
    where: block ? `${entry} › ${block}` : entry,
    fields,
    language: p.locale ? languageName(p.locale) : '',
  }
}))

const dateCtx = { t: t as any, formatDateWith }
const dayText = (value: Date | string) => cmsModelDayText(value, dateCtx)
const removedLine = (type: (typeof hidden.value)[number]) => cmsModelRemovedLine(type, dateCtx)

const restoring = ref('')
async function restore(type: (typeof hidden.value)[number]) {
  restoring.value = type.name
  try {
    const res = await model.change([{ op: 'type.restore', type: type.name }])
    if (res.ok) {
      const description = cmsModelNotesText(res.result.notes, t as any)
      toast.add({ title: t('model.restored', { name: typeName(type) }), ...(description ? { description } : {}), icon: 'i-lucide-check', color: 'success' })
    }
    else if (res.problem.kind !== 'stale') {
      toast.add({ title: res.problem.text, icon: 'i-lucide-circle-alert', color: 'error' })
    }
  }
  finally {
    restoring.value = ''
  }
}

// Deleting a removed type for good: its own dialog.
const deleteType = ref<(typeof hidden.value)[number] | null>(null)
const deleteOpen = ref(false)
function askDelete(type: (typeof hidden.value)[number]) {
  deleteType.value = type
  deleteOpen.value = true
}

const dialogOpen = ref(false)
const created = (name: string) => navigateTo(`/admin/_model/${name}`)

const lastChange = computed(() => {
  const last = history.data.value?.[0]
  if (!last) return ''
  const date = dayText(last.at)
  return last.by?.name ? t('model.lastChangedBy', { name: last.by.name, date }) : t('model.lastChanged', { date })
})
</script>

<template>
  <CmsPage :title="t('model.title')" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('model.title') }]">
    <template v-if="data && !empty" #actions>
      <UButton icon="i-lucide-plus" :disabled="atLimit" :aria-label="t('model.newType')" :aria-describedby="atLimit ? 'cms-model-limit' : undefined" @click="() => { dialogOpen = true }">
        <span class="max-sm:sr-only">{{ t('model.newType') }}</span>
      </UButton>
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

    <div v-else class="flex flex-col gap-8">
      <!-- nothing made yet: one calm moment, and its button is the page's one primary action -->
      <div v-if="empty" class="cms-card overflow-hidden">
        <CmsEmptyState icon="i-lucide-shapes" :title="t('model.emptyTitle')" :description="t('model.emptyBody')">
          <template #actions>
            <UButton icon="i-lucide-plus" @click="() => { dialogOpen = true }">{{ t('model.newType') }}</UButton>
          </template>
        </CmsEmptyState>
      </div>

      <section v-if="visible.length" :aria-label="t('model.yourTypes')">
        <div class="mb-1.5 flex items-baseline justify-between gap-3">
          <h2 class="cms-label">{{ t('model.yourTypes') }}</h2>
          <span class="text-muted text-xs tabular-nums">{{ t('model.usedOf', { used: formatNumber(used), limit: formatNumber(limit) }) }}</span>
        </div>
        <p v-if="atLimit" id="cms-model-limit" class="mb-2 text-sm text-muted text-pretty">{{ t('model.limitReached', { limit: formatNumber(limit) }) }}</p>
        <ul class="cms-card overflow-hidden">
          <li v-for="type in visible" :key="type.name" class="border-b border-default last:border-0">
            <NuxtLink :to="`/admin/_model/${type.name}`" class="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated/60">
              <span class="grid size-9 shrink-0 place-items-center rounded-md border border-default text-muted">
                <UIcon :name="type.icon || CMS_MODEL_DEFAULT_ICON" class="size-5" aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium text-highlighted">{{ typeName(type) }}</span>
                <span class="block text-sm text-muted text-pretty">{{ subtitle(type) }}</span>
              </span>
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
      </section>
      <p v-else-if="atLimit" id="cms-model-limit" class="-mb-4 text-sm text-muted text-pretty">{{ t('model.limitReached', { limit: formatNumber(limit) }) }}</p>

      <section v-if="problems.length || attentionRows.length" :aria-label="t('model.needsAttention')">
        <h2 class="cms-label mb-1.5">{{ t('model.needsAttention') }}</h2>
        <ul class="cms-card overflow-hidden">
          <li v-for="p in problems" :key="p.id" class="flex items-start gap-3 border-b border-default bg-warning/10 px-4 py-3 last:border-0">
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div class="min-w-0 text-sm">
              <p class="font-medium text-highlighted">{{ p.where }}</p>
              <p class="text-muted text-pretty">{{ t('model.problemSentence') }}</p>
              <details class="mt-1">
                <summary class="cursor-pointer text-xs text-muted hover:text-highlighted">{{ t('model.forDevelopers') }}</summary>
                <p class="mt-1 break-words font-mono text-xs text-dimmed">{{ p.message }}</p>
              </details>
            </div>
          </li>
          <li v-for="a in attentionRows" :key="a.id" class="border-b border-default last:border-0">
            <NuxtLink :to="a.to" class="flex items-start gap-3 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15">
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium text-highlighted">{{ a.where }}<span v-if="a.language" class="font-normal text-muted"> · {{ a.language }}</span></span>
                <span class="block break-words text-muted text-pretty">{{ a.fields.length ? t('model.attention.fields', { count: a.fields.length, fields: a.fields.join(', ') }) : t('model.attention.type') }}</span>
              </span>
              <UIcon name="i-lucide-chevron-right" class="mt-0.5 size-4 shrink-0 text-dimmed" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section v-if="hidden.length" :aria-label="t('model.hidden')">
        <h2 class="cms-label mb-1.5">{{ t('model.hidden') }}</h2>
        <ul class="cms-card overflow-hidden">
          <li v-for="type in hidden" :key="type.name" class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-default px-4 py-3 last:border-0">
            <span class="grid size-9 shrink-0 place-items-center rounded-md border border-default text-dimmed">
              <UIcon :name="type.icon || CMS_MODEL_DEFAULT_ICON" class="size-5" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1 basis-44">
              <span class="block truncate font-medium text-muted">{{ typeName(type) }}</span>
              <span class="block text-sm text-muted text-pretty">{{ removedLine(type) }}</span>
            </span>
            <span class="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
              <UButton
                color="neutral" variant="ghost" size="sm" icon="i-lucide-trash-2" class="min-h-11 px-3" :disabled="restoring === type.name"
                :aria-label="t('model.deleteNamed', { name: typeName(type) })" @click="askDelete(type)"
              >{{ t('model.deleteForGood') }}</UButton>
              <UButton
                color="neutral" variant="outline" size="sm" icon="i-lucide-rotate-ccw" class="min-h-11 px-3" :loading="restoring === type.name" :disabled="!!restoring && restoring !== type.name"
                :aria-label="t('model.restoreNamed', { name: typeName(type) })" @click="restore(type)"
              >{{ t('model.restore') }}</UButton>
            </span>
          </li>
        </ul>
      </section>

      <section v-if="design.length" :aria-label="t('model.design')">
        <h2 class="cms-label">{{ t('model.design') }}</h2>
        <p class="mb-2 mt-0.5 text-sm text-muted text-pretty">{{ t('model.designHint') }}</p>
        <!-- quiet and compact: names to look into, not things to work on -->
        <ul class="cms-card grid gap-0.5 p-1.5 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="d in design" :key="d.name" class="min-w-0">
            <NuxtLink :to="`/admin/_model/${d.name}`" class="flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-elevated/60">
              <UIcon :name="d.icon || CMS_MODEL_DEFAULT_ICON" class="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate text-highlighted">{{ tl(d.label as any, d.name) }}</span>
              <UIcon name="i-lucide-lock" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
              <span class="sr-only">{{ t('model.locked') }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <p v-if="lastChange" class="text-xs text-muted">{{ lastChange }}</p>
    </div>

    <CmsModelDeleteDialog v-if="data && deleteType" v-model:open="deleteOpen" :type="deleteType" :field="null" :data="data" />
    <CmsModelTypeDialog v-if="data" v-model:open="dialogOpen" :doc="doc" :design="data.design" :limits="data.limits" :used="data.used" @created="created" />
  </CmsPage>
</template>
