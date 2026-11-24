<script setup lang="ts">
// Celý rok's footer: the name and a line about the house, the address, the contacts and the
// documents, and under them who runs the place.
const { nav } = await useSite()
const { settings, name, words, tel } = await useStay()
const legal = computed(() => menuLinks(nav.value?.legal))
const operator = computed(() => [settings.value?.operator && `${words.value.operator} ${settings.value.operator}`, settings.value?.companyId && `${words.value.companyId} ${settings.value.companyId}`].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="border-t border-line">
    <div class="wrap py-14 grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-4">
        <p aria-hidden="true"><CelyRokWordmark large /></p>
        <p v-if="settings?.about" class="mt-4 text-quiet max-w-[32ch]">{{ tidyText(settings.about) }}</p>
      </div>
      <div class="lg:col-span-3">
        <p class="label">{{ words.address }}</p>
        <p class="mt-3">{{ settings?.address }}<template v-if="settings?.postalTown"><br>{{ settings.postalTown }}</template></p>
        <p v-if="settings?.arrival || settings?.departure" class="mt-3 text-quiet">{{ [settings?.arrival && `${words.arrival} ${settings.arrival}`, settings?.departure && `${words.departure.toLowerCase()} ${settings.departure}`].filter(Boolean).join(', ') }}</p>
      </div>
      <div class="lg:col-span-3">
        <p class="label">{{ words.contact }}</p>
        <p class="mt-3 num">
          <a v-if="settings?.phone" :href="tel" class="hover:text-brand transition-colors inline-flex min-h-11 items-center">{{ settings.phone }}</a><br v-if="settings?.phone && settings?.email">
          <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="hover:text-brand transition-colors inline-flex min-h-11 items-center break-all">{{ settings.email }}</a>
        </p>
      </div>
      <div v-if="legal.length" class="lg:col-span-2">
        <p class="label">{{ words.documents }}</p>
        <ul class="mt-3">
          <li v-for="l in legal" :key="l.id"><NuxtLink :to="l.url" class="hover:text-brand transition-colors inline-flex min-h-11 items-center">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
    </div>
    <div class="wrap pb-10 text-sm text-quiet flex flex-wrap justify-between gap-x-8 gap-y-2 num">
      <p>{{ operator }}</p>
      <p>{{ words.copyright(name) }}</p>
    </div>
  </footer>
</template>
