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
    await refreshMe()
    const next = typeof route.query.next === 'string' && /^\/(?![/\\])/.test(route.query.next) ? route.query.next : '/'
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
  <div>
    <div class="mb-8 text-center">
      <KMark class="mx-auto mb-6 h-20" />
      <h1 class="k-display text-[1.75rem] leading-tight text-highlighted">Welcome back</h1>
      <p class="mt-1 text-[0.9375rem] text-(--k-moment-text)">Every site you look after, in one place.</p>
    </div>

    <form class="mt-6 flex flex-col gap-4" @submit.prevent="submit">
      <UFormField label="E-mail" name="email">
        <UInput v-model="form.email" type="email" autocomplete="username" required autofocus class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password">
        <UInput v-model="form.password" type="password" autocomplete="current-password" required class="w-full" />
      </UFormField>
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
      <UButton type="submit" label="Sign in" block size="lg" :loading="busy" />
    </form>
  </div>
</template>
