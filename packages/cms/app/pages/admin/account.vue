<script setup lang="ts">
// Your own account: name, interface language, sign-in email, password.
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
const profileErrors = reactive<Record<string, string>>({})
const profileForm = ref<HTMLElement | null>(null)
async function saveProfile() {
  Object.keys(profileErrors).forEach((k) => delete profileErrors[k])
  savingProfile.value = true
  try {
    await $fetch('/api/cms/_auth/me', { method: 'PATCH', body: isDemo.value ? { locale: profile.locale } : profile })
    await refreshSession()
    setLocale(profile.locale)
    toast.add({ title: t('account.saved'), icon: 'i-lucide-check', color: 'success' })
  }
  catch (err: any) {
    // A field that is wrong is marked and read out ("Please fill this in"), not a bare "Validation failed" toast.
    const issues = err?.data?.data
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) profileErrors[i.path[0]] = cmsIssueMessage(i, null, t as any)
    if (Object.keys(profileErrors).length) await cmsFocusInvalid(profileForm.value)
    else toast.add({ title: t('team.actionFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    savingProfile.value = false
  }
}

// ── sign-in email: asked for with the password, made when the link sent to the new address is opened ──
interface PendingEmail { email: string; expiresAt: string }
// Read in the browser after the page is shown: an async load in setup shifts the ids Nuxt UI gives this
// page's labels and fields between the server and the browser (every label pointed at nothing).
const pendingEmail = ref<PendingEmail | null>(null)
async function refreshEmailState() {
  try {
    pendingEmail.value = (await $fetch<{ pending: PendingEmail | null }>('/api/cms/_auth/email')).pending
  }
  catch {
    pendingEmail.value = null // nothing to show; asking again still works
  }
}
onMounted(refreshEmailState)
const emailChange = reactive({ email: '', password: '' })
const emailErrors = reactive<Record<string, string>>({})
const emailForm = ref<HTMLElement | null>(null)
const savingEmail = ref(false)
const cancellingEmail = ref(false)
async function requestEmailChange() {
  Object.keys(emailErrors).forEach((k) => delete emailErrors[k])
  savingEmail.value = true
  try {
    const res = await $fetch<{ pending: PendingEmail }>('/api/cms/_auth/email', { method: 'POST', body: emailChange })
    pendingEmail.value = res.pending
    Object.assign(emailChange, { email: '', password: '' })
    toast.add({ title: t('account.emailSent'), description: res.pending.email, icon: 'i-lucide-mail-check', color: 'success' })
  }
  catch (err: any) {
    const issues = err?.data?.data
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) emailErrors[i.path[0]] = cmsIssueMessage(i, null, t as any)
    if (Object.keys(emailErrors).length) await cmsFocusInvalid(emailForm.value)
    else toast.add({ title: t('team.actionFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    savingEmail.value = false
  }
}
async function cancelEmailChange() {
  cancellingEmail.value = true
  try {
    await $fetch('/api/cms/_auth/email', { method: 'DELETE' })
    await refreshEmailState()
    toast.add({ title: t('account.emailChangeCancelled'), icon: 'i-lucide-check', color: 'success' })
  }
  catch (err: any) {
    toast.add({ title: t('team.actionFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    cancellingEmail.value = false
  }
}

const pw = reactive({ current: '', password: '' })
const pwErrors = reactive<Record<string, string>>({})
const pwForm = ref<HTMLElement | null>(null)
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
    if (Object.keys(pwErrors).length) await cmsFocusInvalid(pwForm.value)
    else toast.add({ title: t('team.actionFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
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
          <form method="post" ref="profileForm" class="cms-section__fields" novalidate @submit.prevent="saveProfile">
            <UFormField :label="t('auth.name')" name="name" :error="profileErrors.name || undefined">
              <UInput v-model="profile.name" autocomplete="name" :disabled="isDemo" class="w-full" />
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
            </UFormField>
            <UFormField :label="t('account.language')" name="locale">
              <USelect v-model="profile.locale" icon="i-lucide-languages" :items="locales.map((code: string) => ({ value: code, label: CMS_ADMIN_LOCALES[code] ?? code }))" class="w-full sm:w-60" />
            </UFormField>
            <div>
              <UButton type="submit" :loading="savingProfile">{{ t('common.save') }}</UButton>
            </div>
          </form>
        </section>

        <section class="cms-section" aria-labelledby="account-email">
          <header class="cms-section__head">
            <span class="cms-section__tile"><UIcon name="i-lucide-mail" class="size-4" /></span>
            <div class="min-w-0">
              <h2 id="account-email" class="cms-section__title">{{ t('account.signInEmail') }}</h2>
              <p class="text-sm text-muted text-pretty">{{ t('account.signInEmailDescription') }}</p>
            </div>
          </header>
          <div class="cms-section__fields">
            <UFormField :label="t('account.currentEmail')" name="currentEmail">
              <UInput :model-value="user?.email ?? ''" disabled icon="i-lucide-mail" class="w-full" />
            </UFormField>
            <UAlert v-if="isDemo" color="neutral" variant="subtle" icon="i-lucide-info" :title="t('account.demoTitle')" :description="t('account.demoEmail')" />
            <template v-else>
              <!-- a change waiting for its link: what was sent where, what to do if it does not arrive -->
              <UAlert
                v-if="pendingEmail" color="info" variant="subtle" icon="i-lucide-mail-check" role="status"
                :title="t('account.emailPendingTitle', { email: pendingEmail.email })"
              >
                <template #description>
                  <p class="text-pretty">{{ t('account.emailPendingBody') }}</p>
                  <p class="mt-2 text-pretty">{{ t('account.emailNotArrived') }}</p>
                  <UButton class="mt-3" color="neutral" variant="outline" size="sm" icon="i-lucide-x" :loading="cancellingEmail" @click="cancelEmailChange">{{ t('account.cancelEmailChange') }}</UButton>
                </template>
              </UAlert>
              <form method="post" ref="emailForm" class="space-y-5" novalidate @submit.prevent="requestEmailChange">
                <UFormField :label="t('account.newEmail')" name="email" :error="emailErrors.email || undefined" required>
                  <UInput v-model="emailChange.email" type="email" autocomplete="email" inputmode="email" class="w-full" />
                  <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
                </UFormField>
                <UFormField :label="t('account.passwordToConfirm')" name="password" :help="t('account.passwordToConfirmHint')" :error="emailErrors.password || undefined" required>
                  <CmsPasswordInput v-model="emailChange.password" autocomplete="current-password" />
                  <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
                </UFormField>
                <div>
                  <UButton type="submit" color="neutral" variant="outline" icon="i-lucide-send" :loading="savingEmail">{{ t('account.changeEmail') }}</UButton>
                </div>
              </form>
            </template>
          </div>
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
          <form v-else method="post" ref="pwForm" class="cms-section__fields" novalidate @submit.prevent="changePassword">
            <UFormField :label="t('account.currentPassword')" name="current" :error="pwErrors.current || undefined">
              <CmsPasswordInput v-model="pw.current" autocomplete="current-password" />
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
            </UFormField>
            <UFormField :label="t('account.newPassword')" name="password" :help="t('auth.passwordHint')" :error="pwErrors.password || undefined">
              <CmsPasswordInput v-model="pw.password" autocomplete="new-password" />
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
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
