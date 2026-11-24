<script setup lang="ts">
// Portál's footer: the name board again on the darkest wood, four columns of facts, the legal links.
const { nav } = await useSite()
const { settings, name, words, lines, fullPlace } = await useShop()
const links = computed(() => menuLinks(nav.value?.footer))
const legal = computed(() => menuLinks(nav.value?.legal))
// (the server's year, sent with the page, so both drawings agree around New Year)
const year = useState('shop-year', () => new Date().getFullYear())
</script>

<template>
  <footer class="bg-wood-lo">
    <div class="fascia !bg-wood-lo">
      <div class="wrap flex items-center justify-center py-6">
        <span class="fascia-name min-w-0 !whitespace-normal text-center" :class="byLength(name, [[14, 'text-[clamp(1.5rem,6vw,2.6rem)]'], [28, 'text-[clamp(1.25rem,4.8vw,2rem)]']], 'text-[clamp(1rem,4vw,1.6rem)]')" aria-hidden="true">{{ name }}</span>
      </div>
    </div>
    <div class="wrap grid gap-8 py-10 text-[0.95rem] text-cream/80 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p class="caps text-brass">{{ words.footerShop }}</p>
        <p class="mt-3">{{ fullPlace }}<template v-for="line in lines" :key="line"><br>{{ line }}</template></p>
      </div>
      <div>
        <p class="caps text-brass">{{ words.contact }}</p>
        <p class="mt-3">
          <template v-if="settings?.phone"><a class="tlink" :href="phoneHref(settings.phone)">{{ settings.phone }}</a><br></template>
          <template v-if="settings?.mobile"><a class="tlink" :href="smsHref(settings.mobile)">{{ settings.mobile }}</a> {{ words.smsNote }}<br></template>
          <a v-if="settings?.email" class="tlink" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
        </p>
      </div>
      <div>
        <p class="caps text-brass">{{ words.footerOnWeb }}</p>
        <p class="mt-3"><template v-for="(l, i) in links" :key="l.id"><br v-if="i"><NuxtLink class="tlink" :to="l.url">{{ l.label }}</NuxtLink></template></p>
      </div>
      <div>
        <p class="caps text-brass">{{ words.footerOperator }}</p>
        <p class="mt-3">
          {{ settings?.operator }}<br>
          <template v-if="settings?.companyId">IČO {{ settings.companyId }}<template v-if="settings.vatId">, DIČ {{ settings.vatId }}</template><br></template>
          {{ settings?.register }}
        </p>
      </div>
    </div>
    <div class="wrap"><div class="flex flex-wrap justify-between gap-3 border-t border-brass/25 py-5 text-[0.85rem] text-cream/70">
      <p>© {{ year }} {{ settings?.operator || name }}</p>
      <p v-if="legal.length"><template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="tlink" :to="l.url">{{ l.label }}</NuxtLink></template></p>
    </div></div>
  </footer>
</template>
