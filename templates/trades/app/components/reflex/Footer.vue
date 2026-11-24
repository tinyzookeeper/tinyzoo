<script setup lang="ts">
// Reflex's footer: the name as large as it fits, then four columns in small capitals on black.
// On a phone a call bar slides in at the bottom once the opening has scrolled away, and goes
// again when the enquiry is in view.
const { nav } = await useSite()
const { settings, name, phone, addressLines, year, words } = await useTrades()
const links = computed(() => menuLinks(nav.value?.main))
const legal = computed(() => menuLinks(nav.value?.legal))

// The call bar is a thing of the visitor's scrolling: closed on the server, decided in the browser.
const bar = ref(false)
function onScroll() {
  const form = document.getElementById(words.value.anchors.enquiry)?.getBoundingClientRect()
  bar.value = window.scrollY > 520 && !(form && form.top < window.innerHeight && form.bottom > 0)
}
onMounted(() => { window.addEventListener('scroll', onScroll, { passive: true }); onScroll() })
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <footer class="on-dark bg-ink text-[#d6d9d4]">
    <div class="wrap pt-14 md:pt-20 pb-10">
      <p class="text-white text-[22vw] lg:text-[17vw] font-black leading-[0.8] tracking-[-0.06em] -ml-[0.04em]">{{ name }}</p>
      <div class="mt-10 md:mt-14 pt-8 border-t-2 border-white/25 grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-9 text-[1rem]">
        <div class="lg:col-span-4">
          <h2 class="label text-brand-lit !tracking-[0.06em]">{{ words.phone }}</h2>
          <a v-if="phone" :href="phone.href" class="mt-1 inline-flex items-center min-h-[48px] font-cond font-black text-white text-[2.75rem] leading-none tabular-nums hover:text-brand-lit transition-colors">{{ phone.text }}</a>
          <dl v-if="settings?.hours.length || settings?.emergency" class="mt-2 grid grid-cols-[auto_1fr] gap-x-5 gap-y-0.5">
            <template v-for="h in settings?.hours" :key="h.id"><dt>{{ h.days }}</dt><dd class="text-white font-bold tabular-nums">{{ h.time }}</dd></template>
            <template v-if="settings?.emergency"><dt>{{ words.emergency }}</dt><dd class="text-white font-bold">{{ settings.emergency }}</dd></template>
          </dl>
        </div>
        <div class="lg:col-span-3">
          <h2 class="label text-brand-lit !tracking-[0.06em]">{{ words.footerContact }}</h2>
          <p v-if="addressLines.length" class="mt-3"><template v-for="(line, i) in addressLines" :key="i"><br v-if="i">{{ line }}</template></p>
          <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="inline-flex items-center min-h-[44px] text-white font-bold underline decoration-2 underline-offset-4 hover:text-brand-lit break-all">{{ settings.email }}</a>
        </div>
        <div v-if="settings?.companyId || settings?.register" class="lg:col-span-3">
          <h2 class="label text-brand-lit !tracking-[0.06em]">{{ words.footerBilling }}</h2>
          <p class="mt-3"><template v-if="settings?.companyId">{{ words.companyId(settings.companyId) }}</template><br v-if="settings?.companyId && settings?.register"><template v-if="settings?.register">{{ settings.register }}</template></p>
        </div>
        <nav v-if="links.length" class="lg:col-span-2 flex flex-col" :aria-label="words.footerMenu">
          <h2 class="label text-brand-lit !tracking-[0.06em] mb-1.5">{{ words.footerWeb }}</h2>
          <NuxtLink v-for="l in links" :key="l.id" class="inline-flex items-center min-h-[40px] hover:text-brand-lit transition-colors" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        </nav>
      </div>
      <div class="mt-10 flex flex-wrap justify-between gap-x-8 gap-y-1 text-[0.9375rem] pb-16 md:pb-0">
        <p>© {{ year }} {{ settings?.legalName ?? settings?.siteName }}</p>
        <p v-if="legal.length">
          <template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink :to="l.url" class="underline underline-offset-4 hover:text-brand-lit">{{ l.label }}</NuxtLink></template>
        </p>
      </div>
    </div>
  </footer>

  <!-- Phone in the hand: a call bar that appears once the opening has scrolled away (phones only) -->
  <div v-if="phone" class="on-dark md:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_auto] gap-1 p-1 bg-ink transition-transform duration-200" :class="bar ? '' : 'translate-y-full'" :aria-hidden="!bar" data-callbar>
    <a :href="phone.href" :tabindex="bar ? 0 : -1" class="flex items-center justify-center gap-2.5 min-h-[52px] bg-brand text-brand-ink font-cond font-black text-[1.625rem] tabular-nums"><UIcon name="i-lucide-phone-call" class="size-5" aria-hidden="true" /> {{ phone.text }}</a>
    <NuxtLink :to="`/#${words.anchors.enquiry}`" :tabindex="bar ? 0 : -1" class="flex items-center justify-center min-h-[52px] px-4 text-white font-extrabold text-[1rem] border-2 border-white/40">{{ words.enquiryShort }}</NuxtLink>
  </div>
</template>
