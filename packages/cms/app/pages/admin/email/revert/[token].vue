<script setup lang="ts">
// The link from "your sign-in email was changed", in the old mailbox: gives the account
// its old address back and sets a new password in one step (whoever made the change knew
// the old one). Opening the page changes nothing (mail scanners open links); the form
// does it, ends every other session and signs this browser in, as a password reset does.
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
const { productName } = useCmsAdminHead()
const route = useRoute()
const signedIn = useCmsSignedIn()
useHead({ title: () => t('auth.emailRevertTabTitle') })

const token = computed(() => String(route.params.token ?? ''))
const { data: info, error: loadError } = await useFetch<{ email: string }>((): string => `/api/cms/_auth/email/revert/${token.value}`)

const outcome = ref<'expired' | 'taken' | null>(loadError.value ? 'expired' : null)
const password = ref('')
const error = ref('')
const formError = ref('')
const pending = ref(false)
const formEl = ref<HTMLElement | null>(null)

async function submit() {
  error.value = ''
  formError.value = ''
  pending.value = true
  try {
    const res = await $fetch<{ user: any }>('/api/cms/_auth/email/revert', { method: 'POST', body: { token: token.value, password: password.value } })
    await signedIn(res.user)
  }
  catch (err: any) {
    const status = err?.statusCode ?? err?.status
    if (status === 410) outcome.value = 'expired'
    else if (status === 409) outcome.value = 'taken'
    else {
      // In the page's language, not the validator's English.
      const issue = err?.data?.data?.[0]
      if (issue?.code) error.value = cmsIssueMessage(issue, null, t as any)
      else formError.value = cmsRequestError(err, t as any)
      await cmsFocusInvalid(formEl.value)
    }
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div v-if="outcome === 'taken'" class="space-y-3">
    <h1 class="text-center cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.emailTakenTitle') }}</h1>
    <p class="text-sm text-muted text-pretty">{{ t('auth.emailRevertTakenBody', { email: info?.email ?? '' }) }}</p>
  </div>
  <div v-else-if="outcome === 'expired' || !info" class="space-y-3">
    <h1 class="text-center cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.linkExpiredTitle') }}</h1>
    <p class="text-sm text-muted text-pretty">{{ t('auth.emailRevertExpired') }}</p>
  </div>
  <form v-else method="post" ref="formEl" class="space-y-5" novalidate @submit.prevent="submit">
    <div class="text-center">
      <h1 class="cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.emailRevertTitle') }}</h1>
      <p class="mt-1 text-sm text-muted text-pretty">{{ t('auth.emailRevertBody', { site: productName, email: info.email }) }}</p>
    </div>
    <UAlert v-if="formError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="formError" role="alert" data-cms-error-summary />
    <UFormField :label="t('auth.newPassword')" name="password" :description="t('auth.passwordHint')" :error="error || undefined">
      <CmsPasswordInput v-model="password" autocomplete="new-password" autofocus />
      <template #error="{ error: message }"><span v-if="message" role="alert">{{ message }}</span></template>
    </UFormField>
    <UButton type="submit" block :loading="pending">{{ t('auth.emailRevertAction') }}</UButton>
  </form>
</template>
