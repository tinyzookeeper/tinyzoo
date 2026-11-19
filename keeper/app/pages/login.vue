<script setup lang="ts">
definePageMeta({ layout: 'bare' })
useHead({ title: 'Sign in · Keeper' })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const form = reactive({ email: '', password: '' })
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: form })
    await refreshSession()
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//') ? route.query.next : '/'
    await navigateTo(next)
  }
  catch (err) {
    error.value = errorMessage(err, 'Could not sign in.')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard :ui="{ body: 'p-6 sm:p-7' }">
    <h1 class="text-xl font-bold text-highlighted">Sign in</h1>
    <p class="mt-1 text-sm text-muted">Every site you look after, in one place.</p>

    <form class="mt-6 flex flex-col gap-4" @submit.prevent="submit">
      <UFormField label="Email" name="email">
        <UInput v-model="form.email" type="email" autocomplete="username" required autofocus class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password">
        <UInput v-model="form.password" type="password" autocomplete="current-password" required class="w-full" />
      </UFormField>
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
      <UButton type="submit" label="Sign in" block size="lg" :loading="busy" />
    </form>
  </UCard>
</template>
