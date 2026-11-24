<script setup lang="ts">
// Regál's footer: the name very large on the dark ground, four columns of facts, the legal links.
const { nav } = await useSite()
const { settings, name, words, lines, fullPlace } = await useShop()
const links = computed(() => menuLinks(nav.value?.footer))
const legal = computed(() => menuLinks(nav.value?.legal))
// (the server's year, sent with the page, so both drawings agree around New Year)
const year = useState('shop-year', () => new Date().getFullYear())
</script>

<template>
  <footer class="on-dark bg-ink text-paper">
    <div class="wrap py-12 md:py-16">
      <p class="text-[clamp(2.4rem,9vw,4.2rem)] font-extrabold leading-none tracking-[-0.04em]" aria-hidden="true">{{ name }}</p>
      <div class="mt-10 grid gap-8 border-t-2 border-paper/80 pt-6 text-[0.95rem] sm:grid-cols-2 lg:grid-cols-4">
        <div><p class="cond text-[1.15rem] text-signal">{{ words.footerShop }}</p><p class="mt-2 text-paper/80">{{ fullPlace }}<template v-for="line in lines" :key="line"><br>{{ line }}</template></p></div>
        <div>
          <p class="cond text-[1.15rem] text-signal">{{ words.contact }}</p>
          <p class="mt-2 text-paper/80">
            <template v-if="settings?.phone"><a class="ulink" :href="phoneHref(settings.phone)">{{ settings.phone }}</a><br></template>
            <template v-if="settings?.mobile"><a class="ulink" :href="smsHref(settings.mobile)">{{ settings.mobile }}</a> {{ words.smsNote }}<br></template>
            <a v-if="settings?.email" class="ulink" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
          </p>
        </div>
        <div><p class="cond text-[1.15rem] text-signal">{{ words.footerOnWeb }}</p><p class="mt-2 text-paper/80"><template v-for="(l, i) in links" :key="l.id"><br v-if="i"><NuxtLink class="ulink" :to="l.url">{{ l.label }}</NuxtLink></template></p></div>
        <div>
          <p class="cond text-[1.15rem] text-signal">{{ words.footerOperator }}</p>
          <p class="mt-2 text-paper/80">
            {{ settings?.operator }}<br>
            <template v-if="settings?.companyId">IČO {{ settings.companyId }}<template v-if="settings.vatId">, DIČ {{ settings.vatId }}</template><br></template>
            {{ settings?.register }}
          </p>
        </div>
      </div>
      <div class="mt-8 flex flex-wrap justify-between gap-3 text-[0.85rem] text-paper/70">
        <p>© {{ year }} {{ settings?.operator || name }}</p>
        <p v-if="legal.length"><template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="ulink" :to="l.url">{{ l.label }}</NuxtLink></template></p>
      </div>
    </div>
  </footer>
</template>
