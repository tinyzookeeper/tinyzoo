<script setup lang="ts">
// Čtvero dob's footer: dark ink, the association's full name, what it is, the four seasons as
// small bars, then the facts a registered association states (the number, the register, the
// account, the data box) and the address with the links of the footer menu.
const { nav } = await useSite()
const { settings, name, words } = await useAssociation()
const legal = computed(() => menuLinks(nav.value?.legal))
const facts = computed(() => [
  { label: words.value.idNumber, value: settings.value?.companyId, figures: true },
  { label: words.value.register, value: settings.value?.register, figures: false },
  { label: words.value.account, value: settings.value?.account, figures: true },
  { label: words.value.dataBox, value: settings.value?.dataBox, figures: false },
].filter((f) => f.value))
const contact = computed(() => [settings.value?.address, settings.value?.email].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="on-dark bg-ink py-14 text-[color-mix(in_srgb,var(--paper)_86%,var(--ink))]">
    <div class="wrap">
      <div class="grid gap-10 lg:grid-cols-12">
        <div class="lg:col-span-4">
          <p class="serif text-[1.7rem] font-bold text-paper">{{ settings?.legalName || name }}</p>
          <p v-if="settings?.about" class="mt-3 max-w-[22rem]">{{ tidy(settings.about) }}</p>
          <p class="mt-5 flex gap-1.5" aria-hidden="true"><span class="h-2.5 w-8 rounded-full bg-zima" /><span class="h-2.5 w-8 rounded-full bg-jaro" /><span class="h-2.5 w-8 rounded-full bg-leto" /><span class="h-2.5 w-8 rounded-full bg-podzim" /></p>
        </div>
        <dl v-if="facts.length" class="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
          <div v-for="fact in facts" :key="fact.label"><dt class="serif font-semibold italic text-paper">{{ fact.label }}</dt><dd class="mt-1" :class="fact.figures ? 'lnum' : ''">{{ tidy(fact.value) }}</dd></div>
        </dl>
      </div>
      <div class="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-paper/20 pt-6 text-[0.95rem]">
        <p>{{ contact }}</p>
        <nav v-if="legal.length" class="flex flex-wrap gap-x-6" :aria-label="words.footerMenu">
          <template v-for="l in legal" :key="l.id">
            <a v-if="isExternal(l.url)" class="flex min-h-[44px] items-center hover:text-paper" :href="l.url" target="_blank" rel="noopener">{{ l.label }}</a>
            <NuxtLink v-else class="flex min-h-[44px] items-center hover:text-paper" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
          </template>
        </nav>
      </div>
    </div>
  </footer>
</template>
