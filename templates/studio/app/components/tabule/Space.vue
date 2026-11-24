<script setup lang="ts">
// Tabule's space: three photographs side by side with hairline gaps, and under them one line of
// facts in mono type. (The design has no heading here: it stays for readers who cannot see the photographs.)
defineProps<{ block: BlockOf<'space'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="on-light">
    <component :is="first ? 'h1' : 'h2'" class="sr-only"><KitMarked :text="block.heading" plain /></component>
    <div class="grid grid-cols-2 lg:grid-cols-12 gap-0.5">
      <div v-if="spacePhotos(block)[0]" class="ph col-span-2 lg:col-span-6 aspect-[3/2] lg:aspect-auto lg:h-[30rem]"><CmsImage :media="spacePhotos(block)[0]!.image" sizes="(min-width: 1024px) 50vw, 100vw" /></div>
      <div v-if="spacePhotos(block)[1]" class="ph lg:col-span-3 aspect-square lg:aspect-auto lg:h-[30rem]"><CmsImage :media="spacePhotos(block)[1]!.image" sizes="(min-width: 1024px) 25vw, 50vw" /></div>
      <div v-if="spacePhotos(block)[2]" class="ph lg:col-span-3 aspect-square lg:aspect-auto lg:h-[30rem]"><CmsImage :media="spacePhotos(block)[2]!.image" sizes="(min-width: 1024px) 25vw, 50vw" /></div>
    </div>
    <div v-if="block.facts.length" class="wrap">
      <p class="mono py-4 border-b-2 border-ink flex flex-wrap gap-x-8 gap-y-1"><span v-for="fact in block.facts" :key="fact.id">{{ [fact.label, fact.value].filter(Boolean).join(' ') }}</span></p>
    </div>
  </section>
</template>
