<script setup lang="ts">
// Tabule's footer: dark, with the address, the contacts and the hours in mono columns, and the
// studio's name set across the whole width at the bottom, cut by the page's edge.
const { nav } = await useSite()
const { settings, name, words, town, hours, legalLine } = await useStudio()
const legal = computed(() => menuLinks(nav.value?.legal))
// The name across the page: its size steps down so a longer name still fits.
const size = computed(() => byLength(name.value, [[7, 'text-[13.9vw]'], [11, 'text-[9vw]'], [18, 'text-[5.6vw]']], 'text-[3.4vw]'))
</script>

<template>
  <footer class="on-dark bg-ink text-paper overflow-hidden">
    <div class="wrap pt-14 lg:pt-20">
      <div class="grid grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-10">
        <p v-if="settings?.about" class="col-span-2 lg:col-span-4 max-w-[22rem] text-[1.15rem] leading-snug">{{ tidyText(settings.about) }}</p>
        <div class="lg:col-span-3"><p class="mono opacity-60">{{ words.studioLabel }}</p><p class="mt-3"><template v-if="settings?.street">{{ settings.street }}<br></template><template v-if="town">{{ town }}<br></template><template v-if="settings?.addressNote">{{ settings.addressNote }}</template></p></div>
        <div class="lg:col-span-3">
          <p class="mono opacity-60">{{ words.contact }}</p>
          <p class="mt-3">
            <a v-if="settings?.phone" class="hover:text-accent" :href="telHref(settings.phone)">{{ settings.phone }}</a><br v-if="settings?.phone">
            <a v-if="settings?.email" class="hover:text-accent" :href="`mailto:${settings.email}`">{{ settings.email }}</a><br v-if="settings?.email">
            <a v-if="settings?.instagram" class="hover:text-accent" :href="settings.instagram" target="_blank" rel="noopener">Instagram</a><template v-if="settings?.instagram && settings?.facebook"> · </template><a v-if="settings?.facebook" class="hover:text-accent" :href="settings.facebook" target="_blank" rel="noopener">Facebook</a>
          </p>
        </div>
        <div v-if="hours.length" class="col-span-2 lg:col-span-2"><p class="mono opacity-60">{{ words.hoursTitle }}</p><p class="mt-3"><template v-for="(line, i) in hours" :key="i"><br v-if="i">{{ line }}</template></p></div>
      </div>
      <p class="mono mt-14 pt-5 border-t border-paper/25 flex flex-wrap justify-between gap-x-8 gap-y-2 opacity-70">
        <span>{{ legalLine }}</span>
        <span v-if="legal.length" class="flex gap-6"><NuxtLink v-for="l in legal" :key="l.id" class="hover:text-accent" :to="l.url">{{ l.label }}</NuxtLink></span>
      </p>
    </div>
    <p class="display mt-8 leading-[0.8] text-center whitespace-nowrap select-none" :class="size" aria-hidden="true">{{ name }}</p>
  </footer>
</template>
