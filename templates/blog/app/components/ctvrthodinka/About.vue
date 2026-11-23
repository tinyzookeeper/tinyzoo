<script setup lang="ts">
// Čtvrthodinka's "about": the first sentence set bold and the rest as a standfirst on the left,
// support, advertising and the way to reach the editors on the right.
const props = defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string }>()
const { settings, words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const sentences = computed(() => firstSentence(props.block.text))
const phone = computed(() => settings.value?.phone?.replace(/ /g, ' '))
</script>

<template>
  <section :id="anchor" class="bg-panel" :aria-labelledby="`${anchor ?? 'about'}-h`">
    <div class="wrap grid gap-x-12 gap-y-12 py-14 lg:grid-cols-12 lg:py-24">
      <div class="lg:col-span-6">
        <component :is="tag" :id="`${anchor ?? 'about'}-h`" class="meta font-bold uppercase tracking-[0.08em]"><KitMarked :text="block.heading" plain /></component>
        <p class="mt-4 text-[1.7rem] font-extrabold leading-[1.14] tracking-[-0.03em] lg:text-[2.5rem]">{{ tidyText(sentences[0]) }}</p>
        <p v-if="sentences[1]" class="stand mt-5 max-w-[34rem] text-[1.3rem] lg:text-[1.5rem]">{{ tidyText(sentences[1]) }}</p>
      </div>
      <div class="grid content-start gap-x-10 gap-y-9 sm:grid-cols-2 lg:col-span-6">
        <div v-if="block.supportHeading" class="sm:col-span-2">
          <h3 class="text-[1.4rem] font-extrabold tracking-[-0.02em]">{{ block.supportHeading }}</h3>
          <p class="mt-2 max-w-[34rem] text-[1.02rem] font-medium leading-[1.5]">{{ tidyText(block.supportText) }}</p>
          <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <NuxtLink v-if="block.supportLabel && block.supportUrl" :to="siteHref(block.supportUrl)" class="inline-flex h-12 items-center rounded-full bg-ink px-6 font-bold text-ground transition-transform hover:-translate-y-0.5">{{ block.supportLabel }}</NuxtLink>
            <p v-if="settings?.bankAccount" class="meta">{{ words.account }} {{ settings.bankAccount }}</p>
          </div>
        </div>
        <div v-if="block.adHeading" class="border-t border-rule pt-6">
          <h3 class="text-[1.4rem] font-extrabold tracking-[-0.02em]">{{ block.adHeading }}</h3>
          <p class="mt-2 text-[1.02rem] font-medium leading-[1.5]">{{ tidyText(block.adText) }}</p>
        </div>
        <div v-if="block.writeHeading" class="border-t border-rule pt-6">
          <h3 class="text-[1.4rem] font-extrabold tracking-[-0.02em]">{{ block.writeHeading }}</h3>
          <p class="mt-2 text-[1.02rem] font-medium leading-[1.5]">{{ tidyText(block.writeText) }}</p>
          <p class="mt-1 font-bold">
            <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="inline-flex h-11 items-center text-brand"><span class="lift">{{ settings.email }}</span></a><br v-if="settings?.email && settings?.phone"><a v-if="settings?.phone" :href="telHref(settings.phone)" class="inline-flex h-11 items-center"><span class="lift">{{ phone }}</span></a>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
