<script setup lang="ts">
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
const { productName } = useCmsAdminHead()
const route = useRoute()
const signedIn = useCmsSignedIn()
useHead({ title: () => t('auth.inviteTitle', { site: productName.value }) })

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

async function submit() {
  Object.keys(errors).forEach((k) => delete errors[k])
  pending.value = true
  try {
    const res = await $fetch<{ user: any }>('/api/cms/_auth/accept', { method: 'POST', body: { token: route.params.token, ...form } })
    await signedIn(res.user)
  }
  catch (err: any) {
    if (err?.statusCode === 410) expired.value = true
    const issues = err?.data?.data
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) errors[i.path[0]] = i.message
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div v-if="expired || !invite" class="space-y-3">
    <h1 class="text-xl font-semibold text-highlighted tracking-tight">{{ t('auth.inviteExpiredTitle') }}</h1>
    <p class="text-sm text-muted">{{ t('auth.inviteExpired') }}</p>
  </div>
  <form v-else class="space-y-5" novalidate @submit.prevent="submit">
    <div>
      <h1 class="text-xl font-semibold text-highlighted tracking-tight">{{ t('auth.inviteTitle', { site: productName }) }}</h1>
      <p class="mt-1 text-sm text-muted">
        {{ invite.inviter ? t('auth.inviteSubtitle', { inviter: invite.inviter, role: roleName }) : t('auth.inviteSubtitleAnonymous', { role: roleName }) }}
      </p>
    </div>
    <UFormField :label="t('auth.email')" name="email">
      <UInput :model-value="invite.email" disabled class="w-full" />
    </UFormField>
    <UFormField :label="t('auth.name')" name="name" :error="errors.name">
      <UInput v-model="form.name" autocomplete="name" autofocus class="w-full" />
    </UFormField>
    <UFormField :label="t('auth.password')" name="password" :description="t('auth.passwordHint')" :error="errors.password">
      <CmsPasswordInput v-model="form.password" autocomplete="new-password" />
    </UFormField>
    <UButton type="submit" block :loading="pending">{{ t('auth.acceptInvite') }}</UButton>
  </form>
</template>
