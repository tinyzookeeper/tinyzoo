<script setup lang="ts">
// Remount per record so state/dirty/guard fully reset when switching records
// (and after a create→redirect), rather than reusing a stale component instance.
definePageMeta({ layout: 'admin', key: (route) => route.fullPath })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const entity = computed(() => route.params.entity as string)
const id = computed(() => route.params.id as string)
const isNew = computed(() => id.value === 'new')

const { data: graph } = await useFetch('/api/cms/_graph', { key: 'cms-graph' })
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === entity.value))
const editable = computed(() => (meta.value?.fields ?? []).filter((f: any) => f.relation?.kind !== 'one-to-many'))

const state = reactive<Record<string, any>>({})
const fieldErrors = reactive<Record<string, string>>({})
// Let field components (e.g. slug auto-gen) read sibling values + create-mode.
provide('cmsForm', { state, isNew })

function blankFor(f: any) {
  if (f.type === 'boolean') return false
  if (f.relation?.kind === 'many-to-many') return []
  if (f.type === 'richtext') return { type: 'doc', content: [] }
  return undefined
}

if (!isNew.value) {
  const { data } = await useFetch<{ row: Record<string, any> }>((): string => `/api/cms/${entity.value}/${id.value}`)
  Object.assign(state, data.value?.row ?? {})
}
watchEffect(() => {
  for (const f of editable.value) if (!(f.key in state)) state[f.key] = blankFor(f)
})

// Unsaved-changes guard: mark dirty on edits made after the initial load/populate,
// and warn before leaving (in-app nav + hard unload). Cleared on successful save.
const dirty = ref(false)
let ready = false
watch(state, () => { if (ready) dirty.value = true }, { deep: true })
onMounted(() => {
  ready = true
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  return window.confirm('You have unsaved changes. Leave without saving?')
})

// Publish workflow (only when the entity declares `publish`).
const publish = computed(() => meta.value?.publish)
const isPublished = computed(() => !!publish.value && state[publish.value.field] === publish.value.publishedValue)
async function togglePublish() {
  const p = publish.value
  if (!p) return
  const willPublish = !isPublished.value
  state[p.field] = willPublish ? p.publishedValue : p.draftValue
  if (willPublish && p.dateField && !state[p.dateField]) state[p.dateField] = new Date().toISOString()
  await save()
}
const previewUrl = computed(() => {
  const p = publish.value
  if (!p?.preview) return null
  let ok = true
  const url = p.preview.replace(/:(\w+)/g, (_m: string, k: string) => {
    const v = state[k]
    if (v === undefined || v === null || v === '') ok = false
    return encodeURIComponent(v ?? '')
  })
  return ok ? `${url}?preview` : null
})

const saving = ref(false)
async function save() {
  saving.value = true
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
  try {
    const body: Record<string, any> = {}
    for (const f of editable.value) {
      const v = state[f.key]
      if ((v === '' || v === undefined) && (f.optional || f.relation?.kind === 'many-to-many')) continue
      body[f.key] = v
    }
    if (isNew.value) {
      const url: string = `/api/cms/${entity.value}`
      const res: any = await $fetch(url, { method: 'POST', body })
      dirty.value = false // clear before the redirect so the guard doesn't fire
      toast.add({ title: 'Created', icon: 'i-lucide-check', color: 'success' })
      await router.push(`/admin/${entity.value}/${res.row.id}`)
    } else {
      const url: string = `/api/cms/${entity.value}/${id.value}`
      await $fetch(url, { method: 'PATCH', body })
      dirty.value = false
      toast.add({ title: 'Saved', icon: 'i-lucide-check', color: 'success' })
    }
  } catch (e: any) {
    const issues = e.data?.data
    if (Array.isArray(issues)) {
      for (const i of issues) if (i.path?.[0]) fieldErrors[i.path[0]] = i.message
      toast.add({ title: 'Please fix the highlighted fields', icon: 'i-lucide-triangle-alert', color: 'error' })
    } else {
      toast.add({ title: 'Save failed', description: e.data?.statusMessage ?? e.message, icon: 'i-lucide-x', color: 'error' })
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <header class="h-16 border-b border-default bg-default/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-8 gap-4">
      <div class="flex items-center gap-2 min-w-0 text-sm">
        <ULink to="/admin" class="text-muted hover:text-default">Dashboard</ULink>
        <UIcon name="i-lucide-chevron-right" class="size-3.5 text-dimmed" />
        <ULink :to="`/admin/${entity}`" class="text-muted hover:text-default">{{ meta?.label }}</ULink>
        <UIcon name="i-lucide-chevron-right" class="size-3.5 text-dimmed" />
        <span class="font-semibold truncate">{{ isNew ? 'New' : 'Edit' }}</span>
        <UBadge
          v-if="publish && !isNew" :color="isPublished ? 'success' : 'neutral'" variant="subtle" size="sm"
        >{{ isPublished ? 'Published' : 'Draft' }}</UBadge>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="publish && !isNew && previewUrl" :to="previewUrl" target="_blank"
          variant="ghost" color="neutral" size="sm" icon="i-lucide-external-link"
        >Preview</UButton>
        <UButton
          v-if="publish && !isNew" :color="isPublished ? 'neutral' : 'success'"
          :variant="isPublished ? 'outline' : 'solid'" size="sm" :loading="saving"
          :icon="isPublished ? 'i-lucide-eye-off' : 'i-lucide-globe'" @click="togglePublish"
        >{{ isPublished ? 'Unpublish' : 'Publish' }}</UButton>
        <UButton :to="`/admin/${entity}`" variant="ghost" color="neutral" size="sm">Cancel</UButton>
        <UButton :loading="saving" icon="i-lucide-save" size="sm" @click="save">{{ isNew ? 'Create' : 'Save' }}</UButton>
      </div>
    </header>

    <div class="p-8 max-w-2xl">
      <UCard>
        <div class="space-y-5">
          <CmsField
            v-for="f in editable" :key="f.key"
            :field="f" :entity="entity" :error="fieldErrors[f.key]"
            v-model="state[f.key]"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
