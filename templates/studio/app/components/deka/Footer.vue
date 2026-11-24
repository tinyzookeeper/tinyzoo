<script setup lang="ts">
// Deka's footer: the name with its mark, a line about the studio, and the address, the contacts
// and the hours in columns with headings in the display type.
const { nav } = await useSite()
const { settings, words, town, hours, legalLine } = await useStudio()
const legal = computed(() => menuLinks(nav.value?.legal))
</script>

<template>
  <footer class="wrap pt-14 pb-10">
    <div class="grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-4">
        <p class="flex items-center gap-3 text-ink"><DekaWordmark large /></p>
        <p v-if="settings?.about" class="mt-4 max-w-[20rem] text-[0.975rem]">{{ tidyText(settings.about) }}</p>
      </div>
      <div class="lg:col-span-3 text-[0.975rem]">
        <p class="font-display font-bold text-ink text-[1.1rem]">{{ words.studioLabel }}</p>
        <p class="mt-3"><template v-if="settings?.street">{{ settings.street }}<br></template><template v-if="town">{{ town }}<br></template><template v-if="settings?.addressNote">{{ settings.addressNote }}</template></p>
      </div>
      <div class="lg:col-span-3 text-[0.975rem]">
        <p class="font-display font-bold text-ink text-[1.1rem]">{{ words.contact }}</p>
        <p class="mt-3"><a v-if="settings?.phone" class="hover:underline" :href="telHref(settings.phone)">{{ settings.phone }}</a><br v-if="settings?.phone"><a v-if="settings?.email" class="hover:underline" :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
        <p v-if="settings?.instagram || settings?.facebook" class="mt-1 flex gap-5">
          <a v-if="settings.instagram" class="tlink" :href="settings.instagram" target="_blank" rel="noopener">Instagram</a>
          <a v-if="settings.facebook" class="tlink" :href="settings.facebook" target="_blank" rel="noopener">Facebook</a>
        </p>
      </div>
      <div v-if="hours.length" class="lg:col-span-2 text-[0.975rem]">
        <p class="font-display font-bold text-ink text-[1.1rem]">{{ words.hoursTitle }}</p>
        <p class="mt-3"><template v-for="(line, i) in hours" :key="i"><br v-if="i">{{ line }}</template></p>
      </div>
    </div>
    <div class="mt-12 pt-6 border-t border-[var(--rule)] flex flex-wrap justify-between gap-x-8 gap-y-2 text-[0.875rem] text-quiet">
      <p>{{ legalLine }}</p>
      <p v-if="legal.length" class="flex gap-6"><NuxtLink v-for="l in legal" :key="l.id" class="hover:text-ink" :to="l.url">{{ l.label }}</NuxtLink></p>
    </div>
  </footer>
</template>
