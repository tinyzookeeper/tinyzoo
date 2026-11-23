<script setup lang="ts">
// Mistr's footer: a dark band with the name, the phone and the hours, the address and the
// invoicing details, and the menu; the privacy link under a hairline.
const { nav } = await useSite()
const { settings, phone, addressLines, year, words } = await useTrades()
const links = computed(() => menuLinks(nav.value?.main))
const legal = computed(() => menuLinks(nav.value?.legal))
</script>

<template>
  <footer class="bg-ink text-[#c9d0d8] text-[0.9375rem]">
    <div class="wrap py-14 md:py-16 grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-4">
        <MistrWordmark footer />
        <p v-if="settings?.footerText" class="mt-5 max-w-[20rem]">{{ tidyText(settings.footerText) }}</p>
      </div>
      <div class="lg:col-span-3">
        <h2 class="text-white text-[0.9375rem] font-bold tracking-normal">{{ words.phone }}</h2>
        <a v-if="phone" :href="phone.href" class="mt-2 inline-flex items-center min-h-[44px] text-white text-[1.5rem] font-bold tabular-nums tracking-[-0.02em] hover:underline underline-offset-4">{{ phone.text }}</a>
        <dl v-if="settings?.hours.length || settings?.emergency" class="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <template v-for="h in settings?.hours" :key="h.id"><dt>{{ h.days }}</dt><dd class="text-white tabular-nums">{{ h.time }}</dd></template>
          <template v-if="settings?.emergency"><dt>{{ words.emergency }}</dt><dd class="text-white">{{ settings.emergency }}</dd></template>
        </dl>
      </div>
      <div class="lg:col-span-3">
        <h2 class="text-white text-[0.9375rem] font-bold tracking-normal">{{ words.footerContactBilling }}</h2>
        <p v-if="addressLines.length" class="mt-3"><template v-for="(line, i) in addressLines" :key="i"><br v-if="i">{{ line }}</template></p>
        <p v-if="settings?.companyId || settings?.register" class="mt-3">
          <template v-if="settings?.companyId">{{ words.companyId(settings.companyId) }}</template><br v-if="settings?.companyId && settings?.register"><template v-if="settings?.register">{{ settings.register }}</template>
        </p>
        <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="mt-2 inline-flex items-center min-h-[44px] text-white underline underline-offset-4 decoration-white/40 hover:decoration-white break-all">{{ settings.email }}</a>
      </div>
      <nav v-if="links.length" class="lg:col-span-2 flex flex-col" :aria-label="words.footerMenu">
        <h2 class="text-white text-[0.9375rem] font-bold tracking-normal mb-1">{{ words.footerWeb }}</h2>
        <NuxtLink v-for="l in links" :key="l.id" class="inline-flex items-center min-h-[40px] hover:text-white transition-colors" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
    </div>
    <div class="border-t border-white/15">
      <div class="wrap py-5 flex flex-wrap justify-between gap-x-8 gap-y-1 text-[0.875rem]">
        <p>© {{ year }} {{ settings?.legalName ?? settings?.siteName }}</p>
        <p v-if="legal.length">
          <template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink :to="l.url" class="hover:text-white underline underline-offset-4 decoration-white/30">{{ l.label }}</NuxtLink></template>
        </p>
      </div>
    </div>
  </footer>
</template>
