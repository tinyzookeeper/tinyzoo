<script setup lang="ts">
import { DESIGN_SYSTEM_SEGMENT, LANGS, LANG_NAMES, SEARCH_SEGMENT, localePath, type Lang } from '~/lib/site-i18n'

const { settings, nav } = await useSite()
const { lang, t, to } = useLang()
// schema.org: the site is in three languages; each page says which one it is in.
useSchemaOrg([
  defineWebSite({ inLanguage: [...LANGS] }),
  defineWebPage({ inLanguage: () => lang.value }),
])
// The language switcher: the same page in each language when it exists, else that language's home.
const alternates = useAlternates()
const langLink = (l: Lang) => alternates.value[l] ?? localePath('/', l)
const langMenu = ref<HTMLDetailsElement>()
// Phones: the menu folds behind a button; it closes again on every page change.
const menuOpen = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { menuOpen.value = false; if (langMenu.value) langMenu.value.open = false })
// The bar turns solid once the page scrolls under it.
const scrolled = ref(false)
onMounted(() => {
  const on = () => { scrolled.value = window.scrollY > 8 }
  on()
  window.addEventListener('scroll', on, { passive: true })
  onBeforeUnmount(() => window.removeEventListener('scroll', on))
})
// Search opens in a palette over the page; the link itself leads to the full search
// page (without JavaScript, or opened in a new tab).
const searchOpen = ref(false)
function openSearch(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  searchOpen.value = true
}
const year = new Date().getFullYear()
// The logo on the home page itself: glide back to the top instead of doing nothing.
function logoClick(e: MouseEvent) {
  // The click a long press ends with (see below) does not also go home.
  if (logoPressed) { e.preventDefault(); logoPressed = false; return }
  if (route.path.replace(/\/$/, '') !== to('/').replace(/\/$/, '') || e.metaKey || e.ctrlKey || e.shiftKey) return
  e.preventDefault()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}
// Right-clicking the logo opens the admin's design system (brand, colours, components)
// instead of the browser's menu. On a phone it's a long press: Android sends a contextmenu
// for it, iOS doesn't, so a held touch counts too.
function openDesignSystem(e?: Event) {
  e?.preventDefault()
  navigateTo(to(`/${DESIGN_SYSTEM_SEGMENT[lang.value]}`))
}
let logoPressed = false
let logoTimer: ReturnType<typeof setTimeout> | undefined
function logoTouchStart() {
  logoPressed = false
  clearTimeout(logoTimer)
  logoTimer = setTimeout(() => { logoPressed = true; openDesignSystem() }, 500)
}
function logoTouchEnd() { clearTimeout(logoTimer) }
onBeforeUnmount(() => clearTimeout(logoTimer))
</script>

