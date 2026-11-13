<script setup lang="ts">
// Your own account: name, interface language, password.
definePageMeta({ layout: 'admin' })
const { t, locale, locales, setLocale } = useCmsI18n()
const toast = useToast()
const { user, fetch: refreshSession } = useUserSession()
useHead({ title: () => t('account.title') })

const profile = reactive({ name: user.value?.name ?? '', locale: user.value?.locale ?? locale.value })
const savingProfile = ref(false)
async function saveProfile() {
  savingProfile.value = true
  try {
    await $fetch('/api/cms/_auth/me', { method: 'PATCH', body: profile })
    await refreshSession()
    setLocale(profile.locale)
    toast.add({ title: t('account.saved'), icon: 'i-lucide-check', color: 'success' })
  }
  catch (err: any) {
    toast.add({ title: t('team.actionFailed'), description: cmsErrorMessage(err, ''), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    savingProfile.value = false
  }
}

const pw = reactive({ current: '', password: '' })
const pwErrors = reactive<Record<string, string>>({})
const savingPw = ref(false)
async function changePassword() {
  Object.keys(pwErrors).forEach((k) => delete pwErrors[k])
  savingPw.value = true
  try {
    await $fetch('/api/cms/_auth/password', { method: 'POST', body: pw })
    Object.assign(pw, { current: '', password: '' })
    toast.add({ title: t('account.passwordChanged'), icon: 'i-lucide-check', color: 'success' })
  }
  catch (err: any) {
    const issues = err?.data?.data
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) pwErrors[i.path[0]] = i.message
    if (!Object.keys(pwErrors).length) toast.add({ title: t('team.actionFailed'), description: cmsErrorMessage(err, ''), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    savingPw.value = false
  }
}
</script>

<template>
  <CmsPage :title="t('account.title')" narrow :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('account.title') }]">
    <div class="space-y-6">
      <CmsSection :title="t('account.profile')" :description="t('account.profileDescription')">
        <form class="space-y-5" @submit.prevent="saveProfile">
          <UFormField :label="t('auth.name')" name="name">
            <UInput v-model="profile.name" autocomplete="name" class="w-full" />
          </UFormField>
          <UFormField :label="t('auth.email')" name="email">
            <UInput :model-value="user?.email" disabled class="w-full" />
          </UFormField>
          <UFormField :label="t('account.language')" name="locale">
            <USelect v-model="profile.locale" :items="locales.map((code: string) => ({ value: code, label: CMS_ADMIN_LOCALES[code] ?? code }))" class="w-full sm:w-60" />
          </UFormField>
          <div class="flex justify-end">
            <UButton type="submit" :loading="savingProfile">{{ t('common.save') }}</UButton>
          </div>
        </form>
      </CmsSection>

      <CmsSection :title="t('account.password')" :description="t('account.passwordDescription')">
        <form class="space-y-5" @submit.prevent="changePassword">
          <UFormField :label="t('account.currentPassword')" name="current" :error="pwErrors.current">
            <CmsPasswordInput v-model="pw.current" autocomplete="current-password" />
          </UFormField>
          <UFormField :label="t('account.newPassword')" name="password" :description="t('auth.passwordHint')" :error="pwErrors.password">
            <CmsPasswordInput v-model="pw.password" autocomplete="new-password" />
          </UFormField>
          <div class="flex justify-end">
            <UButton type="submit" color="neutral" variant="outline" :loading="savingPw">{{ t('account.changePassword') }}</UButton>
          </div>
        </form>
      </CmsSection>
    </div>
  </CmsPage>
</template>
