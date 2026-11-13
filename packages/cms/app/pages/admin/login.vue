<script setup lang="ts">
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
const { productName } = useCmsAdminHead()
useHead({ title: () => t('auth.signInTitle') })

// A fresh install has no accounts yet: go create the first one instead.
const { data: status } = await useFetch<{ needsSetup: boolean }>('/api/cms/_auth/status')
if (status.value?.needsSetup) await navigateTo('/admin/setup', { replace: true })

const signedIn = useCmsSignedIn()
const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

async function submit() {
  error.value = ''
  pending.value = true
  try {
    const res = await $fetch<{ user: { locale: string | null } }>('/api/cms/_auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
    await signedIn(res.user)
  }
  catch (err: any) {
    error.value = err?.statusCode === 429 ? t('auth.tooMany') : t('auth.wrongCredentials')
    password.value = ''
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <div>
      <h1 class="text-xl font-semibold text-highlighted tracking-tight">{{ t('auth.signInTitle') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('auth.signInSubtitle', { site: productName }) }}</p>
    </div>
    <UFormField :label="t('auth.email')" name="email">
      <UInput v-model="email" type="email" autocomplete="username" autofocus required class="w-full" />
    </UFormField>
    <UFormField :label="t('auth.password')" name="password">
      <template #hint>
        <NuxtLink to="/admin/forgot" class="text-sm text-muted hover:text-highlighted">{{ t('auth.forgot') }}</NuxtLink>
      </template>
      <CmsPasswordInput v-model="password" autocomplete="current-password" />
    </UFormField>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />
    <UButton type="submit" block :loading="pending">{{ t('auth.signIn') }}</UButton>
  </form>
</template>
