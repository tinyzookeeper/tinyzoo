<script setup lang="ts">
definePageMeta({ layout: 'bare' })
useHead({ title: 'Welcome · Keeper' })

const { data: state } = useAuthState()
const { fetch: refreshSession } = useUserSession()
const form = reactive({ name: '', email: '', password: '', workspace: '', token: '' })
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const { token, ...rest } = form
    await $fetch('/api/auth/setup', { method: 'POST', body: state.value?.needsToken ? { ...rest, token } : rest })
    await refreshSession()
    await navigateTo('/')
  }
  catch (err) {
    error.value = errorMessage(err, 'Could not finish the setup.')
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
      <h1 class="k-display text-[1.75rem] leading-tight text-highlighted">Welcome to Keeper</h1>
      <p class="k-moment__muted mt-1 text-[0.9375rem] text-(--k-moment-text)">Make the first account. Your team can join later.</p>
    </div>

    <form class="mt-6 flex flex-col gap-4" @submit.prevent="submit">
      <UFormField label="Your name" name="name">
        <UInput v-model="form.name" autocomplete="name" required autofocus class="w-full" />
      </UFormField>
      <UFormField label="Email" name="email">
        <UInput v-model="form.email" type="email" autocomplete="username" required class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password" hint="At least 10 characters">
        <UInput v-model="form.password" type="password" autocomplete="new-password" required minlength="10" class="w-full" />
      </UFormField>
      <UFormField label="Team name" name="workspace" description="Usually your studio or company.">
        <UInput v-model="form.workspace" required class="w-full" />
      </UFormField>
      <UFormField v-if="state?.needsToken" label="Setup token" name="token" description="The value of NUXT_SETUP_TOKEN on this server.">
        <UInput v-model="form.token" type="password" required class="w-full" />
      </UFormField>
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
      <UButton type="submit" label="Create account" block size="lg" :loading="busy" />
    </form>
  </div>
</template>