<template>
  <div class="site min-h-dvh flex flex-col">
    <a href="#obsah" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-dark">{{ t('skipToContent') }}</a>
    <header class="site-bar sticky top-0 z-40" :class="[scrolled || menuOpen ? 'site-bar--solid' : '', menuOpen ? 'site-bar--open' : '']">
      <div class="wrap relative flex h-16 items-center justify-between gap-6 sm:h-[4.5rem]">
        <NuxtLink
          :to="to('/')" class="site-logo flex min-h-11 shrink-0 items-center" :aria-label="t('homeLabel')"
          @click="logoClick" @contextmenu="openDesignSystem"
          @touchstart.passive="logoTouchStart" @touchend="logoTouchEnd" @touchmove.passive="logoTouchEnd" @touchcancel="logoTouchEnd"
        >
          <img src="/brand/logo-primary.svg" alt="tinyzoo" class="h-7 w-auto sm:h-8" width="140" height="32" draggable="false">
        </NuxtLink>
        <CmsNav id="site-nav" :links="nav?.main" class="site-nav" :class="menuOpen ? 'site-nav--open' : ''" :aria-label="t('mainMenu')" />
        <div class="flex items-center gap-1 sm:gap-2">
          <a
            :href="to(`/${SEARCH_SEGMENT[lang]}`)" class="site-search" :aria-label="t('search')" :title="`${t('search')} (⌘K)`"
            aria-haspopup="dialog" @click="openSearch"
          >
            <UIcon name="i-lucide-search" class="size-5" />
          </a>
          <details ref="langMenu" class="lang">
            <summary :aria-label="`${t('language')}: ${LANG_NAMES[lang]}`">{{ lang.toUpperCase() }}<UIcon name="i-lucide-chevron-down" class="size-3.5" /></summary>
            <ul>
              <li v-for="l in LANGS" :key="l">
                <NuxtLink :to="langLink(l)" :hreflang="l" :lang="l" :aria-current="l === lang ? 'true' : undefined" :class="l === lang ? 'lang-on' : ''">
                  <span class="lang-code">{{ l.toUpperCase() }}</span>{{ LANG_NAMES[l] }}
                </NuxtLink>
              </li>
            </ul>
          </details>
          <NuxtLink :to="to(t('demoPath'))" class="site-cta btn btn-dark !min-h-10 !px-4 text-sm">{{ t('tryAdmin') }}</NuxtLink>
          <button
            type="button" class="site-menu-button" :aria-expanded="menuOpen" aria-controls="site-nav"
            @click="menuOpen = !menuOpen"
          >
            <UIcon :name="menuOpen ? 'i-lucide-x' : 'i-lucide-menu'" class="size-6" />
            <span class="sr-only">{{ t('menu') }}</span>
          </button>
        </div>
      </div>
    </header>

    <SearchPalette v-model:open="searchOpen" />

    <main id="obsah" class="flex-1">
      <slot />
    </main>

    <footer class="bg-night text-cream">
      <div class="wrap grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div class="max-w-sm">
          <img src="/brand/logo-primary-reversed.svg" alt="tinyzoo" class="h-8 w-auto" width="140" height="32">
          <p v-if="settings?.tagline" class="mt-4 text-cream/70">{{ settings.tagline }}</p>
          <p v-if="settings?.footerNote" class="mt-4 text-sm text-cream/65 whitespace-pre-line">{{ settings.footerNote }}</p>
        </div>
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.08em] text-cream/65">{{ t('footerNext') }}</p>
          <CmsNav :links="nav?.footer" class="site-nav-footer mt-4" :aria-label="t('footerMenu')" />
        </div>
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.08em] text-cream/65">{{ t('footerThisSite') }}</p>
          <p class="mt-4 text-sm text-cream/70">{{ t('footerThisSiteText') }}</p>
          <p v-if="settings?.email" class="mt-4 text-sm"><a :href="`mailto:${settings.email}`" class="underline decoration-cream/30 underline-offset-4 hover:decoration-cream">{{ settings.email }}</a></p>
        </div>
      </div>
      <div class="wrap"><div class="flex flex-wrap items-center justify-between gap-4 border-t border-cream/10 py-6 text-xs text-cream/65">
        <p>© {{ year }} {{ settings?.siteName ?? 'tinyzoo' }}</p>
        <div class="flex items-end gap-1" aria-hidden="true">
          <img v-for="a in ['bunny', 'bird', 'fox', 'frog', 'octopus', 'elephant']" :key="a" :src="`/animals/${a}.svg`" alt="" class="h-4 w-auto opacity-80">
        </div>
      </div></div>
    </footer>
  </div>
</template>

