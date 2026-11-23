<script setup lang="ts">
// Zápisník's footer: a dark page with a strip of six recent pictures, then the name, the
// menu and the contacts.
import type { Album } from '~/lib/cms-content'

const { settings, nav, name } = await useSite()
const words = useSiteWords()
const links = computed(() => menuLinks(nav.value?.footer))
const legal = computed(() => menuLinks(nav.value?.legal))
const year = new Date().getFullYear()
const albums = await useAlbums()
// One picture from each of six albums, the newest first.
const cover = (a: Album) => a.cover ?? a.photos[0] ?? null
const strip = computed(() => albums.value.filter((a) => cover(a)).slice(0, 6))
</script>

<template>
  <footer class="on-ink bg-ink text-[var(--paper)]">
    <div class="wrap pt-14 md:pt-20 pb-8">
      <template v-if="strip.length">
        <div v-if="settings?.instagram" class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <p class="hand text-[2rem] md:text-[2.3rem]">{{ words.instagramNote }}</p>
          <a class="inline-flex items-center gap-2.5 min-h-[44px] font-bold underline underline-offset-[6px] decoration-2 hover:decoration-[var(--brand-ink)]" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" class="size-5" aria-hidden="true" />{{ socialHandle(settings.instagram) }}</a>
        </div>
        <div class="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
          <NuxtLink v-for="a in strip" :key="a.id" :to="albumHref(a)" class="block aspect-square overflow-hidden" :aria-label="a.title">
            <CmsImage :media="cover(a)" sizes="(min-width: 768px) 12rem, 33vw" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
          </NuxtLink>
        </div>
      </template>

      <div class="grid md:grid-cols-12 gap-x-10 gap-y-8" :class="strip.length ? 'mt-12 md:mt-16' : ''">
        <div class="md:col-span-5">
          <NuxtLink to="/" class="inline-flex items-center font-display text-[1.7rem] leading-none"><ZapisnikWordmark /></NuxtLink>
          <p v-if="settings?.tagline" class="mt-4 max-w-[22rem] opacity-85">{{ tidyText(settings.tagline) }}</p>
        </div>
        <nav class="md:col-span-3 md:col-start-7 grid content-start font-medium" :aria-label="words.footerMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="inline-flex items-center min-h-[44px] hover:underline underline-offset-4" :to="l.url">{{ l.label }}</NuxtLink>
        </nav>
        <div class="md:col-span-3 grid content-start font-medium">
          <a v-if="settings?.phone" class="inline-flex items-center min-h-[44px] hover:underline underline-offset-4" :href="telHref(settings.phone)">{{ settings.phone }}</a>
          <a v-if="settings?.email" class="inline-flex items-center min-h-[44px] hover:underline underline-offset-4 break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
          <a v-if="settings?.facebook" class="inline-flex items-center gap-2.5 min-h-[44px] hover:underline underline-offset-4" :href="settings.facebook" target="_blank" rel="noopener"><UIcon name="i-lucide-facebook" class="size-[18px]" aria-hidden="true" />Facebook</a>
        </div>
      </div>
      <div class="mt-10 pt-6 border-t border-[color-mix(in_srgb,var(--paper)_25%,transparent)] flex flex-col md:flex-row md:justify-between gap-2 text-[0.95rem] opacity-85">
        <p>© {{ year }} {{ name }}<template v-if="settings?.companyId"> · IČO {{ settings.companyId }}</template></p>
        <p v-if="legal.length">
          <template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="underline underline-offset-4" :to="l.url">{{ l.label }}</NuxtLink></template>
        </p>
      </div>
    </div>
  </footer>
</template>
