<script setup lang="ts">
// Talíř: the name on the left in expanded capitals, the menu and the reservation button on the
// right, all on the brand colour (the opening that follows stands on the same colour). Below a
// desktop's width the menu folds behind a button and opens as a full-screen sheet.
const { nav } = await useSite()
const { name, address, phone, tel, words, state, openText } = await useRestaurant()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
const open = computed(() => openText(words.value.talir.open))
// A long name needs room: the menu folds behind its button from a wider screen (always for a very long one).
const fold = computed(() => (name.value.length > 24 ? { nav: 'hidden', button: '' } : name.value.length > 12 ? { nav: 'hidden xl:flex', button: 'xl:hidden' } : { nav: 'hidden lg:flex', button: 'lg:hidden' }))
const reserve = `/#${anchorOf('reservation')}`
</script>

<template>
  <header class="on-brand bg-brand text-brand-ink">
    <div class="wrap flex items-center justify-between gap-6 py-4 lg:py-5">
      <NuxtLink to="/" class="flex items-baseline gap-3 leading-none min-w-0" :aria-label="words.toTop(name)"><TalirWordmark mark tagline /></NuxtLink>
      <nav class="items-center gap-5 xl:gap-8 whitespace-nowrap shrink-0" :class="fold.nav" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        <NuxtLink class="btn btn-solid ml-2" :to="reserve">{{ words.reserve }}</NuxtLink>
      </nav>
      <button type="button" class="btn btn-solid !min-h-12 !px-5 cursor-pointer shrink-0" :class="fold.button" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        {{ words.menu }} <UIcon name="i-lucide-menu" aria-hidden="true" />
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="on-brand fixed inset-0 z-50 bg-brand text-brand-ink overflow-y-auto" :class="fold.button" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap flex items-center justify-between py-4">
        <span aria-hidden="true"><TalirWordmark size="panel" /></span>
        <button type="button" class="btn btn-solid !min-h-12 !px-5 cursor-pointer" @click="menu.hide()">{{ words.close }} <UIcon name="i-lucide-x" aria-hidden="true" /></button>
      </div>
      <nav class="wrap mt-2 flex flex-col wide text-[2.3rem]" :aria-label="words.mobileMenu">
        <NuxtLink v-for="(l, i) in links" :key="l.id" class="py-3.5 border-t-2 border-brand-ink" :class="i === links.length - 1 ? 'border-b-2' : ''" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
      </nav>
      <div class="wrap mt-7 pb-10">
        <p v-if="open" class="num text-[1.5rem]" data-open :data-state="state?.open ? 'open' : 'closed'"><span class="dot" /><span data-open-text>{{ open }}</span></p>
        <p v-if="address" class="mt-2 font-medium">{{ address }}</p>
        <div class="mt-6 grid gap-3">
          <NuxtLink class="btn btn-solid" :to="reserve" @click="menu.hide()">{{ words.reserve }}</NuxtLink>
          <a v-if="phone" class="btn btn-line" :href="tel">{{ words.call(phone) }}</a>
        </div>
      </div>
    </div>
  </header>
</template>
