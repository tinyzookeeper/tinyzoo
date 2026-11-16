<script setup lang="ts">
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
useHead({ title: () => t('auth.forgotTitle') })

const email = ref('')
const sent = ref(false)
const error = ref('')
const pending = ref(false)

async function submit() {
  error.value = ''
  pending.value = true
  try {
    await $fetch('/api/cms/_auth/forgot', { method: 'POST', body: { email: email.value } })
    sent.value = true
  }
  catch (err: any) {
    error.value = err?.statusCode === 429 ? t('auth.tooMany') : cmsErrorMessage(err, t('team.actionFailed'))
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div v-if="sent" class="space-y-5" role="status">
    <div class="size-10 rounded-md border border-default grid place-items-center text-muted">
      <UIcon name="i-lucide-mail-check" class="size-5" />
    </div>
    <div class="text-center">
      <h1 class="cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.forgotSentTitle') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('auth.forgotSent', { email }) }}</p>
    </div>
    <UButton to="/admin/login" color="neutral" variant="outline" block>{{ t('auth.backToSignIn') }}</UButton>
  </div>
  <form v-else method="post" class="space-y-5" novalidate @submit.prevent="submit">
    <div class="text-center">
      <h1 class="cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.forgotTitle') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('auth.forgotSubtitle') }}</p>
    </div>
    <UFormField :label="t('auth.email')" name="email">
      <UInput v-model="email" type="email" autocomplete="email" autofocus class="w-full" />
    </UFormField>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" role="alert" />
    <UButton type="submit" block :loading="pending">{{ t('auth.sendLink') }}</UButton>
    <UButton to="/admin/login" color="neutral" variant="ghost" block>{{ t('auth.backToSignIn') }}</UButton>
  </form>
</template>
