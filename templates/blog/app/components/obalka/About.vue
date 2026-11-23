<script setup lang="ts">
// Obálka's "about": the few words set large on the left, support, advertising and the way to
// reach the editors in three short texts on the right.
const props = defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string }>()
const { settings, words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const phone = computed(() => settings.value?.phone?.replace(/ /g, ' '))
</script>

<template>
  <section :id="anchor" class="wrap grid gap-x-14 gap-y-12 py-16 lg:grid-cols-12 lg:py-28" :aria-labelledby="`${anchor ?? 'about'}-h`">
    <div class="lg:col-span-7">
      <component :is="tag" :id="`${anchor ?? 'about'}-h`" class="kicker"><KitMarked :text="block.heading" plain /></component>
      <p class="mt-5 font-display text-[1.75rem] font-light leading-[1.28] tracking-[-0.01em] lg:text-[2.5rem] lg:leading-[1.22]"><KitMarked :text="block.text" :attrs="{ class: 'font-light' }" /></p>
    </div>
    <div class="grid content-start gap-10 lg:col-span-5 lg:pl-6 lg:pt-10">
      <div v-if="block.supportHeading">
        <h3 class="font-display text-[1.6rem] font-light">{{ block.supportHeading }}</h3>
        <p class="mt-2 font-display text-[1.08rem] leading-[1.55]">{{ tidyText(block.supportText) }}</p>
        <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <NuxtLink v-if="block.supportLabel && block.supportUrl" :to="siteHref(block.supportUrl)" class="inline-flex h-12 items-center bg-brand px-6 text-brand-ink transition-opacity hover:opacity-90">{{ block.supportLabel }}</NuxtLink>
          <p v-if="settings?.bankAccount" class="byline text-quiet">{{ words.account }} {{ settings.bankAccount }}</p>
        </div>
      </div>
      <div v-if="block.adHeading" class="border-t border-line pt-8">
        <h3 class="font-display text-[1.6rem] font-light">{{ block.adHeading }}</h3>
        <p class="mt-2 font-display text-[1.08rem] leading-[1.55]">{{ tidyText(block.adText) }}</p>
      </div>
      <div v-if="block.writeHeading" class="border-t border-line pt-8">
        <h3 class="font-display text-[1.6rem] font-light">{{ block.writeHeading }}</h3>
        <p class="mt-2 font-display text-[1.08rem] leading-[1.55]">{{ tidyText(block.writeText) }}</p>
        <p v-if="settings?.email || settings?.phone" class="mt-2 text-[1.05rem]">
          <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="lift inline-flex h-11 items-center text-brand underline decoration-current/40">{{ settings.email }}</a><span v-if="settings?.email && settings?.phone" class="mx-3 text-quiet">·</span><a v-if="settings?.phone" :href="telHref(settings.phone)" class="lift inline-flex h-11 items-center">{{ phone }}</a>
        </p>
      </div>
    </div>
  </section>
</template>
