<script setup lang="ts">
// Signed in, e-mail not confirmed yet: a calm note with a way to get the link again. In
// development the link itself is shown (e-mail is only printed there).
const t = useT()
const errorText = useErrorText()
const { account, user, refresh } = useAccount()
const toast = useToast()
const sending = ref(false)
async function resend() {
  sending.value = true
  try {
    await $fetch('/api/auth/verify-resend', { method: 'POST' })
    await refresh()
    toast.add({ title: t('verify.sent'), icon: 'i-lucide-check' })
  }
  catch (err) { toast.add({ title: errorText(err), color: 'error' }) }
  finally { sending.value = false }
}
</script>

<template>
  <div v-if="user && !user.emailVerified" class="z-note flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5" data-verify-note>
    <div class="min-w-0 flex-1">
      <p class="font-semibold text-highlighted">{{ t('verify.noteTitle') }}</p>
      <p class="z-moment-text mt-0.5 text-sm text-pretty">{{ t('verify.noteText', { email: user.email }) }}</p>
      <DevMailNote v-if="account.devVerifyUrl" class="mt-3 border-0! bg-(--z-surface)!" :url="account.devVerifyUrl" :label="t('verify.open')" />
    </div>
    <UButton :label="t('verify.resend')" color="neutral" variant="outline" icon="i-lucide-mail" class="shrink-0 self-start sm:self-center" :loading="sending" @click="resend" />
  </div>
</template>
