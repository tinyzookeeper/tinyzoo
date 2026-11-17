<script setup lang="ts">
// Shown instead of the admin to a person whose role the site no longer has (it was taken out of
// cms.config.ts): they can sign in, but have no access to anything until an administrator gives
// them another role. Their account page and signing out still work.
defineProps<{ role: string }>()
const { t } = useCmsI18n()
const { clear } = useUserSession()
useHead({ title: () => t('roleRemoved.title') })

async function logout() {
  await $fetch('/api/cms/_auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/admin/login')
}
</script>

<template>
  <CmsPage :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }]" narrow :heading="t('roleRemoved.title')">
    <CmsEmptyState plain icon="i-lucide-user-lock" :title="t('roleRemoved.title')" :description="t('roleRemoved.body', { role })">
      <template #actions>
        <UButton to="/admin/account" color="neutral" variant="outline" icon="i-lucide-user-round">{{ t('nav.account') }}</UButton>
        <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" @click="logout">{{ t('user.signOut') }}</UButton>
      </template>
    </CmsEmptyState>
  </CmsPage>
</template>
