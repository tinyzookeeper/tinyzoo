<script setup lang="ts">
const { settings, nav, name } = await useSite()
const words = useSiteWords()
const links = computed(() => menuLinks(nav.value?.footer))
const legal = computed(() => menuLinks(nav.value?.legal))
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-line">
    <div class="wrap py-12 md:py-16">
      <div class="grid md:grid-cols-12 gap-x-10 gap-y-10">
        <div class="md:col-span-5">
          <NuxtLink to="/" class="font-display text-ink text-[2rem] leading-none inline-block"><AtelierWordmark /></NuxtLink>
          <p v-if="settings?.tagline" class="mt-4 max-w-[22rem]">{{ tidyText(settings.tagline) }}</p>
        </div>
        <nav class="md:col-span-3 md:col-start-7 grid content-start label text-ink" :aria-label="words.footerMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url">{{ l.label }}</NuxtLink>
        </nav>
        <div class="md:col-span-3 grid content-start label text-ink">
          <a v-if="settings?.instagram" class="navlink gap-2.5" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" class="size-[18px]" aria-hidden="true" /> Instagram</a>
          <a v-if="settings?.facebook" class="navlink gap-2.5" :href="settings.facebook" target="_blank" rel="noopener"><UIcon name="i-lucide-facebook" class="size-[18px]" aria-hidden="true" /> Facebook</a>
          <a v-if="settings?.phone" class="navlink" :href="telHref(settings.phone)">{{ settings.phone }}</a>
          <a v-if="settings?.email" class="navlink normal-case tracking-normal text-[0.95rem]" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
        </div>
      </div>
      <div class="mt-12 pt-6 border-t border-line flex flex-col md:flex-row md:justify-between gap-2 text-[0.92rem] text-quiet">
        <p>© {{ year }} {{ name }}<template v-if="settings?.companyId"> · IČO {{ settings.companyId }}</template></p>
        <p v-if="legal.length">
          <template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="underline underline-offset-4 hover:text-ink" :to="l.url">{{ l.label }}</NuxtLink></template>
        </p>
      </div>
    </div>
  </footer>
</template>
