<script setup lang="ts">
// An account without a website: for somebody who was invited to another person's website and
// came here from its sign-in. A website links a person by a CONFIRMED e-mail only, so after the
// account is made the page waits for the confirmation before it goes back to the website.
definePageMeta({ layout: 'bare' })
const t = useT()
const errorText = useErrorText()
const { locale } = useLocale()
const { account, user, refresh } = useAccount()
const { fromSite, go, site, loadSite, withNext } = useReturn()
useHead({ title: () => t('signup.title') })
await loadSite()

const form = reactive({ name: '', email: '', password: '' })
const busy = ref(false)
const error = ref('')
// Signed in and not confirmed yet (just made, or the page was opened again): the waiting step.
const waiting = computed(() => !!user.value && !user.value.emailVerified)
const notYet = ref(false)

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/signup', { method: 'POST', body: { name: form.name.trim(), email: form.email.trim(), password: form.password, locale: locale.value } })
    await refresh()
    // Nowhere to go back to: the account's own pages work without the confirmation.
    if (!fromSite.value) await go()
  }
  catch (err) {
    error.value = errorText(err, 'signup.failed')
  }
  finally {
    busy.value = false
  }
}

async function proceed() {
  busy.value = true
  try {
    await refresh()
    notYet.value = !user.value?.emailVerified
    if (!notYet.value) await go()
  }
  finally {
    busy.value = false
  }
}

// The link is usually opened in another tab: go on by itself once the address is confirmed.
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(async () => {
    if (!waiting.value || busy.value) return
    await refresh()
    if (user.value?.emailVerified) await go()
  }, 3000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div>
    <template v-if="waiting && user">
      <div class="text-center" data-signup-confirm>
        <ZAnimal name="bird" class="mx-auto mb-5 h-20 w-auto" />
        <h1 class="z-display text-[1.75rem] leading-tight text-highlighted">{{ t('signup.confirmTitle') }}</h1>
        <p class="z-moment-text mt-1 text-[0.9375rem] text-pretty">{{ t('signup.confirmText', { email: user.email }) }}</p>
      </div>
      <DevMailNote class="mt-6 bg-(--z-surface)!" :url="account.devVerifyUrl" :label="t('verify.open')" />
      <UAlert v-if="notYet" class="mt-4" color="neutral" variant="soft" icon="i-lucide-mail" :description="t('signup.notYet')" />
      <UButton :label="t('signup.continue')" block size="lg" class="mt-6" :loading="busy" trailing-icon="i-lucide-arrow-right" data-continue @click="proceed" />
    </template>

    <template v-else>
      <div class="mb-8 text-center">
        <ZAnimal name="chick" class="mx-auto mb-5 h-20 w-auto" />
        <h1 class="z-display text-[1.75rem] leading-tight text-highlighted">{{ t('signup.title') }}</h1>
        <p class="z-moment-text mt-1 text-[0.9375rem] text-pretty">{{ site ? t('signup.leadSite', { name: site.name }) : t('signup.lead') }}</p>
      </div>
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <UFormField :label="t('auth.name')" name="name">
          <UInput v-model="form.name" size="lg" autocomplete="name" maxlength="100" required autofocus class="w-full" data-field-name />
        </UFormField>
        <UFormField :label="t('auth.email')" name="email">
          <UInput v-model="form.email" type="email" size="lg" autocomplete="username" required class="w-full" data-field-email />
        </UFormField>
        <UFormField :label="t('auth.password')" name="password" :help="t('auth.passwordHelp')">
          <UInput v-model="form.password" type="password" size="lg" autocomplete="new-password" minlength="10" maxlength="200" required class="w-full" data-field-password />
        </UFormField>
        <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
        <UButton type="submit" :label="t('signup.submit')" block size="lg" :loading="busy" data-submit />
      </form>
      <p class="z-moment-text mt-6 text-center text-sm">
        {{ t('signup.haveAccount') }}
        <NuxtLink :to="withNext('/login')" class="font-medium text-highlighted underline decoration-(--ui-border-accented) underline-offset-4">{{ t('nav.signIn') }}</NuxtLink>
      </p>
    </template>
  </div>
</template>
