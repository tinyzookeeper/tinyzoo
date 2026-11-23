<script setup lang="ts">
// Ode dveří's hosts: a rounded portrait beside who they are in a few words, with the phone and
// a button to write.
defineProps<{ block: BlockOf<'hosts'>; first?: boolean; anchor?: string }>()
const { settings, tel } = await useStay()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-8 items-center">
      <div v-if="block.image" class="lg:col-span-4 lg:col-start-2 max-w-sm lg:max-w-none"><div class="ph aspect-[4/5] !rounded-[28px]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 28rem, 100vw" /></div></div>
      <div :class="block.image ? 'lg:col-span-6 lg:col-start-7' : 'lg:col-span-8 lg:col-start-3'">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.lead" class="mt-6 text-xl leading-relaxed text-ink max-w-[46ch]">{{ tidyText(block.lead) }}</p>
        <p v-if="block.text" class="mt-4 text-quiet max-w-[58ch]">{{ tidyText(block.text) }}</p>
        <div class="mt-7 flex flex-wrap gap-3">
          <a v-if="settings?.phone" :href="tel" class="btn btn-soft num"><UIcon name="i-lucide-phone" class="size-[1em] text-brand" aria-hidden="true" />{{ settings.phone }}</a>
          <NuxtLink v-if="block.ctaLabel && block.ctaUrl" :to="siteHref(block.ctaUrl)" class="btn">{{ block.ctaLabel }}</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
