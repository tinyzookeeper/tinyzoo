<script setup lang="ts">
// Ciferník's footer: a dark panel with rounded top corners, the practice and its address, the
// operator, the links for patients.
const { nav } = await useSite()
const { settings, name, words, address } = await useMedical()
const legal = computed(() => menuLinks(nav.value?.legal))
// (the year is the server's until the browser has drawn the same: no difference at New Year)
const year = useState('medical-year', () => new Date().getFullYear())
const hasOperator = computed(() => !!(settings.value?.operatorName || settings.value?.companyId || settings.value?.register))
</script>

<template>
  <footer class="bg-ink text-paper/80 rounded-t-[28px] lg:rounded-t-[40px]">
    <div class="wrap py-12 lg:py-14 grid gap-9 lg:grid-cols-[1.3fr_1fr_1fr]">
      <div>
        <p class="font-display text-[1.9rem] text-paper">{{ tidyText(name) }}</p>
        <p v-if="address || settings?.field" class="mt-3 max-w-[26rem]">{{ tidyText([settings?.field, address].filter(Boolean).join('. ')) }}{{ address ? '.' : '' }}</p>
        <p v-if="settings?.phone || settings?.email" class="mt-3">
          <a v-if="settings?.phone" class="num text-paper font-bold underline underline-offset-4 decoration-paper/40 hover:decoration-paper" :href="telHref(settings.phone)">{{ settings.phone }}</a><template v-if="settings?.phone && settings?.email"> · </template><a v-if="settings?.email" class="text-paper underline underline-offset-4 decoration-paper/40 hover:decoration-paper break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
        </p>
      </div>
      <div v-if="hasOperator" class="text-[.97rem]">
        <p class="text-paper font-bold">{{ words.operator }}</p>
        <p class="mt-2">
          <template v-if="settings?.operatorName">{{ settings.operatorName }}<br></template>
          <template v-if="settings?.companyId">{{ words.companyId }}&nbsp;{{ settings.companyId }}<br></template>
          <template v-if="settings?.register">{{ tidyText(settings.register) }}</template>
        </p>
      </div>
      <div v-if="legal.length" class="text-[.97rem]">
        <p class="text-paper font-bold">{{ words.forPatients }}</p>
        <ul class="mt-2 grid gap-1.5">
          <li v-for="l in legal" :key="l.id"><NuxtLink class="underline underline-offset-4 decoration-paper/40 hover:decoration-paper" :to="l.url">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
    </div>
    <p v-if="settings?.operatorName || settings?.licence" class="wrap pb-8 text-[.9rem] text-paper/70">© {{ year }} {{ settings?.operatorName }}<template v-if="settings?.licence">{{ ' ' }}{{ tidyText(settings.licence) }}</template></p>
    <span class="sr-only">{{ words.contact }}</span>
  </footer>
</template>
