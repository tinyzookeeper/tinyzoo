<script setup lang="ts">
// My password; my other sessions end when it changes.
const toast = useToast()
const pw = reactive({ current: '', next: '' })
const savingPw = ref(false)
async function changePassword() {
  savingPw.value = true
  try {
    await $fetch('/api/auth/password', { method: 'POST', body: { current: pw.current, next: pw.next } })
    pw.current = ''
    pw.next = ''
    toast.add({ title: 'Password changed', color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: 'Could not change the password', description: errorMessage(err), color: 'error' })
  }
  finally {
    savingPw.value = false
  }
}
</script>

<template>
  <InfoCard title="Your password">
    <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="changePassword">
      <UFormField label="Current password" name="current">
        <UInput v-model="pw.current" type="password" autocomplete="current-password" required class="w-full" />
      </UFormField>
      <UFormField label="New password" name="next" hint="At least 10 characters">
        <UInput v-model="pw.next" type="password" autocomplete="new-password" required minlength="10" class="w-full" />
      </UFormField>
      <div class="flex justify-end sm:col-span-2">
        <UButton type="submit" label="Change password" color="neutral" variant="outline" :loading="savingPw" />
      </div>
    </form>
  </InfoCard>
</template>
