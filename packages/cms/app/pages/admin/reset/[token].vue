<script setup lang="ts">
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
useHead({ title: () => t('auth.resetTitle') })
const route = useRoute()
const signedIn = useCmsSignedIn()

const password = ref('')
const error = ref('')
const expired = ref(false)
const pending = ref(false)

async function submit() {
  error.value = ''
  pending.value = true
  try {
    const res = await $fetch<{ user: any }>('/api/cms/_auth/reset', { method: 'POST', body: { token: route.params.token, password: password.value } })
    await signedIn(res.user)
  }
  catch (err: any) {
    if (err?.statusCode === 410) expired.value = true
    else error.value = err?.data?.data?.[0]?.message ?? cmsErrorMessage(err, t('team.actionFailed'))
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div v-if="expired" class="space-y-5">
    <div>
      <h1 class="text-xl font-semibold text-highlighted tracking-tight">{{ t('auth.linkExpiredTitle') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('auth.linkExpired') }}</p>
    </div>
    <UButton to="/admin/forgot" block>{{ t('auth.requestNewLink') }}</UButton>
  </div>
  <form v-else class="space-y-5" novalidate @submit.prevent="submit">
    <h1 class="text-xl font-semibold text-highlighted tracking-tight">{{ t('auth.resetTitle') }}</h1>
    <UFormField :label="t('auth.newPassword')" name="password" :description="t('auth.passwordHint')" :error="error || undefined">
      <CmsPasswordInput v-model="password" autocomplete="new-password" autofocus />
    </UFormField>
    <UButton type="submit" block :loading="pending">{{ t('auth.savePassword') }}</UButton>
  </form>
</template>
