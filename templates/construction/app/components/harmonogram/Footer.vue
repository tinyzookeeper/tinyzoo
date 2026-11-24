<script setup lang="ts">
// Harmonogram's footer: the firm's legal details on a graphite surface, the numbers in mono.
const { nav } = await useSite()
const { settings, name, words, postalTown } = await useFirm()
const legal = computed(() => menuLinks(nav.value?.legal))
// The year is the server's, handed to the browser, so both write the same.
const year = useState('construction-year', () => new Date().getFullYear())
const address = computed(() => [[settings.value?.legalName ?? name.value, settings.value?.street, postalTown.value].filter(Boolean).join(', ') + '.', settings.value?.registry].filter(Boolean).join(' '))
</script>

<template>
  <footer class="border-t border-line bg-surface">
    <div class="wrap grid gap-8 py-10 text-sm leading-relaxed text-quiet md:grid-cols-12">
      <div class="md:col-span-6">
        <p class="text-[20px] font-extrabold tracking-[-.03em] text-text">{{ name }}</p>
        <p class="mt-3 max-w-[36em]">{{ address }}</p>
      </div>
      <dl v-if="settings?.companyId || settings?.vatId" class="num md:col-span-3 md:col-start-8">
        <div v-if="settings.companyId" class="flex gap-4"><dt class="w-10">{{ words.companyId }}</dt><dd class="text-text">{{ settings.companyId }}</dd></div>
        <div v-if="settings.vatId" class="flex gap-4"><dt class="w-10">{{ words.vatId }}</dt><dd class="text-text">{{ settings.vatId }}</dd></div>
      </dl>
      <nav v-if="legal.length" class="flex flex-col md:col-span-2" :aria-label="words.legalMenu">
        <NuxtLink v-for="l in legal" :key="l.id" class="inline-flex min-h-[44px] items-center text-text underline decoration-line underline-offset-4 hover:text-brand" :to="l.url">{{ l.label }}</NuxtLink>
      </nav>
    </div>
    <div class="wrap"><p class="mono border-t border-line py-4">© {{ year }} {{ settings?.legalName ?? name }}</p></div>
  </footer>
</template>
