<script setup lang="ts">
// Make a workspace: you own it, it starts with the team "General".
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const name = ref('')
const busy = ref(false)
watch(open, (v) => { if (v) name.value = '' })
async function create() {
  busy.value = true
  try {
    const ws = await $fetch<{ slug: string }>('/api/workspaces', { method: 'POST', body: { name: name.value.trim() } })
    await refreshMe()
    open.value = false
    await navigateTo(`/w/${ws.slug}/t/all`)
  }
  catch (err) {
    toast.add({ title: 'Could not make the workspace', description: errorMessage(err), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New workspace" description="For a company, or one client. You own it, and it starts with the team General.">
    <template #body>
      <form id="new-workspace" @submit.prevent="create">
        <UFormField label="Name" name="name" description="Its address is made from the name once and stays when you rename it.">
          <UInput v-model="name" required maxlength="100" autofocus placeholder="Studio Grand" class="w-full" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { open = false }" />
        <UButton type="submit" form="new-workspace" label="Make workspace" :loading="busy" />
      </div>
    </template>
  </UModal>
</template>
