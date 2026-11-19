<script setup lang="ts">
import type { SiteInput } from '#shared/types/keeper'

useHead({ title: 'Add site · Keeper' })
const toast = useToast()
const busy = ref(false)

async function save(input: SiteInput) {
  busy.value = true
  try {
    const { id } = await $fetch<{ id: string }>('/api/sites', { method: 'POST', body: input })
    toast.add({ title: `${input.name} added`, description: 'The first check runs now.', color: 'success', icon: 'i-lucide-check' })
    // Run the first check straight away, so the page opens with real numbers.
    await $fetch(`/api/sites/${id}/check`, { method: 'POST' }).catch(() => {})
    await navigateTo(`/sites/${id}`)
  }
  catch (err) {
    toast.add({ title: 'Could not add the site', description: errorMessage(err), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <AppPage title="Add site" back="/">
    <div class="max-w-2xl">
      <SiteForm submit-label="Add site" :busy="busy" @submit="save" />
    </div>
  </AppPage>
</template>
