<script setup lang="ts">
// Soutisk's photographs: a loose collage with one round picture and printed circles over two
// corners. It lays out the first seven photographs (the third one twice on a desktop, in a
// narrow slot, as the design does); a shorter list simply leaves the last places empty.
const props = defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string }>()
const photos = computed(() => props.block.photos.map((p) => p.image))
const at = (i: number) => photos.value[i] ?? null
</script>

<template>
  <section :id="anchor" class="bg-paper pb-24 sm:pb-36" :class="first ? 'pt-10' : ''">
    <div class="wrap">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        </div>
        <a v-if="block.linkLabel && block.linkUrl" :href="siteHref(block.linkUrl)" class="ulink" :target="isExternal(block.linkUrl) ? '_blank' : undefined" :rel="isExternal(block.linkUrl) ? 'noopener' : undefined">{{ block.linkLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></a>
      </div>
      <div class="mt-10 grid grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-5 items-start">
        <div v-if="at(0)" class="relative col-span-2 lg:col-span-7">
          <CmsImage :media="at(0)" sizes="(min-width: 1024px) 46rem, 100vw" class="w-full aspect-[3/2] object-cover rounded-[28px]" />
          <span class="ink-m absolute -right-3 -top-5 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-c1" aria-hidden="true" />
        </div>
        <CmsImage v-if="at(1)" :media="at(1)" sizes="(min-width: 1024px) 32rem, 50vw" class="lg:col-span-5 lg:row-span-2 w-full aspect-[4/5] lg:aspect-auto lg:h-full object-cover rounded-[28px]" />
        <CmsImage v-if="at(2)" :media="at(2)" sizes="50vw" class="lg:hidden w-full aspect-[4/5] object-cover rounded-[28px]" />
        <CmsImage v-if="at(3)" :media="at(3)" sizes="(min-width: 1024px) 20rem, 50vw" class="lg:col-span-3 w-full aspect-square object-cover rounded-full" />
        <CmsImage v-if="at(4)" :media="at(4)" sizes="(min-width: 1024px) 26rem, 50vw" class="lg:col-span-4 w-full aspect-square lg:aspect-[4/3] object-cover rounded-[28px]" />
        <div v-if="at(5)" class="relative col-span-2 lg:col-span-5">
          <CmsImage :media="at(5)" sizes="(min-width: 1024px) 32rem, 100vw" class="w-full aspect-[3/2] lg:aspect-auto lg:h-[21rem] object-cover rounded-[28px]" />
          <span class="ink-m absolute -left-3 -bottom-5 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-c2" aria-hidden="true" />
        </div>
        <CmsImage v-if="at(2)" :media="at(2)" alt="" sizes="20rem" class="hidden lg:block lg:col-span-3 w-full h-[21rem] object-cover rounded-[28px]" />
        <CmsImage v-if="at(6)" :media="at(6)" sizes="(min-width: 1024px) 26rem, 100vw" class="col-span-2 lg:col-span-4 w-full aspect-[3/2] lg:aspect-auto lg:h-[21rem] object-cover rounded-[28px]" />
      </div>
      <p v-if="block.credit" class="mt-5 text-quiet">{{ block.credit }}</p>
    </div>
  </section>
</template>
