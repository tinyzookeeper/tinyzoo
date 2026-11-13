<script setup lang="ts">
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
const { productName } = useCmsAdminHead()
useHead({ title: () => t('auth.setupTitle') })

const { data: status } = await useFetch<{ needsSetup: boolean; needsToken?: boolean }>('/api/cms/_auth/status')
if (status.value && !status.value.needsSetup) await navigateTo('/admin/login', { replace: true })

const signedIn = useCmsSignedIn()
// The deploy's setup code, when it has one: from the link (?token=) or typed in.
const route = useRoute()
const linkToken = typeof route.query.token === 'string' ? route.query.token : ''
const form = reactive({ name: '', email: '', password: '', token: linkToken })
const askToken = computed(() => !!status.value?.needsToken && !linkToken)
const errors = reactive<Record<string, string>>({})
const error = ref('')
const pending = ref(false)

async function submit() {
  error.value = ''
  Object.keys(errors).forEach((k) => delete errors[k])
  pending.value = true
  try {
    const res = await $fetch<{ user: any }>('/api/cms/_auth/setup', { method: 'POST', body: { ...form, token: form.token || undefined } })
    await signedIn(res.user)
  }
  catch (err: any) {
    const issues = err?.data?.data
    if (Array.isArray(issues)) {
      for (const i of issues) if (i.path?.[0]) errors[i.path[0]] = i.message
    }
    else if (err?.data?.data?.code === 'setup_token') {
      errors.token = t('auth.setupTokenWrong')
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
      <!-- First run: the whole family says hello. -->
      <div class="-mt-1 mb-5 flex items-end gap-1.5" aria-hidden="true">
        <img v-for="c in cmsCharacters.bright" :key="c.name" :src="c.url" alt="" class="h-7 w-auto" draggable="false">
      </div>
      <p class="text-xs font-medium text-muted">{{ t('auth.setupWelcome') }}</p>
      <h1 class="mt-1 text-xl font-semibold text-highlighted tracking-tight">{{ t('auth.setupTitle') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('auth.setupSubtitle', { site: productName }) }}</p>
    </div>
    <UFormField v-if="askToken" :label="t('auth.setupToken')" name="token" :description="t('auth.setupTokenHint')" :error="errors.token">
      <UInput v-model="form.token" autocomplete="off" class="w-full" />
    </UFormField>
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
