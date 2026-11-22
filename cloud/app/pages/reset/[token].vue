<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const t = useT()
const errorText = useErrorText()
const route = useRoute()
const { refresh } = useAccount()
useHead({ title: () => t('reset.title') })

const token = String(route.params.token ?? '')
const { data: state } = await useFetch<{ valid: boolean }>('/api/auth/reset', { query: { token }, key: `reset-${token.slice(0, 8)}` })
const password = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/reset', { method: 'POST', body: { token, password: password.value } })
    await refresh()
    await navigateTo('/sites')
  }
  catch (err) {
    error.value = errorText(err)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-8 text-center">
      <ZAnimal :name="state?.valid ? 'owl' : 'snail'" class="mx-auto mb-5 h-20 w-auto" />
      <h1 class="z-display text-[1.75rem] leading-tight text-highlighted">{{ state?.valid ? t('reset.title') : t('reset.expiredTitle') }}</h1>
      <p class="z-moment-text mt-1 text-[0.9375rem] text-pretty">{{ state?.valid ? t('reset.lead') : t('reset.expiredText') }}</p>
    </div>
    <form v-if="state?.valid" class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField :label="t('reset.password')" name="password" :help="t('auth.passwordHelp')">
        <UInput v-model="password" type="password" size="lg" autocomplete="new-password" minlength="10" required autofocus class="w-full" data-field-password />
      </UFormField>
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
      <UButton type="submit" :label="t('reset.submit')" block size="lg" :loading="busy" :disabled="password.length < 10" data-submit />
    </form>
    <UButton v-else to="/forgot" :label="t('reset.again')" block size="lg" />
  </div>
</template>
