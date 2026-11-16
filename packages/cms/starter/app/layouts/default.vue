<script setup lang="ts">
const { locale, settings, nav } = await useSite()
const languages = await useLanguageSwitch()
// A link the editor picked from the pages leads to the page's address; the home page is / here, not /home.
const menu = (links: { url: string | null }[] | null | undefined) => (links ?? []).map((l) => ({ ...l, url: l.url ? siteHref(l.url) : l.url }))
const home = computed(() => (locale.value === 'en' ? '/en' : '/'))
// A long menu (more than five links) gets a row of its own under the logo instead of squeezing the header.
const wide = computed(() => (nav.value?.main ?? []).filter((l: any) => !l.sub).length > 5)
// Phones: the menu folds behind a button; it closes again on every page change.
const menuOpen = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { menuOpen.value = false })
useHead({ htmlAttrs: { lang: locale } })
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header class="border-b border-default">
      <div class="site-header relative mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4" :class="wide ? 'site-header--wide' : ''">
        <NuxtLink :to="home" class="flex items-center gap-2 font-semibold">
          <CmsImage v-if="settings?.logo" :media="settings.logo" class="h-8 w-auto" eager />
          <span>{{ settings?.siteName ?? 'Web' }}</span>
        </NuxtLink>
        <div class="ml-auto flex items-center gap-1 sm:order-last sm:ml-0">
          <nav v-if="languages.length > 1" class="flex items-center text-sm" :aria-label="locale === 'en' ? 'Language' : 'Jazyk'">
            <NuxtLink
              v-for="l in languages" :key="l.code" :to="l.href" :lang="l.code" :hreflang="l.code" :title="l.label"
              class="grid min-h-11 min-w-9 place-items-center px-1.5 font-medium uppercase" :class="l.current ? 'text-highlighted underline underline-offset-4' : 'text-muted hover:text-highlighted'"
              :aria-current="l.current ? 'true' : undefined"
            >
              {{ l.code }}
              <span class="sr-only"> — {{ l.label }}</span>
            </NuxtLink>
          </nav>
          <NuxtLink :to="locale === 'en' ? '/en/search' : '/hledat'" class="grid size-11 place-items-center" :aria-label="locale === 'en' ? 'Search' : 'Hledat'">
            <UIcon name="i-lucide-search" class="size-5" />
          </NuxtLink>
        </div>
        <button
          type="button" class="site-menu-button sm:hidden" :aria-expanded="menuOpen" aria-controls="site-nav"
          @click="menuOpen = !menuOpen"
        >
          <UIcon :name="menuOpen ? 'i-lucide-x' : 'i-lucide-menu'" class="size-6" />
          <span class="sr-only">{{ locale === 'en' ? 'Menu' : 'Menu' }}</span>
        </button>
        <CmsNav id="site-nav" :links="menu(nav?.main)" class="site-nav sm:ml-auto" :class="menuOpen ? 'site-nav--open' : ''" :aria-label="locale === 'en' ? 'Main menu' : 'Hlavní menu'" />
      </div>
    </header>
    <main class="flex-1">
      <slot />
    </main>
    <footer class="border-t border-default bg-muted/40">
      <div class="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:grid-cols-3 text-sm">
        <div>
          <p class="font-semibold">{{ settings?.siteName }}</p>
          <p v-if="settings?.tagline" class="text-muted">{{ settings.tagline }}</p>
        </div>
        <div v-if="settings?.email || settings?.phone || settings?.address" class="space-y-1">
          <p v-if="settings?.address" class="whitespace-pre-line">{{ settings.address }}</p>
          <p v-if="settings?.phone"><a :href="`tel:${settings.phone}`">{{ settings.phone }}</a></p>
          <p v-if="settings?.email"><a :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
        </div>
        <dl v-if="settings?.openingHours?.length" class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <template v-for="h in settings.openingHours" :key="h.id">
            <dt class="text-muted">{{ h.days }}</dt><dd>{{ h.hours }}</dd>
          </template>
        </dl>
        <CmsNav :links="menu(nav?.footer)" class="site-nav-footer sm:col-span-3" :aria-label="locale === 'en' ? 'Footer menu' : 'Menu v patičce'" />
      </div>
    </footer>
  </div>
</template>

<style>
/* Desktop: links in a row, a link's dropdown opens on hover or keyboard focus. */
.site-nav > ul { display: flex; gap: 0.25rem 1.25rem; flex-wrap: wrap; justify-content: flex-end; }
.site-nav li { position: relative; }
.site-nav .cms-nav__has-children > a::after, .site-nav .cms-nav__has-children > span::after { content: ""; display: inline-block; width: 0.4em; height: 0.4em; margin-left: 0.4em; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-0.2em) rotate(45deg); }
.site-nav li ul { display: none; position: absolute; top: 100%; right: 0; z-index: 10; min-width: 12rem; padding: 0.5rem 0; background: var(--ui-bg); border: 1px solid var(--ui-border); border-radius: 0.5rem; box-shadow: 0 8px 24px rgb(0 0 0 / 0.08); }
.site-nav li:hover > ul, .site-nav li:focus-within > ul { display: block; }
.site-nav li ul a { display: block; padding: 0.375rem 1rem; }
.site-nav-footer > ul { display: flex; gap: 1rem 2.5rem; flex-wrap: wrap; align-items: flex-start; }
/* A footer link with sub-links is a small column: the link as its heading, the others under it. */
.site-nav-footer li ul { margin-top: 0.375rem; display: grid; gap: 0.25rem; }
.site-nav-footer li ul a { color: var(--ui-text-muted); }
.site-nav-footer li ul a:hover { color: var(--ui-text-highlighted); }
.site-nav-footer .cms-nav__has-children > a, .site-nav-footer .cms-nav__has-children > span { font-weight: 600; }

/* Many links: the menu gets its own row under the logo and wraps there (dropdowns open from its left edge). */
@media (min-width: 640px) {
  .site-header--wide .site-nav { order: 10000; flex-basis: 100%; margin-left: 0; }
  .site-header--wide .site-nav > ul { justify-content: flex-start; }
  .site-header--wide .site-nav li ul { right: auto; left: 0; }
}

/* Phones: one column behind the menu button, dropdown links shown under their parent. */
@media (max-width: 639px) {
  .site-menu-button { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; margin: -0.5rem; }
  .site-nav { display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 20; background: var(--ui-bg); border-bottom: 1px solid var(--ui-border); padding: 0.5rem 1rem 1rem; }
  .site-nav--open { display: block; }
  .site-nav > ul { flex-direction: column; gap: 0; }
  .site-nav a { display: block; padding: 0.75rem 0; }
  .site-nav .cms-nav__has-children > a::after, .site-nav .cms-nav__has-children > span::after { display: none; }
  .site-nav li ul { display: block; position: static; min-width: 0; padding: 0 0 0 1rem; border: 0; box-shadow: none; background: none; }
}
</style>
