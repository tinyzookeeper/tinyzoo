<script setup lang="ts">
// Zdivo's footer: the footing of the page, a concrete band with the firm's legal details.
const { nav } = await useSite()
const { settings, name, words, postalTown } = await useFirm()
const legal = computed(() => menuLinks(nav.value?.legal))
// The year is the server's, handed to the browser, so both write the same.
const year = useState('construction-year', () => new Date().getFullYear())
const address = computed(() => [[settings.value?.legalName ?? name.value, settings.value?.street, postalTown.value].filter(Boolean).join(', ') + '.', settings.value?.registry].filter(Boolean).join(' '))
</script>

<template>
  <footer class="bg-concrete text-[#f4efe6]">
    <div class="wrap grid gap-8 py-12 text-[15px] leading-[1.55] md:grid-cols-12">
      <div class="md:col-span-6">
        <p class="font-display text-[27px] font-extrabold leading-none">{{ name }}</p>
        <p class="mt-4 max-w-[34em]">{{ address }}</p>
      </div>
      <dl v-if="settings?.companyId || settings?.vatId" class="md:col-span-3 md:col-start-8">
        <div v-if="settings.companyId" class="flex gap-4"><dt class="w-10 font-semibold">{{ words.companyId }}</dt><dd>{{ settings.companyId }}</dd></div>
        <div v-if="settings.vatId" class="flex gap-4"><dt class="w-10 font-semibold">{{ words.vatId }}</dt><dd>{{ settings.vatId }}</dd></div>
      </dl>
      <nav v-if="legal.length" class="flex flex-col md:col-span-2" :aria-label="words.legalMenu">
        <NuxtLink v-for="l in legal" :key="l.id" class="inline-flex min-h-[44px] items-center underline underline-offset-4 hover:no-underline" :to="l.url">{{ l.label }}</NuxtLink>
      </nav>
    </div>
    <div class="wrap"><p class="border-t border-white/25 py-4 text-[14px]">© {{ year }} {{ settings?.legalName ?? name }}</p></div>
  </footer>
</template>
