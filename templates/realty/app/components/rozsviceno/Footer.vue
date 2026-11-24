<script setup lang="ts">
// Rozsvíceno's footer: two rows of windows of a facade (a few of them lit, as decoration), the
// name and a few words about the agency, the links into the offer, the operator as the
// register writes it, and the legal links.
const { nav } = await useSite()
const { settings, address, words } = await useOffice()
const w = words.value.rozsviceno
const offer = computed(() => menuLinks(nav.value?.offer))
const legal = computed(() => menuLinks(nav.value?.legal))
const year = useState('year', () => new Date().getFullYear())
const legalLine = computed(() => tidyText([`© ${year.value}`, settings.value?.company, settings.value?.legalNote].filter(Boolean).join(' ')))
const operator = computed(() => [
  settings.value?.company,
  address.value,
  [settings.value?.companyId && `${w.companyId} ${settings.value.companyId}`, settings.value?.vatId && `${w.vatId} ${settings.value.vatId}`].filter(Boolean).join(' · '),
  settings.value?.register && `${w.register} ${settings.value.register}`,
].filter(Boolean) as string[])
// Which windows are lit: fixed, so every visit and every page draws the same facade.
const ROWS = [
  [2, 7, 8, 14, 21, 25, 32, 37],
  [1, 10, 17, 18, 28, 36, 42],
]
const windows = (lit: number[]) => Array.from({ length: 44 }, (_, i) => lit.includes(i))
</script>

<template>
  <footer class="border-t border-line">
    <div class="wrap pt-10" aria-hidden="true">
      <div v-for="(lit, r) in ROWS" :key="r" class="facade" :class="r ? 'mt-[14px]' : ''"><i v-for="(on, i) in windows(lit)" :key="i" :class="{ on }" /></div>
    </div>
    <div class="wrap py-12 grid md:grid-cols-12 gap-x-10 gap-y-10 text-[0.97rem]">
      <div class="md:col-span-5">
        <p class="serif font-bold text-[1.9rem] leading-none">{{ settings?.siteName }} <span v-if="settings?.descriptor" class="font-sans font-normal text-[0.9rem] text-quiet">{{ settings.descriptor }}</span></p>
        <p v-if="settings?.about" class="mt-4 max-w-[24rem] text-quiet">{{ tidyText(settings.about) }}</p>
      </div>
      <div v-if="offer.length" class="md:col-span-3">
        <p class="font-semibold">{{ w.offer }}</p>
        <ul class="mt-2 text-quiet">
          <li v-for="l in offer" :key="l.id"><NuxtLink class="inline-flex items-center min-h-[40px] hover:text-lamp transition-colors" :to="l.url">{{ tidyText(l.label) }}</NuxtLink></li>
        </ul>
      </div>
      <div v-if="operator.length" class="md:col-span-4">
        <p class="font-semibold">{{ w.operator }}</p>
        <p class="mt-3 text-quiet leading-[1.7]"><template v-for="(line, i) in operator" :key="i"><br v-if="i">{{ tidyText(line) }}</template></p>
      </div>
    </div>
    <div class="wrap">
      <div class="py-6 border-t border-line flex flex-wrap justify-between gap-x-8 gap-y-2 text-[0.9rem] text-quiet">
        <p>{{ legalLine }}</p>
        <p v-if="legal.length" class="flex flex-wrap gap-x-6">
          <NuxtLink v-for="l in legal" :key="l.id" class="inline-flex items-center min-h-[36px] hover:text-lamp transition-colors" :to="l.url">{{ l.label }}</NuxtLink>
        </p>
      </div>
    </div>
  </footer>
</template>
