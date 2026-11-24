<script setup lang="ts">
// Paragon: the name and the menu on the desk, under a dashed rule like a tear-off line. Below a
// desktop's width the menu folds behind a button and opens as a sheet of paper.
const { nav } = await useSite()
const { name, address, phone, tel, words, state, openText } = await useRestaurant()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
const w = computed(() => words.value.paragon)
const open = computed(() => openText(w.value.open))
const fold = computed(() => (name.value.length > 24 ? { nav: 'hidden', button: '' } : name.value.length > 12 ? { nav: 'hidden xl:flex', button: 'xl:hidden' } : { nav: 'hidden lg:flex', button: 'lg:hidden' }))
const reserve = `/#${anchorOf('reservation')}`
</script>

<template>
  <header class="wrap">
    <div class="flex items-center justify-between gap-6 py-4 lg:py-5 border-b-2 border-dashed rule">
      <NuxtLink to="/" class="flex items-baseline gap-3 min-w-0" :aria-label="words.toTop(name)"><ParagonWordmark mark tagline /></NuxtLink>
      <nav class="items-center gap-8 whitespace-nowrap shrink-0" :class="fold.nav" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        <NuxtLink class="btn ml-1" :to="reserve">{{ w.reserve }}</NuxtLink>
      </nav>
      <button type="button" class="btn !min-h-12 !px-4 cursor-pointer shrink-0" :class="fold.button" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()"><UIcon name="i-lucide-menu" class="text-lg" aria-hidden="true" /> {{ words.menu }}</button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto" :class="fold.button" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap flex items-center justify-between py-4">
        <span aria-hidden="true"><ParagonWordmark size="panel" /></span>
        <button type="button" class="btn btn-plain !min-h-12 !px-4 cursor-pointer" @click="menu.hide()"><UIcon name="i-lucide-x" class="text-lg" aria-hidden="true" /> {{ words.close }}</button>
      </div>
      <div class="wrap pb-10">
        <nav class="sheet mt-3 px-5 pt-5 pb-2 flex flex-col" :aria-label="words.mobileMenu">
          <NuxtLink v-for="(l, i) in links" :key="l.id" class="h text-[1.9rem] py-3.5" :class="i === links.length - 1 ? '' : 'border-b rule'" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        </nav>
        <p v-if="open" class="mt-7" data-open :data-state="state?.open ? 'open' : 'closed'"><strong>{{ state?.open ? w.stampOpen : w.stampClosed }}</strong>, <span data-open-text>{{ open }}</span></p>
        <p v-if="address">{{ address }}</p>
        <div class="mt-5 grid gap-3">
          <NuxtLink class="btn" :to="reserve" @click="menu.hide()">{{ w.reserve }}</NuxtLink>
          <a v-if="phone" class="btn btn-plain" :href="tel">{{ words.call(phone) }}</a>
        </div>
      </div>
    </div>
  </header>
</template>
