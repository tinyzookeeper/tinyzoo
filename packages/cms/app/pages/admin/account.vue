<script setup lang="ts">
// Your own account: name, interface language, password.
definePageMeta({ layout: 'admin' })
const { t, locale, locales, setLocale } = useCmsI18n()
const toast = useToast()
const { user, fetch: refreshSession } = useUserSession()
useHead({ title: () => t('account.title') })

const profile = reactive({ name: user.value?.name ?? '', locale: user.value?.locale ?? locale.value })
// The shared demo account (cms.demo) keeps its name and password; only the language changes.
const demo = useRuntimeConfig().public.cmsDemo as { email?: string } | undefined
const isDemo = computed(() => !!demo?.email && user.value?.email?.toLowerCase() === demo.email.trim().toLowerCase())
const savingProfile = ref(false)
async function saveProfile() {
  savingProfile.value = true
  try {
    await $fetch('/api/cms/_auth/me', { method: 'PATCH', body: isDemo.value ? { locale: profile.locale } : profile })
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
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) pwErrors[i.path[0]] = cmsIssueMessage(i, null, t as any)
    if (!Object.keys(pwErrors).length) toast.add({ title: t('team.actionFailed'), description: cmsErrorMessage(err, ''), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    savingPw.value = false
  }
}
</script>

<template>
  <CmsPage :title="t('account.title')" narrow :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('account.title') }]">
    <!-- the same sections as every form: a cream tile, a heading, the fields -->
    <div class="cms-form max-w-[40rem]">
      <div class="cms-form__body">
        <section class="cms-section !pt-2 !border-t-0" aria-labelledby="account-profile">
          <header class="cms-section__head">
            <span class="cms-section__tile"><UIcon name="i-lucide-user-round" class="size-4" /></span>
            <div class="min-w-0">
              <h2 id="account-profile" class="cms-section__title">{{ t('account.profile') }}</h2>
              <p class="text-sm text-muted text-pretty">{{ t('account.profileDescription') }}</p>
            </div>
          </header>
          <form class="cms-section__fields" @submit.prevent="saveProfile">
            <UFormField :label="t('auth.name')" name="name">
              <UInput v-model="profile.name" autocomplete="name" :disabled="isDemo" class="w-full" />
            </UFormField>
            <UFormField :label="t('auth.email')" name="email">
              <UInput :model-value="user?.email" disabled icon="i-lucide-mail" class="w-full" />
            </UFormField>
            <UFormField :label="t('account.language')" name="locale">
              <USelect v-model="profile.locale" icon="i-lucide-languages" :items="locales.map((code: string) => ({ value: code, label: CMS_ADMIN_LOCALES[code] ?? code }))" class="w-full sm:w-60" />
            </UFormField>
            <div>
              <UButton type="submit" :loading="savingProfile">{{ t('common.save') }}</UButton>
            </div>
          </form>
        </section>

        <section class="cms-section" aria-labelledby="account-password">
          <header class="cms-section__head">
            <span class="cms-section__tile"><UIcon name="i-lucide-key-round" class="size-4" /></span>
            <div class="min-w-0">
              <h2 id="account-password" class="cms-section__title">{{ t('account.password') }}</h2>
              <p class="text-sm text-muted text-pretty">{{ t('account.passwordDescription') }}</p>
            </div>
          </header>
          <UAlert v-if="isDemo" color="neutral" variant="subtle" icon="i-lucide-info" :title="t('account.demoTitle')" :description="t('account.demoBody')" />
          <form v-else class="cms-section__fields" @submit.prevent="changePassword">
            <UFormField :label="t('account.currentPassword')" name="current" :error="pwErrors.current">
              <CmsPasswordInput v-model="pw.current" autocomplete="current-password" />
            </UFormField>
            <UFormField :label="t('account.newPassword')" name="password" :help="t('auth.passwordHint')" :error="pwErrors.password">
              <CmsPasswordInput v-model="pw.password" autocomplete="new-password" />
            </UFormField>
            <div>
              <UButton type="submit" color="neutral" variant="outline" :loading="savingPw">{{ t('account.changePassword') }}</UButton>
            </div>
          </form>
        </section>
      </div>
    </div>
  </CmsPage>
</template>
