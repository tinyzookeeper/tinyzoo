<script setup lang="ts">
// Časomíra's header: a lit dot, the name and the edition on the left, the menu and the
// registration button on the right, laid over whatever opens the page (the opening's
// photograph reaches up behind it). Below a desktop's width the menu folds behind a button and
// opens as a full-screen list, each link with a small figure from the page's own facts.
const { nav } = await useSite()
const { words, edition, cta, name } = await useEvent()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
// "Skip to the content": the frame's <main> has no address of its own, so the link moves the focus there.
function skip() {
  const main = document.querySelector<HTMLElement>('main')
  main?.setAttribute('tabindex', '-1')
  main?.focus()
}

// The small figure beside a link of the phone's menu: what the section it leads to holds.
const [tracks, items, results, fees] = await Promise.all([useTracks(), useProgramme(), useResults(), useFees()])
function hint(url: string): string {
  const section = url.split('#')[1]
  if (section === words.value.anchors.routes) {
    const km = tracks.value.map((t) => /^(\d+)\s*km$/.exec(t.length ?? '')?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b)
    return km.length ? `${km.join(' / ')} km` : ''
  }
  if (section === words.value.anchors.programme) return items.value.length ? `${items.value[0]!.time}–${items.value[items.value.length - 1]!.time}` : ''
  if (section === words.value.anchors.fees) return fees.cheapest.value != null ? words.value.from(formatPrice(fees.cheapest.value)) : ''
  if (section === words.value.anchors.results) return results.value.length ? String(Math.max(...results.value.map((r) => r.year))) : ''
  return ''
}
</script>

<template>
  <header class="absolute inset-x-0 top-0 z-30">
    <a href="#obsah" @click.prevent="skip" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-led focus:text-led-ink focus:px-4 focus:py-3">{{ words.skip }}</a>
    <div class="wrap flex items-center justify-between gap-6 h-[4.75rem]">
      <NuxtLink to="/" class="flex items-center gap-2.5 min-h-11" :aria-label="words.toTop(name)">
        <CasomiraWordmark />
        <span v-if="edition" class="mono text-quiet hidden sm:inline pl-2">{{ edition }}</span>
      </NuxtLink>
      <nav class="hidden lg:flex items-center gap-7 mono" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-2">
        <a v-if="cta" :href="cta.url" class="btn !min-h-11 !px-4 !text-[0.95rem] hidden sm:inline-flex">{{ cta.label }} <UIcon name="i-lucide-arrow-up-right" class="ico" aria-hidden="true" /></a>
        <button type="button" class="lg:hidden inline-flex items-center justify-center gap-2 h-11 px-3 rounded-[3px] border border-quiet mono bg-bg/60 cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="text-xl" aria-hidden="true" />{{ words.menu }}
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="lg:hidden fixed inset-0 z-40 bg-bg overflow-y-auto">
      <div class="wrap flex items-center justify-between h-[4.75rem]">
        <span aria-hidden="true"><CasomiraWordmark /></span>
        <button type="button" class="inline-flex items-center justify-center gap-2 h-11 px-3 rounded-[3px] border border-quiet mono cursor-pointer" @click="menu.hide()"><UIcon name="i-lucide-x" class="text-xl" aria-hidden="true" />{{ words.close }}</button>
      </div>
      <nav class="wrap pb-10" :aria-label="words.mobileMenu">
        <NuxtLink v-for="(l, i) in links" :key="l.id" class="flex items-baseline justify-between min-h-[60px] py-3 border-t border-line text-3xl font-extrabold tracking-[-0.03em]" :class="i === links.length - 1 ? 'border-b' : ''" :to="l.url" @click="menu.hide()">
          {{ l.label }} <span v-if="hint(l.url)" class="mono text-quiet font-normal">{{ hint(l.url) }}</span>
        </NuxtLink>
        <a v-if="cta" :href="cta.url" class="btn w-full mt-6">{{ cta.label }} <UIcon name="i-lucide-arrow-up-right" class="ico" aria-hidden="true" /></a>
      </nav>
    </div>
  </header>
</template>
