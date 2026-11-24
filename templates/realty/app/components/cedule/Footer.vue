<script setup lang="ts">
// Cedule's footer: the brand colour, the name set enormous, the links into the offer, the
// operator as the register writes it and the legal links, all under a black rule.
const { nav } = await useSite()
const { settings, address, words } = await useOffice()
const w = words.value.cedule
const offer = computed(() => menuLinks(nav.value?.offer))
const legal = computed(() => menuLinks(nav.value?.legal))
const year = useState('year', () => new Date().getFullYear())
const legalLine = computed(() => tidyText([`© ${year.value}`, settings.value?.company, settings.value?.legalNote].filter(Boolean).join(' ')))
const operator = computed(() => [
  settings.value?.company,
  address.value,
  [settings.value?.companyId && `${w.companyId} ${settings.value.companyId}`, settings.value?.vatId && `${w.vatId} ${settings.value.vatId}`].filter(Boolean).join(' · '),
  settings.value?.register,
].filter(Boolean) as string[])
</script>

<template>
  <footer class="bg-brand text-brand-ink border-t-2 border-ink">
    <div class="wrap pt-12 md:pt-16 pb-8">
      <div class="grid md:grid-cols-12 gap-x-10 gap-y-8">
        <p class="md:col-span-6 font-extrabold text-[3.4rem] md:text-[6rem] leading-[0.85] tracking-[-0.06em]">{{ settings?.siteName }}<template v-if="settings?.descriptor"><br>{{ settings.descriptor }}.</template></p>
        <div v-if="offer.length" class="md:col-span-3">
          <p class="mono caps">{{ w.offer }}</p>
          <ul class="mt-2 font-bold">
            <li v-for="l in offer" :key="l.id"><NuxtLink class="inline-flex items-center min-h-[40px] hover:underline underline-offset-4 decoration-2" :to="l.url">{{ tidyText(l.label) }}</NuxtLink></li>
          </ul>
        </div>
        <div v-if="operator.length" class="md:col-span-3">
          <p class="mono caps">{{ w.operator }}</p>
          <p class="mt-3 font-medium leading-[1.6]"><template v-for="(line, i) in operator" :key="i"><br v-if="i">{{ tidyText(line) }}</template></p>
        </div>
      </div>
      <div class="mt-10 pt-5 border-t-2 border-current flex flex-wrap justify-between gap-x-8 gap-y-2 mono">
        <p>{{ legalLine }}</p>
        <p v-if="legal.length" class="flex flex-wrap gap-x-6">
          <NuxtLink v-for="l in legal" :key="l.id" class="inline-flex items-center min-h-[36px] hover:underline underline-offset-4" :to="l.url">{{ l.label }}</NuxtLink>
        </p>
      </div>
    </div>
  </footer>
</template>
