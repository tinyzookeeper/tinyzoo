<script setup lang="ts">
// My account: name, language, password, and whether the e-mail is confirmed.
const t = useT()
const errorText = useErrorText()
const { user, refresh, signOut } = useAccount()
const { locale, setLocale } = useLocale()
const toast = useToast()
useHead({ title: () => t('account.title') })

const name = ref(user.value?.name ?? '')
const savingName = ref(false)
async function saveName() {
  savingName.value = true
  try {
    await $fetch('/api/account', { method: 'PATCH', body: { name: name.value } })
    await refresh()
    toast.add({ title: t('account.saved'), icon: 'i-lucide-check' })
  }
  catch (err) { toast.add({ title: errorText(err), color: 'error' }) }
  finally { savingName.value = false }
}

const pw = reactive({ current: '', next: '' })
const savingPw = ref(false)
const pwError = ref('')
async function savePassword() {
  savingPw.value = true
  pwError.value = ''
  try {
    await $fetch('/api/account/password', { method: 'POST', body: pw })
    pw.current = ''
    pw.next = ''
    toast.add({ title: t('account.passwordSaved'), icon: 'i-lucide-check' })
  }
  catch (err) { pwError.value = errorText(err) }
  finally { savingPw.value = false }
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
    <h1 class="z-display text-[1.75rem] leading-tight text-highlighted sm:text-4xl">{{ t('account.title') }}</h1>
    <p class="mt-1.5 text-[0.9375rem] text-muted">{{ user?.email }}</p>

    <VerifyNote class="mt-6" />

    <div class="mt-8 flex flex-col gap-8">
      <InfoCard :title="t('account.you')">
        <form class="flex flex-col gap-4 sm:flex-row sm:items-end" @submit.prevent="saveName">
          <UFormField :label="t('auth.name')" name="name" class="flex-1">
            <UInput v-model="name" size="lg" autocomplete="name" maxlength="100" required class="w-full" />
          </UFormField>
          <UButton type="submit" :label="t('common.save')" size="lg" :loading="savingName" :disabled="!name.trim() || name.trim() === user?.name" />
        </form>
        <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-default pt-5">
          <div>
            <p class="text-sm font-medium text-highlighted">{{ t('account.language') }}</p>
            <p class="text-sm text-muted">{{ t('account.languageHelp') }}</p>
          </div>
          <div class="inline-flex rounded-lg bg-(--ui-bg-elevated) p-1" role="radiogroup" :aria-label="t('account.language')">
            <button v-for="l in LOCALES" :key="l.code" type="button" role="radio" :aria-checked="locale === l.code" class="rounded-md px-3 py-1.5 text-sm" :class="locale === l.code ? 'bg-(--z-surface) font-medium text-highlighted shadow-sm' : 'text-toned'" @click="setLocale(l.code)">{{ l.label }}</button>
          </div>
        </div>
      </InfoCard>

      <InfoCard :title="t('account.passwordTitle')">
        <form class="flex flex-col gap-4" @submit.prevent="savePassword">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('account.currentPassword')" name="current">
              <UInput v-model="pw.current" type="password" size="lg" autocomplete="current-password" required class="w-full" />
            </UFormField>
            <UFormField :label="t('account.newPassword')" name="next" :help="t('auth.passwordHelp')">
              <UInput v-model="pw.next" type="password" size="lg" autocomplete="new-password" minlength="10" required class="w-full" />
            </UFormField>
          </div>
          <UAlert v-if="pwError" color="error" variant="soft" icon="i-lucide-circle-alert" :description="pwError" />
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-muted">{{ t('account.passwordNote') }}</p>
            <UButton type="submit" :label="t('account.changePassword')" size="lg" :loading="savingPw" :disabled="!pw.current || pw.next.length < 10" class="shrink-0" />
          </div>
        </form>
      </InfoCard>

      <div class="flex justify-end">
        <UButton :label="t('nav.signOut')" color="neutral" variant="outline" icon="i-lucide-log-out" @click="signOut" />
      </div>
    </div>
  </div>
</template>
