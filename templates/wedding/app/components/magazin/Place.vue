<script setup lang="ts">
// Magazín's place: a large photograph beside the address and the link to a map, the ways
// there as three columns under a strong rule.
const props = defineProps<{ block: BlockOf<'place'>; first?: boolean; anchor?: string }>()
const { settings, words } = await useWedding()
const photo = computed(() => placePhotos(props.block, 'magazin')[0] ?? null)
</script>

<template>
  <section :id="anchor" class="border-t border-line">
    <div class="wrap pt-24 lg:pt-36 pb-24 lg:pb-36">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10 items-center">
        <figure v-if="photo" class="lg:col-span-7 zoom aspect-[3/2]"><CmsImage :media="photo.image" sizes="(min-width: 1024px) 44rem, 100vw" /></figure>
        <div :class="photo ? 'lg:col-span-4 lg:col-start-9' : 'lg:col-span-7'">
          <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
          <p v-if="block.text" class="mt-6">{{ tidyText(block.text) }}</p>
          <div v-if="settings?.address || settings?.mapUrl" class="mt-8 pt-6 border-t border-line">
            <p class="label text-quiet">{{ words.address }}</p>
            <p v-if="settings.address" class="serif text-ink text-[1.6rem] leading-[1.25] mt-2">{{ tidyText(settings.address) }}</p>
            <p v-if="settings.coordinates" class="text-[0.95rem] text-quiet mt-1">{{ settings.coordinates }}</p>
            <a v-if="settings.mapUrl" class="tlink label mt-3" :href="settings.mapUrl" target="_blank" rel="noopener">{{ words.openMap }} <UIcon name="i-lucide-arrow-up-right" class="size-4" aria-hidden="true" /></a>
          </div>
        </div>
      </div>

      <dl v-if="block.notes.length" class="grid gap-x-10 mt-16 lg:mt-24 border-t border-ink" :class="block.notes.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'">
        <div v-for="(n, i) in block.notes" :key="n.id" class="py-7 md:pt-7 md:pb-0" :class="i < block.notes.length - 1 ? 'max-md:border-b max-md:border-line' : ''">
          <dt class="label text-brand">{{ n.label }}</dt>
          <dd class="mt-3">
            {{ tidyText(n.text) }}
            <span v-if="n.firstValue || n.secondValue" class="flex flex-wrap gap-x-9 gap-y-2 mt-5 text-ink">
              <span v-if="n.firstValue"><span class="label text-quiet block">{{ n.firstLabel }}</span><span class="serif text-[1.9rem] leading-tight">{{ tidyText(n.firstValue) }}</span></span>
              <span v-if="n.secondValue"><span class="label text-quiet block">{{ n.secondLabel }}</span><span class="serif text-[1.9rem] leading-tight">{{ tidyText(n.secondValue) }}</span></span>
            </span>
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
