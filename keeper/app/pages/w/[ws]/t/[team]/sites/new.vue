<script setup lang="ts">
import type { SiteInput } from '#keeper/types/keeper'

// Guests only look: send them back to the sites.
const { canWrite, link, team } = useScope()
if (!canWrite.value) await navigateTo(link(), { replace: true })

useHead({ title: 'Add site · Keeper' })
const toast = useToast()
const busy = ref(false)

async function save(input: SiteInput) {
  busy.value = true
  try {
    const { id } = await $fetch<{ id: string }>('/api/sites', { method: 'POST', body: input })
    // Run the first check straight away, so the page opens with real numbers.
    await $fetch(`/api/sites/${id}/check`, { method: 'POST' }).catch(() => {})
    await refreshMe()
    await navigateTo(link(`/sites/${id}?added=1`))
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
  <AppPage title="Add site" :trail="[{ label: 'Sites', to: link() }]" description="A tinyzoo site Keeper should look after: its address, and its status token for the details.">
    <div class="max-w-2xl">
      <SiteForm :initial="team ? { teamId: team.id } : undefined" submit-label="Add site" :busy="busy" @submit="save" />
    </div>
  </AppPage>
</template>
