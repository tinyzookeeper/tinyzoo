<script setup lang="ts">
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
const { productName } = useCmsAdminHead()
useHead({ title: () => t('auth.signInTitle') })

// A fresh install has no accounts yet: go create the first one instead.
const { data: status } = await useFetch<{ needsSetup: boolean }>('/api/cms/_auth/status')
if (status.value?.needsSetup) await navigateTo('/admin/setup', { replace: true })

const route = useRoute()
const signedIn = useCmsSignedIn()
const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)
const formEl = ref<HTMLElement | null>(null)
// A public demo (cms.demo): its sign-in details are shown, and one click fills them in.
const demo = useRuntimeConfig().public.cmsDemo as { email?: string; password?: string } | undefined
const showDemo = computed(() => !!demo?.email && !!demo?.password)
function signInToDemo() {
  email.value = demo?.email ?? ''
  password.value = demo?.password ?? ''
  submit()
}

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
    // The cursor goes back to the (emptied) password, which the message is about.
    await nextTick()
    const field = formEl.value?.querySelector<HTMLInputElement>('input[autocomplete="current-password"]')
    field?.focus()
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <form ref="formEl" class="space-y-5" novalidate @submit.prevent="submit">
    <div class="text-center">
      <h1 class="cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.signInTitle') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('auth.signInSubtitle', { site: productName }) }}</p>
    </div>
    <!-- the admin was open when the account stopped working: say why we are here -->
    <UAlert
      v-if="route.query.reason === 'signedOut'" color="neutral" variant="subtle" icon="i-lucide-log-out" role="status"
      :title="t('auth.signedOutTitle')" :description="t('auth.signedOutBody')"
    />
    <div v-if="showDemo" class="rounded-(--ui-radius) bg-elevated/60 px-4 py-3 text-sm">
      <p class="font-medium text-highlighted">{{ t('auth.demoTitle') }}</p>
      <p class="mt-1 text-muted">{{ t('auth.demoBody') }}</p>
      <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt class="text-muted">{{ t('auth.email') }}</dt><dd class="font-mono text-highlighted break-all">{{ demo!.email }}</dd>
        <dt class="text-muted">{{ t('auth.password') }}</dt><dd class="font-mono text-highlighted break-all">{{ demo!.password }}</dd>
      </dl>
      <UButton class="mt-3" color="neutral" variant="outline" size="sm" icon="i-lucide-log-in" :loading="pending" @click="signInToDemo">{{ t('auth.demoSignIn') }}</UButton>
    </div>
    <UFormField :label="t('auth.email')" name="email">
      <UInput v-model="email" type="email" autocomplete="username" autofocus required class="w-full" />
    </UFormField>
    <!-- `error` as a bare true marks the field (aria-invalid, red ring); the sentence is the live region below -->
    <UFormField :label="t('auth.password')" name="password" :error="error ? true : undefined">
      <template #hint>
        <NuxtLink to="/admin/forgot" class="text-sm text-toned underline-offset-2 hover:underline hover:text-highlighted">{{ t('auth.forgot') }}</NuxtLink>
      </template>
      <CmsPasswordInput v-model="password" autocomplete="current-password" />
    </UFormField>
    <!-- always there (a live region must exist before it speaks) and always that tall: a wrong password does not push the button down -->
    <p id="login-error" role="alert" class="-mt-2 flex min-h-[2.75rem] items-start gap-2 text-sm text-error">
      <template v-if="error"><UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{{ error }}</span></template>
    </p>
    <UButton type="submit" block :loading="pending">{{ t('auth.signIn') }}</UButton>
  </form>
</template>
