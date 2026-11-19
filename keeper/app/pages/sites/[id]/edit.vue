<script setup lang="ts">
import type { SiteDetail, SiteInput } from '#shared/types/keeper'

const route = useRoute()
const id = computed(() => String(route.params.id))
const toast = useToast()

const { data: site, error } = await useFetch<SiteDetail>(() => `/api/sites/${id.value}`, { key: `site-${id.value}` })
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: 'Site not found', fatal: true })
useHead({ title: () => `Edit ${site.value?.name ?? 'site'} · Keeper` })

const busy = ref(false)
async function save(input: SiteInput) {
  busy.value = true
  try {
    await $fetch(`/api/sites/${id.value}`, { method: 'PATCH', body: input })
    toast.add({ title: 'Saved', color: 'success', icon: 'i-lucide-check' })
    await refreshNuxtData([`site-${id.value}`, 'overview'])
    await navigateTo(`/sites/${id.value}`)
  }
  catch (err) {
    toast.add({ title: 'Could not save', description: errorMessage(err), color: 'error' })
  }
  finally {
    busy.value = false
  }
}

const confirmOpen = ref(false)
function openConfirm() { confirmOpen.value = true }
function closeConfirm() { confirmOpen.value = false }
const deleting = ref(false)
async function remove() {
  deleting.value = true
  try {
    await $fetch(`/api/sites/${id.value}`, { method: 'DELETE' })
    toast.add({ title: `${site.value?.name} removed`, color: 'success' })
    confirmOpen.value = false
    await refreshNuxtData('overview')
    await navigateTo('/')
  }
  catch (err) {
    toast.add({ title: 'Could not remove the site', description: errorMessage(err), color: 'error' })
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <AppPage :title="site ? `Edit ${site.name}` : 'Edit site'" :back="`/sites/${id}`">
    <div v-if="site" class="max-w-2xl">
      <SiteForm
        :initial="{ name: site.name, client: site.client, url: site.url, environment: site.environment, repoUrl: site.repoUrl, notes: site.notes }"
        :site-id="site.id"
        :has-token="site.hasToken"
        submit-label="Save"
        :busy="busy"
        @submit="save"
      >
        <template #secondary>
          <UButton label="Remove site" icon="i-lucide-trash-2" color="error" variant="ghost" class="justify-center" @click="openConfirm" />
        </template>
      </SiteForm>

      <UModal v-model:open="confirmOpen" :title="`Remove ${site.name}?`" description="Keeper stops watching it and forgets its checks and incidents. The site itself is not touched.">
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="ghost" @click="closeConfirm" />
            <UButton label="Remove site" color="error" :loading="deleting" @click="remove" />
          </div>
        </template>
      </UModal>
    </div>
  </AppPage>
</template>
