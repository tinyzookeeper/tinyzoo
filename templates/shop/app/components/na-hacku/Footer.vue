<script setup lang="ts">
// Na háčku's footer: the dark ground, the sign and the name large, one bright button, four columns of facts.
const { nav } = await useSite()
const { settings, name, words, lines, fullPlace, cta } = await useShop()
const links = computed(() => menuLinks(nav.value?.footer))
const legal = computed(() => menuLinks(nav.value?.legal))
// (the server's year, sent with the page, so both drawings agree around New Year)
const year = useState('shop-year', () => new Date().getFullYear())
</script>

<template>
  <footer class="bg-ink text-card">
    <div class="wrap py-12 md:py-16">
      <div class="flex flex-wrap items-center justify-between gap-6">
        <p class="flex items-center gap-3" aria-hidden="true"><NaHackuKeys class="size-11 text-pop" /><span class="disp text-[2.2rem] font-black leading-none tracking-[-0.02em] md:text-[3rem]">{{ name }}</span></p>
        <NuxtLink v-if="cta" :to="cta.url" class="btn !bg-pop !text-ink">{{ words.askLong }}</NuxtLink>
      </div>
      <div class="mt-10 grid gap-8 text-[0.95rem] sm:grid-cols-2 lg:grid-cols-4">
        <div><p class="disp text-[1.1rem] font-bold text-pop">{{ words.footerShop }}</p><p class="mt-2 opacity-85">{{ fullPlace }}<template v-for="line in lines" :key="line"><br>{{ line }}</template></p></div>
        <div>
          <p class="disp text-[1.1rem] font-bold text-pop">{{ words.contact }}</p>
          <p class="mt-2 opacity-85">
            <template v-if="settings?.phone"><a class="ulink" :href="phoneHref(settings.phone)">{{ settings.phone }}</a><br></template>
            <template v-if="settings?.mobile"><a class="ulink" :href="smsHref(settings.mobile)">{{ settings.mobile }}</a> {{ words.smsNote }}<br></template>
            <a v-if="settings?.email" class="ulink" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
          </p>
        </div>
        <div><p class="disp text-[1.1rem] font-bold text-pop">{{ words.footerOnWeb }}</p><p class="mt-2 opacity-85"><template v-for="(l, i) in links" :key="l.id"><br v-if="i"><NuxtLink class="ulink" :to="l.url">{{ l.label }}</NuxtLink></template></p></div>
        <div>
          <p class="disp text-[1.1rem] font-bold text-pop">{{ words.footerOperator }}</p>
          <p class="mt-2 opacity-85">
            {{ settings?.operator }}<br>
            <template v-if="settings?.companyId">IČO {{ settings.companyId }}<template v-if="settings.vatId">, DIČ {{ settings.vatId }}</template><br></template>
            {{ settings?.register }}
          </p>
        </div>
      </div>
      <div class="mt-10 flex flex-wrap justify-between gap-3 border-t border-card/25 pt-5 text-[0.85rem] opacity-80">
        <p>© {{ year }} {{ settings?.operator || name }}</p>
        <p v-if="legal.length"><template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="ulink" :to="l.url">{{ l.label }}</NuxtLink></template></p>
      </div>
    </div>
  </footer>
</template>
