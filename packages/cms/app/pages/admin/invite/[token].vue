<script setup lang="ts">
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
const { productName } = useCmsAdminHead()
const route = useRoute()
const signedIn = useCmsSignedIn()
// The tab already ends with the site's name (the title template): "Invitation · Site", not "Join Site · Site".
useHead({ title: () => t('auth.inviteTabTitle') })

const { data: invite, error: loadError } = await useFetch<{ email: string; name: string; role: string; inviter: string | null }>(
  (): string => `/api/cms/_auth/invite/${route.params.token}`,
)
const roleName = computed(() => {
  const r = invite.value?.role
  return r === 'admin' || r === 'editor' || r === 'author' ? t(`roles.${r}.name`).toLowerCase() : (r ?? '')
})

const form = reactive({ name: invite.value?.name ?? '', password: '' })
const errors = reactive<Record<string, string>>({})
const expired = ref(!!loadError.value)
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
  </form>
</template>
