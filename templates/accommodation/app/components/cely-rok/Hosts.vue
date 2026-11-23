<script setup lang="ts">
// Celý rok's hosts: a portrait, who they are in a few words, and the times of arrival and
// departure with the phone, all on the raised surface.
defineProps<{ block: BlockOf<'hosts'>; first?: boolean; anchor?: string }>()
const { settings, words, tel } = await useStay()
</script>

<template>
  <section :id="anchor" class="bg-surface">
    <div class="wrap py-20 md:py-24 grid lg:grid-cols-12 gap-x-10 gap-y-10 items-center">
      <div v-if="block.image" class="lg:col-span-4 lg:col-start-2">
        <div class="ph aspect-[4/5] max-w-md"><CmsImage :media="block.image" sizes="(min-width: 1024px) 28rem, 100vw" /></div>
      </div>
      <div :class="block.image ? 'lg:col-span-6 lg:col-start-7' : 'lg:col-span-8 lg:col-start-3'">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.lead" class="mt-6 font-display text-[1.45rem] leading-snug">{{ tidyText(block.lead) }}</p>
        <p v-if="block.text" class="mt-5 text-quiet max-w-[58ch]">{{ tidyText(block.text) }}</p>
        <dl class="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-x-8 num">
          <div v-if="settings?.arrival" class="rule py-4"><dt class="text-sm text-quiet">{{ words.arrival }}</dt><dd class="font-display text-2xl">{{ settings.arrival }}</dd></div>
          <div v-if="settings?.departure" class="rule py-4"><dt class="text-sm text-quiet">{{ words.departure }}</dt><dd class="font-display text-2xl">{{ settings.departure }}</dd></div>
          <div v-if="settings?.phone" class="rule py-4 col-span-2 sm:col-span-1"><dt class="text-sm text-quiet">{{ words.phone }}</dt><dd class="font-display text-2xl"><a :href="tel" class="inline-flex min-h-11 items-center -my-2 hover:text-brand transition-colors">{{ settings.phone }}</a></dd></div>
        </dl>
      </div>
    </div>
  </section>
</template>
