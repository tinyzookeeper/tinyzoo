<script setup lang="ts">
// Výkres's footer: the firm's legal details laid out like the title block of a drawing, under a
// heavy rule.
const { nav } = await useSite()
const { settings, name, words, postalTown } = await useFirm()
const legal = computed(() => menuLinks(nav.value?.legal))
// The year is the server's, handed to the browser, so both write the same.
const year = useState('construction-year', () => new Date().getFullYear())
const address = computed(() => [[settings.value?.legalName ?? name.value, settings.value?.street, postalTown.value].filter(Boolean).join(', ') + '.', settings.value?.registry].filter(Boolean).join(' '))
</script>

<template>
  <footer class="border-t-2 border-ink bg-card">
    <div class="wrap grid gap-8 py-10 text-sm leading-relaxed md:grid-cols-12">
      <div class="md:col-span-5">
        <p class="font-display text-[19px] font-medium text-ink">{{ name }}</p>
        <p class="mt-3 max-w-[34em]">{{ address }}</p>
      </div>
      <dl v-if="settings?.companyId || settings?.vatId" class="grid grid-cols-2 gap-x-8 gap-y-1 md:col-span-3 md:col-start-7 md:grid-cols-1">
        <div v-if="settings.companyId" class="flex gap-3"><dt class="lab w-12 pt-0.5">{{ words.companyId }}</dt><dd class="text-ink">{{ settings.companyId }}</dd></div>
        <div v-if="settings.vatId" class="flex gap-3"><dt class="lab w-12 pt-0.5">{{ words.vatId }}</dt><dd class="text-ink">{{ settings.vatId }}</dd></div>
      </dl>
      <nav v-if="legal.length" class="flex flex-col gap-1 md:col-span-3" :aria-label="words.legalMenu">
        <NuxtLink v-for="l in legal" :key="l.id" class="inline-flex min-h-[44px] items-center text-ink underline decoration-1 underline-offset-4 hover:text-brand" :to="l.url">{{ l.label }}</NuxtLink>
      </nav>
    </div>
    <div class="wrap"><p class="lab border-t border-hair py-4">© {{ year }} {{ settings?.legalName ?? name }}</p></div>
  </footer>
</template>
