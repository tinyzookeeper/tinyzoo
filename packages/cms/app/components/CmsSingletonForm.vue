<script setup lang="ts">
// Edits a single-row global (Settings/Homepage). Fetches the one row, renders the
// same CmsField widgets as the entity form, and upserts via PUT /_singleton/:name.
const props = defineProps<{ entity: string, meta: any }>()
const toast = useToast()

const editable = computed(() => (props.meta?.fields ?? []).filter((f: any) => f.relation?.kind !== 'one-to-many'))
const state = reactive<Record<string, any>>({})
const fieldErrors = reactive<Record<string, string>>({})
// Singletons never "create" a new record from the form's POV (PUT upserts).
provide('cmsForm', { state, isNew: computed(() => false) })

function blankFor(f: any) {
  if (f.type === 'boolean') return false
  if (f.relation?.kind === 'many-to-many') return []
  if (f.type === 'richtext') return { type: 'doc', content: [] }
  return undefined
}

const { data } = await useFetch(() => `/api/cms/_singleton/${props.entity}`, { watch: [() => props.entity] })
Object.assign(state, data.value?.row ?? {})
watchEffect(() => {
  for (const f of editable.value) if (!(f.key in state)) state[f.key] = blankFor(f)
})

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
onBeforeRouteLeave(() => (dirty.value ? window.confirm('You have unsaved changes. Leave without saving?') : true))

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
    await $fetch(`/api/cms/_singleton/${props.entity}`, { method: 'PUT', body })
    dirty.value = false
    toast.add({ title: 'Saved', icon: 'i-lucide-check', color: 'success' })
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
        <h1 class="text-lg font-semibold truncate">{{ meta?.label }}</h1>
      </div>
      <UButton :loading="saving" icon="i-lucide-save" size="sm" @click="save">Save</UButton>
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
