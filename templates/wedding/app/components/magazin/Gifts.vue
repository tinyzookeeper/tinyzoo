<script setup lang="ts">
// Magazín's gift list: a large photograph beside the list, the contribution on a tinted
// block, then ruled rows with "Reserve" or a quiet "Reserved".
import type { Gift } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'gifts'>; first?: boolean; anchor?: string; gifts: Gift[] }>()
const words = useSiteWords()
const wishes = useGiftReserve(() => props.gifts)
</script>

<template>
  <section :id="anchor" class="wrap py-24 lg:py-36">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-12 items-start">
      <figure v-if="block.image" class="lg:col-span-5 lg:sticky lg:top-12 max-lg:order-2 max-w-[30rem] lg:max-w-none">
        <div class="zoom aspect-square"><CmsImage :media="block.image" sizes="(min-width: 1024px) 32rem, 100vw" /></div>
        <figcaption v-if="block.imageCaption" class="cap">{{ tidyText(block.imageCaption) }}</figcaption>
      </figure>

      <div :class="block.image ? 'lg:col-span-6 lg:col-start-7' : 'lg:col-span-8 lg:col-start-3'">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-[34rem]">{{ tidyText(block.text) }}</p>

        <div v-if="wishes.open.value" class="bg-tint px-6 sm:px-9 py-8 mt-10">
          <p v-if="block.openLabel" class="label text-brand">{{ block.openLabel }}</p>
          <h3 class="text-[1.9rem] leading-tight mt-2">{{ tidyText(wishes.open.value.name) }}</h3>
          <p v-if="wishes.open.value.description" class="mt-3 text-ink">{{ tidyText(wishes.open.value.description) }}</p>
          <a v-if="wishes.open.value.buttonLabel && wishes.open.value.buttonUrl" class="btn label mt-6 max-sm:w-full" :href="siteHref(wishes.open.value.buttonUrl)">{{ wishes.open.value.buttonLabel }}</a>
        </div>

        <ul v-if="wishes.list.value.length" class="mt-4">
          <li v-for="g in wishes.list.value" :key="g.id" :data-gift="g.id" :data-reserved="wishes.isReserved(g)" class="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_6.5rem_10rem] items-center gap-x-6 gap-y-1 py-5 border-b border-line">
            <div class="max-sm:col-span-2">
              <h3 class="gift-name text-[1.45rem] leading-tight" :class="{ 'is-reserved': wishes.isReserved(g) }">{{ tidyText(g.name) }}</h3>
              <p v-if="g.description" class="text-[0.98rem] mt-0.5">{{ tidyText(g.description) }}</p>
            </div>
            <p class="text-ink"><template v-if="g.price != null">{{ formatPrice(g.price) }}&nbsp;Kč</template></p>
            <div class="text-right">
              <span v-if="wishes.isReserved(g)" class="label text-quiet inline-flex items-center gap-2 min-h-[46px]"><UIcon name="i-lucide-check" class="size-4" aria-hidden="true" /> {{ words.reserved }}</span>
              <button v-else type="button" data-gift-reserve class="btn btn-line label !min-h-[46px] !px-5" :disabled="wishes.busy.value === g.id" @click="wishes.reserve(g)">{{ words.reserve }}</button>
              <p v-if="wishes.failed.value === g.id" class="text-[0.9rem] mt-1" role="alert">{{ words.reserveFailed }}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
