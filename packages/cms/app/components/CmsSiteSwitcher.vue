<script setup lang="ts">
// The site's name at the top of the menu. On a site where people sign in with the tinyzoo
// account, and for someone who has other websites there, it is a menu: their websites (name,
// their role there, the current one checked) and "All my websites". For everybody else it
// is what it always was: the brand, linking to the admin's home.
//
// The list is asked after the page is shown (the admin's layout, useCmsAccountSites). Until it has arrived, and
// when it holds no other website, the brand is drawn exactly as before; when it turns into
// a button the brand stays where it was (the button's padding is taken back by its margin)
// and only the arrows appear at the far end.
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{ collapsed?: boolean; enabled?: boolean }>()
const { t } = useCmsI18n()
// The admin's layout asks for the list once the page is shown; this only draws it.
const { state, others } = useCmsAccountSites()

const isMenu = computed(() => !!props.enabled && others.value.length > 0)
const roleName = (role: string) => (role === 'admin' || role === 'editor' || role === 'author' ? t(`roles.${role}.name`) : role)
const go = (address: string) => { window.location.assign(address) }

const items = computed<DropdownMenuItem[][]>(() => [
  [
    { type: 'label', label: t('sites.yours') } as DropdownMenuItem,
    // The current website is the checked one of the list; choosing another goes there.
    ...state.value.sites.map((site) => ({
      label: site.name,
      description: roleName(site.role) || undefined,
      type: 'checkbox' as const,
      checked: site.current,
      onSelect: () => { if (!site.current) go(cmsAccountSiteAddress(site.url)) },
    })),
  ],
  ...(state.value.account ? [[{ label: t('sites.all'), icon: 'i-lucide-layout-grid', onSelect: () => go(state.value.account!) } as DropdownMenuItem]] : []),
])
</script>

<template>
  <UDropdownMenu
    v-if="isMenu" :items="items"
    :content="{ align: 'start', side: collapsed ? 'right' : 'bottom', collisionPadding: 12 }"
    :ui="{ content: 'min-w-60 max-w-[calc(100vw-1.5rem)]', itemLabel: 'truncate', itemDescription: 'text-xs' }"
  >
    <button
      type="button" data-cms-site-switch
      class="flex items-center gap-2 min-w-0 rounded-md text-left cursor-pointer hover:bg-elevated/60 data-[state=open]:bg-elevated/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-primary)"
      :class="collapsed ? 'mx-auto p-1 -my-1' : 'flex-1 -mx-1.5 px-1.5 py-1 -my-1'"
    >
      <CmsBrandLogo :room="collapsed ? 'compact' : 'wide'" />
      <span class="sr-only">{{ t('sites.switch') }}</span>
      <UIcon v-if="!collapsed" name="i-lucide-chevrons-up-down" class="ml-auto size-4 shrink-0 text-dimmed" aria-hidden="true" />
    </button>
  </UDropdownMenu>
  <NuxtLink v-else to="/admin" class="flex items-center min-w-0 rounded-md" :class="collapsed ? 'mx-auto' : ''">
    <CmsBrandLogo :room="collapsed ? 'compact' : 'wide'" />
  </NuxtLink>
</template>
