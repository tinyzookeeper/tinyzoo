<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// The top bar: tinyzoo's logo, then (signed in) "My websites" and the account's menu, or
// (signed out) sign in and "Create your website" (where websites are made). The language and
// the colour mode are here on every page.
const t = useT()
const { user, signedIn, signOut, account } = useAccount()
const { locale, setLocale } = useLocale()
const colorMode = useColorMode()
const dark = computed(() => colorMode.value === 'dark')
const other = computed(() => (locale.value === 'cs' ? 'en' : 'cs'))
const toggleMode = () => { colorMode.preference = dark.value ? 'light' : 'dark' }
const initials = (text: string | undefined) => (text ?? '').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '·'

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? '', type: 'label' }],
  [
    { label: t('nav.sites'), icon: 'i-lucide-layout-grid', to: '/sites' },
    { label: t('nav.account'), icon: 'i-lucide-user-round', to: '/account' },
  ],
  [{ label: t('nav.signOut'), icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-(--ui-bg)/85 backdrop-blur">
    <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
      <NuxtLink :to="signedIn ? '/sites' : '/'" class="mr-auto flex items-center rounded-md py-1" :aria-label="t('nav.home')">
        <ZLogo />
      </NuxtLink>

      <UButton v-if="signedIn" to="/sites" :label="t('nav.sites')" color="neutral" variant="ghost" class="hidden sm:inline-flex" />

      <UButton color="neutral" variant="ghost" class="px-2 font-medium uppercase tabular" :aria-label="t('nav.language')" :title="t('nav.language')" data-locale-switch @click="setLocale(other)">
        {{ other }}
      </UButton>
      <ClientOnly>
        <UButton color="neutral" variant="ghost" square :icon="dark ? 'i-lucide-sun' : 'i-lucide-moon'" :aria-label="dark ? t('nav.light') : t('nav.dark')" :title="dark ? t('nav.light') : t('nav.dark')" @click="toggleMode" />
        <template #fallback><span class="size-8" /></template>
      </ClientOnly>

      <template v-if="signedIn">
        <UDropdownMenu :items="menu" :content="{ align: 'end' }" :ui="{ content: 'w-60' }">
          <UButton color="neutral" variant="ghost" class="gap-2 px-1.5" :aria-label="t('nav.accountMenu')" data-account-menu>
            <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-(--z-moment-strong) text-[0.6875rem] font-semibold text-highlighted">{{ initials(user?.name || user?.email) }}</span>
            <span class="hidden max-w-36 truncate text-sm font-medium text-highlighted md:block">{{ user?.name || user?.email }}</span>
            <UIcon name="i-lucide-chevron-down" class="hidden size-4 text-dimmed md:block" />
          </UButton>
        </UDropdownMenu>
      </template>
      <template v-else>
        <UButton to="/login" :label="t('nav.signIn')" color="neutral" variant="ghost" />
        <UButton v-if="account.canCreate" to="/new" :label="t('nav.create')" class="hidden sm:inline-flex" />
      </template>
    </div>
  </header>
</template>
