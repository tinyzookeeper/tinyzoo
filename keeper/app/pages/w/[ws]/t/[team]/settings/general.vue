<script setup lang="ts">
import type { WorkspaceSettings } from '#keeper/types/keeper'

// The workspace's name (its address stays), and deleting an empty one.
const toast = useToast()
const { wsSlug, isManager } = useScope()
const { data: ws, refresh } = await useFetch<WorkspaceSettings>(() => `/api/w/${wsSlug.value}`, { key: `ws-${wsSlug.value}` })
const name = ref(ws.value?.name ?? '')
const signature = ref(ws.value?.signature ?? '')
watch(ws, (w) => {
  if (!w) return
  name.value = w.name
  signature.value = w.signature
})
const address = computed(() => `${useRequestURL().origin}/w/${ws.value?.slug ?? wsSlug.value}`)

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch(`/api/w/${wsSlug.value}`, { method: 'PATCH', body: { name: name.value.trim(), signature: signature.value.trim() } })
    await Promise.all([refresh(), refreshMe()])
    toast.add({ title: 'Saved', color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: 'Could not save', description: errorMessage(err), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

const logoChanged = () => Promise.all([refresh(), refreshMe()])

const deleteOpen = ref(false)
const confirmName = ref('')
const deleting = ref(false)
async function remove() {
  deleting.value = true
  try {
    await $fetch(`/api/w/${wsSlug.value}`, { method: 'DELETE' })
    toast.add({ title: `${ws.value?.name} deleted`, color: 'success' })
    deleteOpen.value = false
    useLastScope().value = null
    await refreshMe()
    await navigateTo('/')
  }
  catch (err) {
    toast.add({ title: 'Could not delete it', description: errorMessage(err), color: 'error' })
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="ws" class="flex flex-col gap-6">
    <InfoCard title="Workspace">
      <form v-if="isManager" class="flex flex-col gap-4" @submit.prevent="save">
        <UFormField label="Name" name="name">
          <UInput v-model="name" required maxlength="100" class="w-full" />
        </UFormField>
        <UFormField label="Address" name="address" description="Made from the name once. It stays when you rename the workspace, so links keep working.">
          <code class="block truncate rounded-md bg-elevated px-3 py-2 font-mono text-sm text-highlighted">{{ address }}</code>
        </UFormField>
        <UFormField label="Looked after by" name="signature" :description="`What the client's guests read under the name: “looked after by …”. Empty: ${ws.name}.`">
          <UInput v-model="signature" maxlength="100" placeholder="Jagu" class="w-full" />
        </UFormField>
        <div class="flex justify-end">
          <UButton type="submit" label="Save" :loading="saving" />
        </div>
      </form>
      <dl v-else class="flex flex-col gap-3 text-sm">
        <div><dt class="text-muted">Name</dt><dd class="text-highlighted">{{ ws.name }}</dd></div>
        <div><dt class="text-muted">Your role</dt><dd class="text-highlighted">{{ ROLE_LABELS[ws.role] }}</dd></div>
        <p class="text-xs text-muted">Only an owner or admin can change these.</p>
      </dl>
    </InfoCard>

    <InfoCard title="Logo">
      <LogoPicker :origin="ws" :name="ws.name" kind="workspace" :endpoint="`/api/w/${wsSlug}/logo`" :can-edit="isManager" @changed="logoChanged" />
      <p v-if="!isManager" class="mt-3 text-xs text-muted">Only an owner or admin can change it.</p>
    </InfoCard>

    <InfoCard v-if="ws.role === 'owner'" title="Delete workspace">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p class="min-w-0 flex-1 text-sm text-pretty text-toned">
          <template v-if="ws.canDelete">{{ ws.name }} has no sites. Deleting it removes its teams, people and invitations.</template>
          <template v-else>Only an empty workspace can be deleted: move its teams to another workspace (Teams) or remove its sites first.</template>
        </p>
        <UButton label="Delete workspace" color="error" variant="outline" icon="i-lucide-trash-2" :disabled="!ws.canDelete" class="self-start" @click="() => { confirmName = ''; deleteOpen = true }" />
      </div>
    </InfoCard>

    <UModal v-model:open="deleteOpen" :title="`Delete ${ws.name}?`" description="Its teams, people and invitations go with it. This cannot be undone.">
      <template #body>
        <UFormField :label="`Type ${ws.name} to confirm`" name="confirm">
          <UInput v-model="confirmName" autofocus class="w-full" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { deleteOpen = false }" />
          <UButton label="Delete workspace" color="error" :loading="deleting" :disabled="confirmName !== ws.name" @click="remove" />
        </div>
      </template>
    </UModal>
  </div>
</template>
