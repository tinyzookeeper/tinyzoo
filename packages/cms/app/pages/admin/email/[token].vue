<script setup lang="ts">
// The link from "confirm your new email": shows the new address and makes the change on
// a click (a POST — mail scanners open links, so opening the page changes nothing).
// Works signed in or not; a browser signed in to the same account stays signed in.
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
const { productName } = useCmsAdminHead()
const route = useRoute()
const { loggedIn, fetch: refreshSession } = useUserSession()
useHead({ title: () => t('auth.emailConfirmTabTitle') })

const token = computed(() => String(route.params.token ?? ''))
const { data: info, error: loadError } = await useFetch<{ email: string }>((): string => `/api/cms/_auth/email/${token.value}`)

type Outcome = 'done' | 'expired' | 'taken'
const outcome = ref<Outcome | null>(loadError.value ? 'expired' : null)
const changedTo = ref('')
const stillSignedIn = ref(false)
const pending = ref(false)
const formError = ref('')

async function confirmChange() {
  formError.value = ''
  pending.value = true
  try {
    const res = await $fetch<{ email: string; signedIn: boolean }>('/api/cms/_auth/email/confirm', { method: 'POST', body: { token: token.value } })
    changedTo.value = res.email
    stillSignedIn.value = res.signedIn
    // This browser's session now carries the new address (or, signed in elsewhere, was ended).
    if (loggedIn.value) await refreshSession()
    outcome.value = 'done'
  }
  catch (err: any) {
    const status = err?.statusCode ?? err?.status
    if (status === 410) outcome.value = 'expired'
    else if (status === 409) outcome.value = 'taken'
    else formError.value = cmsRequestError(err, t as any)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div v-if="outcome === 'done'" class="space-y-5">
    <div class="text-center">
      <h1 class="cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.emailConfirmedTitle') }}</h1>
      <p class="mt-1 text-sm text-muted text-pretty">{{ t('auth.emailConfirmedBody', { email: changedTo }) }}</p>
    </div>
    <UButton v-if="stillSignedIn" to="/admin" block>{{ t('auth.emailConfirmedContinue') }}</UButton>
    <UButton v-else to="/admin/login" block>{{ t('auth.emailConfirmedSignIn') }}</UButton>
  </div>
  <div v-else-if="outcome === 'taken'" class="space-y-3">
    <h1 class="text-center cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.emailTakenTitle') }}</h1>
    <p class="text-sm text-muted text-pretty">{{ t('auth.emailTakenBody', { email: info?.email ?? '' }) }}</p>
  </div>
  <div v-else-if="outcome === 'expired' || !info" class="space-y-3">
    <h1 class="text-center cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.linkExpiredTitle') }}</h1>
    <p class="text-sm text-muted text-pretty">{{ t('auth.emailLinkExpired') }}</p>
  </div>
  <form v-else method="post" class="space-y-5" novalidate @submit.prevent="confirmChange">
    <div class="text-center">
      <h1 class="cms-display text-[1.625rem] leading-tight text-highlighted">{{ t('auth.emailConfirmTitle') }}</h1>
      <p class="mt-1 text-sm text-muted text-pretty">{{ t('auth.emailConfirmBody', { site: productName, email: info.email }) }}</p>
    </div>
    <UAlert v-if="formError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="formError" role="alert" data-cms-error-summary />
    <UButton type="submit" block :loading="pending">{{ t('auth.emailConfirmAction') }}</UButton>
  </form>
</template>
