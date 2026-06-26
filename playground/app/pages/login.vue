<script setup lang="ts">
definePageMeta({ layout: false })

const { fetch: refreshSession, loggedIn } = useUserSession()
const router = useRouter()

const email = ref('admin@demo.test')
const password = ref('admin')
const error = ref('')
const loading = ref(false)

watchEffect(() => { if (loggedIn.value) router.push('/admin') })

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/_cms/login', { method: 'POST', body: { email: email.value, password: password.value } })
    await refreshSession()
    await router.push('/admin')
  } catch {
    error.value = 'Invalid email or password.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-muted/30 p-4">
    <div class="w-full max-w-sm">
      <div class="flex items-center justify-center gap-2 mb-8">
        <div class="size-9 rounded-xl bg-primary flex items-center justify-center text-inverted font-bold">C</div>
        <span class="text-xl font-bold">my-cms</span>
      </div>

      <UCard>
        <div class="mb-5">
          <h1 class="text-lg font-semibold">Sign in</h1>
          <p class="text-sm text-muted">Welcome back — manage your content.</p>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
          <UFormField label="Email" name="email">
            <UInput v-model="email" type="email" icon="i-lucide-mail" placeholder="you@example.com" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Password" name="password">
            <UInput v-model="password" type="password" icon="i-lucide-lock" placeholder="••••••••" class="w-full" />
          </UFormField>

          <UAlert v-if="error" color="error" variant="soft" :description="error" icon="i-lucide-triangle-alert" />

          <UButton type="submit" block :loading="loading" size="lg">Sign in</UButton>
        </form>
      </UCard>

      <div class="mt-4 rounded-lg border border-default bg-elevated/40 p-3 text-xs text-muted">
        <p class="font-medium text-default mb-1">Demo accounts</p>
        <p><code>admin@demo.test</code> / <code>admin</code> — full access</p>
        <p><code>editor@demo.test</code> / <code>editor</code> — can only edit own posts</p>
      </div>
    </div>
  </div>
</template>
