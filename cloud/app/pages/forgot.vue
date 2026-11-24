<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const t = useT()
const errorText = useErrorText()
useHead({ title: () => t('forgot.title') })

const email = ref('')
const busy = ref(false)
const error = ref('')
const sent = ref(false)
const devUrl = ref<string | null>(null)

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ devResetUrl: string | null }>('/api/auth/forgot', { method: 'POST', body: { email: email.value } })
    devUrl.value = res.devResetUrl
    sent.value = true
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
      <ZAnimal :name="sent ? 'bird' : 'owl'" class="mx-auto mb-5 h-20 w-auto" />
      <h1 class="z-display text-[1.75rem] leading-tight text-highlighted">{{ sent ? t('forgot.sentTitle') : t('forgot.title') }}</h1>
      <p class="z-moment-text mt-1 text-[0.9375rem] text-pretty">{{ sent ? t('forgot.sentText', { email }) : t('forgot.lead') }}</p>
    </div>

    <div v-if="sent" class="flex flex-col gap-4">
      <DevMailNote :url="devUrl" :label="t('forgot.open')" class="bg-(--z-surface)!" />
      <UButton to="/login" :label="t('forgot.back')" color="neutral" variant="outline" block size="lg" />
    </div>
    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField :label="t('auth.email')" name="email">
        <UInput v-model="email" type="email" size="lg" autocomplete="username" required autofocus class="w-full" data-field-email />
      </UFormField>
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
      <UButton type="submit" :label="t('forgot.submit')" block size="lg" :loading="busy" data-submit />
      <UButton to="/login" :label="t('forgot.back')" color="neutral" variant="ghost" block />
    </form>
  </div>
</template>
