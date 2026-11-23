<script setup lang="ts">
definePageMeta({ layout: 'cms-auth' })
const { t, tl } = useCmsI18n()
const { productName } = useCmsAdminHead()
const route = useRoute()
const signedIn = useCmsSignedIn()
// The tab already ends with the site's name (the title template): "Invitation · Site", not "Join Site · Site".
useHead({ title: () => t('auth.inviteTabTitle') })

const { data: invite, error: loadError } = await useFetch<{ email: string; name: string; role: string; roleLabel?: any; inviter: string | null; account?: { enabled: boolean } }>(
  (): string => `/api/cms/_auth/invite/${route.params.token}`,
)
const roleName = computed(() => {
  const r = invite.value?.role
  if (r === 'admin' || r === 'editor' || r === 'author') return t(`roles.${r}.name`).toLowerCase()
  return invite.value?.roleLabel ? tl(invite.value.roleLabel, r ?? '') : (r ?? '')
})

const form = reactive({ name: invite.value?.name ?? '', password: '' })
const errors = reactive<Record<string, string>>({})
const expired = ref(!!loadError.value)
// The link no longer works (it ran out, or was used): where people sign in with the tinyzoo account, the
// invited address's account still gets in, so the page offers that instead of a dead end. The 410
// says so itself (a site without the account says nothing, and the page is what it always was).
const accountStillWorks = computed(() => !!invite.value?.account?.enabled || !!(loadError.value as any)?.data?.data?.account?.enabled)
const pending = ref(false)
const formError = ref('')
const formEl = ref<HTMLElement | null>(null)

async function submit() {
  Object.keys(errors).forEach((k) => delete errors[k])
  formError.value = ''
  pending.value = true
  try {
    const res = await $fetch<{ user: any }>('/api/cms/_auth/accept', { method: 'POST', body: { token: route.params.token, ...form } })
    await signedIn(res.user)
  }
  catch (err: any) {
    if (err?.statusCode === 410) expired.value = true
    const issues = err?.data?.data
    // In the page's language ("At least 10 characters"), not the validator's English.
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) errors[i.path[0]] = cmsIssueMessage(i, null, t as any)
    if (!expired.value && !Object.values(errors).some(Boolean)) formError.value = cmsErrorMessage(err, t('team.actionFailed'))
    await cmsFocusInvalid(formEl.value)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div v-if="expired || !invite" class="space-y-3">
    <h1 class="text-center cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.inviteExpiredTitle') }}</h1>
    <p class="text-sm text-muted">{{ t('auth.inviteExpired') }}</p>
    <template v-if="accountStillWorks">
      <p class="text-sm text-muted text-pretty" data-cms-invite-expired-account>{{ t('auth.inviteExpiredAccount') }}</p>
      <UButton to="/api/cms/_auth/account/start?next=%2Fadmin" external block icon="i-lucide-log-in" data-cms-account-sign-in>{{ t('auth.accountSignIn') }}</UButton>
    </template>
  </div>
  <form v-else method="post" ref="formEl" class="space-y-5" novalidate @submit.prevent="submit">
    <div class="text-center">
      <h1 class="cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.inviteTitle', { site: productName }) }}</h1>
      <p class="mt-1 text-sm text-muted">
        {{ invite.inviter ? t('auth.inviteSubtitle', { inviter: invite.inviter, role: roleName }) : t('auth.inviteSubtitleAnonymous', { role: roleName }) }}
      </p>
    </div>
    <UFormField :label="t('auth.email')" name="email">
      <UInput :model-value="invite.email" disabled class="w-full" />
    </UFormField>
    <UFormField :label="t('auth.name')" name="name" :error="errors.name || undefined">
      <UInput v-model="form.name" autocomplete="name" autofocus class="w-full" />
      <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
    </UFormField>
    <UFormField :label="t('auth.password')" name="password" :description="t('auth.passwordHint')" :error="errors.password || undefined">
      <CmsPasswordInput v-model="form.password" autocomplete="new-password" />
      <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
    </UFormField>
    <UAlert v-if="formError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="formError" role="alert" data-cms-error-summary />
    <UButton type="submit" block :loading="pending">{{ t('auth.acceptInvite') }}</UButton>
    <!-- the tinyzoo account of the invited address accepts the invitation as well, without a password -->
    <p v-if="invite.account?.enabled" class="text-sm text-muted text-pretty" data-cms-invite-account>
      {{ t('auth.inviteAccount') }}
      <a href="/api/cms/_auth/account/start?next=%2Fadmin" class="font-medium text-highlighted underline underline-offset-2">{{ t('auth.accountSignIn') }}</a>
    </p>
  </form>
</template>