<style>
/* The logo's long press opens the design system, not iOS's link callout. */
.site-logo { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
/* Search: a round icon button beside the language switcher. */
.site-search { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: 999px; color: rgb(19 19 19 / 0.75); transition: color .15s ease, background-color .15s ease; }
.site-search:hover, .site-search.router-link-active { color: var(--color-ink); background: rgb(19 19 19 / 0.05); }
/* The language switcher: a small dropdown next to the main button. */
.lang { position: relative; }
.lang summary { display: inline-flex; align-items: center; gap: 0.25rem; min-height: 2.75rem; padding: 0 0.75rem; border-radius: 999px; font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.04em; color: rgb(19 19 19 / 0.75); cursor: pointer; list-style: none; }
.lang summary::-webkit-details-marker { display: none; }
.lang summary:hover, .lang[open] summary { color: var(--color-ink); background: rgb(19 19 19 / 0.05); }
.lang ul { position: absolute; right: 0; top: calc(100% + 0.375rem); z-index: 30; min-width: 11rem; padding: 0.375rem; background: #fff; border-radius: 0.875rem; box-shadow: 0 0 0 1px rgb(19 19 19 / 0.08), 0 20px 40px -20px rgb(19 19 19 / 0.35); }
.lang a { display: flex; align-items: center; gap: 0.625rem; min-height: 2.75rem; padding: 0.5rem 0.625rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.9375rem; color: rgb(19 19 19 / 0.8); }
.lang a:hover { background: rgb(19 19 19 / 0.05); color: var(--color-ink); }
.lang a.lang-on { color: var(--color-ink); background: rgb(19 19 19 / 0.05); }
.lang-code { width: 1.75rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-mute); }
.site-bar { transition: background-color .2s ease, box-shadow .2s ease, backdrop-filter .2s ease; }
.site-bar--open { background: #fff !important; }
.site-bar--solid { background: rgb(255 255 255 / 0.86); backdrop-filter: saturate(1.4) blur(14px); -webkit-backdrop-filter: saturate(1.4) blur(14px); box-shadow: 0 1px 0 rgb(19 19 19 / 0.08); }

/* Desktop: links in a row, a link's dropdown opens on hover or keyboard focus. */
.site-nav { margin-left: auto; }
.site-nav > ul { display: flex; gap: 0.25rem; }
.site-nav li { position: relative; }
.site-nav a { display: block; white-space: nowrap; padding: 0.5rem 0.875rem; border-radius: 999px; font-weight: 600; font-size: 0.95rem; color: rgb(19 19 19 / 0.75); transition: color .15s ease, background-color .15s ease; }
.site-nav a:hover, .site-nav a.router-link-active { color: var(--color-ink); background: rgb(19 19 19 / 0.05); }
.site-nav li ul { display: none; position: absolute; top: calc(100% + 0.25rem); left: 0; z-index: 10; min-width: 13rem; padding: 0.375rem; background: #fff; border-radius: 0.875rem; box-shadow: 0 0 0 1px rgb(19 19 19 / 0.08), 0 20px 40px -20px rgb(19 19 19 / 0.35); }
.site-nav li:hover > ul, .site-nav li:focus-within > ul { display: block; }
.site-nav li ul a { border-radius: 0.5rem; }
.site-menu-button { display: none; }
/* Small phones: no room for the button in the bar (the hero right below has it). */
@media (max-width: 519px) { .site-cta { display: none !important; } }
.site-nav-footer > ul { display: grid; gap: 0; }
.site-nav-footer a { display: inline-block; padding-block: 0.625rem; }
.site-nav-footer a { color: rgb(249 245 239 / 0.75); font-size: 0.9375rem; }
.site-nav-footer a:hover { color: var(--color-cream); }

/* Phones and narrow windows (German labels are long): one column behind the menu button,
   dropdown links shown under their parent. */
@media (max-width: 1099px) {
  .site-menu-button { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; margin-right: -0.5rem; border-radius: 999px; }
  .site-nav { display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 20; margin: 0; background: #fff; box-shadow: 0 1px 0 rgb(19 19 19 / 0.08), 0 30px 40px -30px rgb(19 19 19 / 0.4); padding: 0.5rem 1.25rem 1.25rem; }
  .site-nav--open { display: block; }
  .site-nav > ul { flex-direction: column; gap: 0; }
  .site-nav a { white-space: normal; padding: 0.875rem 0; border-radius: 0; font-size: 1.125rem; background: none !important; }
  .site-nav li ul { display: block; position: static; min-width: 0; padding: 0 0 0 1rem; box-shadow: none; background: none; }
}
</style>
