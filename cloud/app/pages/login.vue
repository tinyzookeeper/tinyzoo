<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const t = useT()
const errorText = useErrorText()
const route = useRoute()
const { refresh } = useAccount()
useHead({ title: () => t('login.title') })

const form = reactive({ email: '', password: '' })
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: form })
    const account = await refresh()
    if (account.user) useLocaleCookie().value = account.user.locale
    const next = typeof route.query.next === 'string' && /^\/(?![/\\])/.test(route.query.next) ? route.query.next : '/sites'
    await navigateTo(next)
  }
  catch (err) {
    error.value = errorText(err, 'login.failed')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-8 text-center">
      <ZAnimal name="panda" class="mx-auto mb-5 h-20 w-auto" />
      <h1 class="z-display text-[1.75rem] leading-tight text-highlighted">{{ t('login.title') }}</h1>
      <p class="z-moment-text mt-1 text-[0.9375rem]">{{ t('login.lead') }}</p>
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField :label="t('auth.email')" name="email">
        <UInput v-model="form.email" type="email" size="lg" autocomplete="username" required autofocus class="w-full" data-field-email />
      </UFormField>
      <UFormField :label="t('auth.password')" name="password">
        <template #hint><NuxtLink to="/forgot" class="text-sm text-muted underline decoration-(--ui-border-accented) underline-offset-4 hover:text-highlighted">{{ t('login.forgot') }}</NuxtLink></template>
        <UInput v-model="form.password" type="password" size="lg" autocomplete="current-password" required class="w-full" data-field-password />
      </UFormField>
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
      <UButton type="submit" :label="t('login.submit')" block size="lg" :loading="busy" data-submit />
    </form>
    <p class="z-moment-text mt-6 text-center text-sm">
      {{ t('login.noAccount') }}
      <NuxtLink to="/new" class="font-medium text-highlighted underline decoration-(--ui-border-accented) underline-offset-4">{{ t('home.cta') }}</NuxtLink>
    </p>
  </div>
</template>
