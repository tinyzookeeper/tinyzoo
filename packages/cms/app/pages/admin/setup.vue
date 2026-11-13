<script setup lang="ts">
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
const { productName } = useCmsAdminHead()
useHead({ title: () => t('auth.setupTitle') })

const { data: status } = await useFetch<{ needsSetup: boolean }>('/api/cms/_auth/status')
if (status.value && !status.value.needsSetup) await navigateTo('/admin/login', { replace: true })

const signedIn = useCmsSignedIn()
const form = reactive({ name: '', email: '', password: '' })
const errors = reactive<Record<string, string>>({})
const error = ref('')
const pending = ref(false)

async function submit() {
  error.value = ''
  Object.keys(errors).forEach((k) => delete errors[k])
  pending.value = true
  try {
    const res = await $fetch<{ user: any }>('/api/cms/_auth/setup', { method: 'POST', body: form })
    await signedIn(res.user)
  }
  catch (err: any) {
    const issues = err?.data?.data
    if (Array.isArray(issues)) {
      for (const i of issues) if (i.path?.[0]) errors[i.path[0]] = i.message
    }
    else {
      error.value = cmsErrorMessage(err, t('team.actionFailed'))
    }
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <div>
      <h1 class="text-xl font-semibold text-highlighted tracking-tight">{{ t('auth.setupTitle') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('auth.setupSubtitle', { site: productName }) }}</p>
    </div>
    <UFormField :label="t('auth.name')" name="name" :error="errors.name">
      <UInput v-model="form.name" autocomplete="name" autofocus class="w-full" />
    </UFormField>
    <UFormField :label="t('auth.email')" name="email" :error="errors.email">
      <UInput v-model="form.email" type="email" autocomplete="email" class="w-full" />
    </UFormField>
    <UFormField :label="t('auth.password')" name="password" :description="t('auth.passwordHint')" :error="errors.password">
      <CmsPasswordInput v-model="form.password" autocomplete="new-password" />
    </UFormField>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />
    <UButton type="submit" block :loading="pending">{{ t('auth.createAccount') }}</UButton>
  </form>
</template>
