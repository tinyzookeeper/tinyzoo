<script setup lang="ts">
// Večer's place: a column with the address and the ways there, beside the photograph of the
// place with a second one laid over its corner.
const props = defineProps<{ block: BlockOf<'place'>; first?: boolean; anchor?: string }>()
const { settings, words } = await useWedding()
const photos = computed(() => placePhotos(props.block, 'vecer'))
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28 pb-24 lg:pb-36">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-14 items-start">
      <div :class="photos.length ? 'lg:col-span-5' : 'lg:col-span-8'">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6">{{ tidyText(block.text) }}</p>

        <div v-if="settings?.address || settings?.mapUrl" class="mt-10 pt-7 border-t border-line">
          <p class="label text-quiet">{{ words.address }}</p>
          <p v-if="settings.address" class="text-ink text-[1.7rem] leading-tight mt-2">{{ tidyText(settings.address) }}</p>
          <p v-if="settings.coordinates" class="label text-quiet mt-3">{{ settings.coordinates }}</p>
          <a v-if="settings.mapUrl" class="tlink label mt-3" :href="settings.mapUrl" target="_blank" rel="noopener">{{ words.openMap }} <UIcon name="i-lucide-arrow-up-right" class="size-4" aria-hidden="true" /></a>
        </div>

        <dl v-if="block.notes.length" class="mt-8">
          <div v-for="(n, i) in block.notes" :key="n.id" class="border-t border-line" :class="i === block.notes.length - 1 ? 'pt-7' : 'py-7'">
            <dt class="label text-brand">{{ n.label }}</dt>
            <dd class="mt-3">
              {{ tidyText(n.text) }}
              <span v-if="n.firstValue || n.secondValue" class="flex flex-wrap gap-x-10 gap-y-2 mt-5 text-ink">
                <span v-if="n.firstValue"><span class="label text-quiet block">{{ n.firstLabel }}</span><span class="font-light text-[1.9rem] leading-tight">{{ tidyText(n.firstValue) }}</span></span>
                <span v-if="n.secondValue"><span class="label text-quiet block">{{ n.secondLabel }}</span><span class="font-light text-[1.9rem] leading-tight">{{ tidyText(n.secondValue) }}</span></span>
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div v-if="photos.length" class="lg:col-span-6 lg:col-start-7 lg:sticky lg:top-10">
        <figure class="zoom aspect-[3/2]"><CmsImage :media="photos[0]!.image" sizes="(min-width: 1024px) 36rem, 100vw" /></figure>
        <div v-if="photos[1]" class="flex items-end gap-5 sm:gap-8 -mt-10 sm:-mt-20 pr-4 sm:pr-8">
          <p class="flex-1 italic text-[1.0625rem] leading-snug pb-1">{{ tidyText(photos[1].caption) }}</p>
          <figure class="w-[58%] shrink-0 relative border-[10px] border-night">
            <div class="aspect-[4/5]"><CmsImage :media="photos[1].image" sizes="(min-width: 1024px) 20rem, 58vw" class="w-full h-full object-cover" /></div>
          </figure>
        </div>
      </div>
    </div>
  </section>
</template>
