<script setup lang="ts">
// Šanony's footer: the name set as large as the page allows, then three columns under a heavy
// rule: the office with its hours, the company's details, the documents.
const { nav } = await useSite()
const { settings, name, words, year, address } = await useOffice()
const legal = computed(() => menuLinks(nav.value?.legal))
const hours = computed(() => hoursGroups(settings.value?.hours).map((g) => `${groupLabel(g, words.value, true)} ${hoursSpan(g)}`).join(', '))
const size = computed(() => byLength(name.value, [[16, 'text-[44px] sm:text-[84px] xl:text-[128px]'], [26, 'text-[34px] sm:text-[60px] xl:text-[84px]']], 'text-[28px] sm:text-[44px] xl:text-[56px]'))
</script>

<template>
  <footer class="on-dark bg-ink text-paper">
    <div class="wrap py-14 lg:py-20">
      <p class="display" :class="size"><SanonyWordmark large /></p>
      <div class="mt-10 grid gap-10 border-t-4 border-paper pt-8 text-[15px] leading-[1.65] lg:grid-cols-12">
        <div class="lg:col-span-4">
          <p class="kicker mb-3 text-[12px]">{{ words.office }}</p>
          <p class="text-paper/85">{{ settings?.legalName || name }}<template v-if="address"><br>{{ address }}</template><template v-if="hours"><br>{{ hours }}</template></p>
        </div>
        <div class="lg:col-span-5">
          <p class="kicker mb-3 text-[12px]">{{ words.companyDetails }}</p>
          <p class="text-paper/85">
            <template v-if="settings?.companyId || settings?.taxId"><template v-if="settings.companyId">{{ words.companyNumber }} {{ settings.companyId }}</template><template v-if="settings.companyId && settings.taxId"> · </template><template v-if="settings.taxId">{{ words.vatNumber }} {{ settings.taxId }}</template></template>
            <template v-if="settings?.register"><br>{{ words.registerLine(settings.register) }}</template>
            <template v-if="settings?.membership"><br>{{ settings.membership }}</template>
            <template v-if="settings?.insurance"><br>{{ settings.insurance }}</template>
          </p>
        </div>
        <div v-if="legal.length" class="lg:col-span-3">
          <p class="kicker mb-3 text-[12px]">{{ words.documents }}</p>
          <ul>
            <li v-for="l in legal" :key="l.id"><NuxtLink class="inline-flex min-h-8 items-center underline decoration-paper/40 underline-offset-4 hover:decoration-paper" :to="l.url">{{ l.label }}</NuxtLink></li>
          </ul>
        </div>
      </div>
      <p class="mt-10 text-[13px] text-paper/70">© {{ year }} {{ settings?.legalName || name }}</p>
    </div>
  </footer>
</template>
