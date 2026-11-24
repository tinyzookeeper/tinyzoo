<script setup lang="ts">
// Čekárna's footer on a soft surface: the practice and its address, the operator, the links for patients.
const { nav } = await useSite()
const { settings, name, words, address } = await useMedical()
const legal = computed(() => menuLinks(nav.value?.legal))
// (the year is the server's until the browser has drawn the same: no difference at New Year)
const year = useState('medical-year', () => new Date().getFullYear())
const hasOperator = computed(() => !!(settings.value?.operatorName || settings.value?.companyId || settings.value?.register))
</script>

<template>
  <footer class="bg-tint">
    <div class="wrap py-14 lg:py-16 grid gap-10 lg:grid-cols-[1.3fr_1fr_1fr]">
      <div>
        <p class="font-display font-semibold tracking-[-0.02em] text-[1.5rem] text-ink">{{ tidyText(name) }}</p>
        <p v-if="address || settings?.field" class="mt-3 max-w-[24rem] text-[.98rem]">{{ tidyText([settings?.field, address].filter(Boolean).join('. ')) }}{{ address ? '.' : '' }}</p>
        <p v-if="settings?.phone || settings?.email" class="mt-4 text-[.98rem]">
          <a v-if="settings?.phone" class="num text-ink font-semibold underline underline-offset-4 decoration-line decoration-2 hover:decoration-brand" :href="telHref(settings.phone)">{{ settings.phone }}</a><template v-if="settings?.phone && settings?.email"> · </template><a v-if="settings?.email" class="text-ink underline underline-offset-4 decoration-line decoration-2 hover:decoration-brand break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
        </p>
      </div>
      <div v-if="hasOperator" class="text-[.95rem]">
        <p class="text-ink font-semibold">{{ words.operator }}</p>
        <p class="mt-2">
          <template v-if="settings?.operatorName">{{ settings.operatorName }}<br></template>
          <template v-if="settings?.companyId">{{ words.companyId }}&nbsp;{{ settings.companyId }}<br></template>
          <template v-if="settings?.register">{{ tidyText(settings.register) }}</template>
        </p>
      </div>
      <div v-if="legal.length" class="text-[.95rem]">
        <p class="text-ink font-semibold">{{ words.forPatients }}</p>
        <ul class="mt-2 grid gap-1.5">
          <li v-for="l in legal" :key="l.id"><NuxtLink class="underline underline-offset-4 decoration-line decoration-2 hover:decoration-brand hover:text-ink" :to="l.url">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
    </div>
    <p v-if="settings?.operatorName || settings?.licence" class="wrap pb-8 text-[.9rem] text-quiet">© {{ year }} {{ settings?.operatorName }}<template v-if="settings?.licence">{{ ' ' }}{{ tidyText(settings.licence) }}</template></p>
    <span class="sr-only">{{ words.contact }}</span>
  </footer>
</template>
