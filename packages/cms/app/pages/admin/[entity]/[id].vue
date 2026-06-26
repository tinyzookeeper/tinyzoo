<script setup lang="ts">
definePageMeta({ layout: 'admin' })
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

function blankFor(f: any) {
  if (f.type === 'boolean') return false
  if (f.relation?.kind === 'many-to-many') return []
  if (f.type === 'richtext') return { type: 'doc', content: [] }
  return undefined
}

if (!isNew.value) {
  const { data } = await useFetch(() => `/api/cms/${entity.value}/${id.value}`)
  Object.assign(state, data.value?.row ?? {})
}
watchEffect(() => {
  for (const f of editable.value) if (!(f.key in state)) state[f.key] = blankFor(f)
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
      const res: any = await $fetch(`/api/cms/${entity.value}`, { method: 'POST', body })
      toast.add({ title: 'Created', icon: 'i-lucide-check', color: 'success' })
      await router.push(`/admin/${entity.value}/${res.row.id}`)
    } else {
      await $fetch(`/api/cms/${entity.value}/${id.value}`, { method: 'PATCH', body })
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
      </div>
      <div class="flex items-center gap-2">
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
