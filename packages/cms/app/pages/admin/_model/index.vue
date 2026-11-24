<script setup lang="ts">
import {
  CMS_MODEL_DEFAULT_ICON, cmsModelDayText, cmsModelFields, cmsModelHiddenTypes, cmsModelNotesText, cmsModelPurgeText, cmsModelVisibleTypes,
} from '../../../utils/cmsModel'

// Content types: the kinds of content the site's owner made (Courses, Branches…), the ones waiting
// to be deleted for good, and the ones that come with the website's design. Administrators only;
// a site without the feature answers 404 and the page says so calmly.
definePageMeta({ layout: 'admin' })
const { t, tl, formatDateWith, formatNumber } = useCmsI18n()
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
const used = computed(() => data.value?.used.types ?? 0)
const atLimit = computed(() => !!data.value && used.value >= limit.value)
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

const dateCtx = { t: t as any, formatDateWith }
const dayText = (value: Date | string) => cmsModelDayText(value, dateCtx)
const purgeText = (type: (typeof hidden.value)[number]) => cmsModelPurgeText(type, dateCtx)

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

      <section v-if="problems.length" :aria-label="t('model.needsAttention')">
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
        </ul>
      </section>

      <section v-if="hidden.length" :aria-label="t('model.hidden')">
        <h2 class="cms-label mb-1.5">{{ t('model.hidden') }}</h2>
        <ul class="cms-card overflow-hidden">
          <li v-for="type in hidden" :key="type.name" class="flex items-center gap-3 border-b border-default px-4 py-3 last:border-0">
            <span class="grid size-9 shrink-0 place-items-center rounded-md border border-default text-dimmed">
              <UIcon :name="type.icon || CMS_MODEL_DEFAULT_ICON" class="size-5" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-muted">{{ typeName(type) }}</span>
              <span class="block text-sm text-muted text-pretty">{{ purgeText(type) }}</span>
            </span>
            <UButton
              color="neutral" variant="outline" size="sm" icon="i-lucide-rotate-ccw" :loading="restoring === type.name" :disabled="!!restoring && restoring !== type.name"
              :aria-label="t('model.restoreNamed', { name: typeName(type) })" @click="restore(type)"
            >{{ t('model.restore') }}</UButton>
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

    <CmsModelTypeDialog v-if="data" v-model:open="dialogOpen" :doc="doc" :design="data.design" :limits="data.limits" :used="data.used" @created="created" />
  </CmsPage>
</template>
