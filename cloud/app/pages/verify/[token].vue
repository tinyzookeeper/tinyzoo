<script setup lang="ts">
// The link from the confirmation e-mail. It confirms the address at once (in the browser, so
// a mail scanner that only fetches the page does not use the link up), then leads on: to the
// website that waited for it, to "My websites", or to signing in.
definePageMeta({ layout: 'bare' })
const t = useT()
const route = useRoute()
const { refresh, signedIn } = useAccount()
useHead({ title: () => t('verify.title') })

const token = String(route.params.token ?? '')
const state = ref<'working' | 'done' | 'expired'>('working')
const siteId = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await $fetch<{ siteId: string | null }>('/api/auth/verify', { method: 'POST', body: { token } })
    siteId.value = res.siteId
    await refresh()
    state.value = 'done'
    if (res.siteId) setTimeout(() => navigateTo(`/sites/${res.siteId}`), 1400)
  }
  catch {
    await refresh()
    state.value = 'expired'
  }
})
</script>

<template>
  <div class="text-center" :data-verify="state">
    <ZAnimal :name="state === 'expired' ? 'snail' : state === 'done' ? 'chick' : 'bird'" class="mx-auto mb-5 h-20 w-auto" />
    <template v-if="state === 'working'">
      <h1 class="z-display text-[1.75rem] leading-tight text-highlighted">{{ t('verify.working') }}</h1>
    </template>
    <template v-else-if="state === 'done'">
      <h1 class="z-display z-rise text-[1.75rem] leading-tight text-highlighted">{{ t('verify.doneTitle') }}</h1>
      <p class="z-moment-text z-rise z-rise-1 mt-1 text-[0.9375rem] text-pretty">{{ siteId ? t('verify.doneSite') : t('verify.doneText') }}</p>
      <UButton :to="siteId ? `/sites/${siteId}` : signedIn ? '/sites' : '/login'" :label="siteId ? t('verify.toSite') : signedIn ? t('nav.sites') : t('nav.signIn')" size="lg" class="z-rise z-rise-2 mt-6" data-continue />
    </template>
    <template v-else>
      <h1 class="z-display text-[1.75rem] leading-tight text-highlighted">{{ t('verify.expiredTitle') }}</h1>
      <p class="z-moment-text mt-1 text-[0.9375rem] text-pretty">{{ t('verify.expiredText') }}</p>
      <UButton :to="signedIn ? '/account' : '/login'" :label="signedIn ? t('nav.account') : t('nav.signIn')" size="lg" class="mt-6" />
    </template>
  </div>
</template>
