<script setup lang="ts">
// Negativ's footer ends in the name set as wide as the page, whatever the name is.
const { settings, nav, name } = await useSite()
const words = useSiteWords()
const links = computed(() => menuLinks(nav.value?.footer))
const legal = computed(() => menuLinks(nav.value?.legal))
const year = new Date().getFullYear()

// The first guess comes from the length of the name (a condensed capital is about 0.46 em
// wide); in the browser the size is then set so the name fills the width exactly.
const perLetter = computed(() => Math.max(3, name.value.length * 0.4607))
const big = ref<HTMLElement | null>(null)
function fit() {
  const el = big.value
  const inner = el?.firstElementChild as HTMLElement | null
  if (!el || !inner || !inner.offsetWidth) return
  el.style.fontSize = ''
  const size = Number.parseFloat(getComputedStyle(el).fontSize)
  el.style.fontSize = `${size * el.clientWidth / inner.offsetWidth}px`
}
onMounted(() => {
  document.fonts.ready.then(fit)
  window.addEventListener('resize', fit)
})
onBeforeUnmount(() => window.removeEventListener('resize', fit))
watch(name, () => nextTick(fit))
</script>

<template>
  <footer class="pad pt-10 md:pt-14 pb-8 overflow-hidden">
    <div class="grid md:grid-cols-12 gap-x-10 gap-y-8 m">
      <p class="md:col-span-5 text-dim normal-case tracking-normal max-w-[24rem]">{{ tidyText(settings?.tagline) }}</p>
      <nav class="md:col-span-3 md:col-start-7 grid content-start" :aria-label="words.footerMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="lnk" :to="l.url">{{ l.label }}</NuxtLink>
      </nav>
      <div class="md:col-span-3 grid content-start">
        <a v-if="settings?.instagram" class="lnk gap-2.5" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" class="size-4" aria-hidden="true" /> Instagram</a>
        <a v-if="settings?.facebook" class="lnk gap-2.5" :href="settings.facebook" target="_blank" rel="noopener"><UIcon name="i-lucide-facebook" class="size-4" aria-hidden="true" /> Facebook</a>
        <NuxtLink v-for="l in legal" :key="l.id" class="lnk" :to="l.url">{{ l.label }}</NuxtLink>
      </div>
    </div>
    <p v-if="settings?.logo" class="mt-10 md:mt-14 text-[3rem] md:text-[4.5rem]"><NegativWordmark /></p>
    <p
      v-else ref="big" class="d text-[calc((100vw-2.5rem)/var(--per-letter))] md:text-[calc((100vw-5rem)/var(--per-letter))] whitespace-nowrap mt-10 md:mt-14"
      :style="{ '--per-letter': perLetter }" aria-hidden="true"
    >
      <span class="inline-block">{{ name }}</span>
    </p>
    <p class="m text-dim mt-6 flex flex-col md:flex-row md:justify-between gap-1 border-t border-rule pt-4">
      <span>© {{ year }} {{ name }}</span>
      <span v-if="settings?.companyId">IČO {{ settings.companyId }}</span>
    </p>
  </footer>
</template>
