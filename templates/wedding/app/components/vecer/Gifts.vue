<script setup lang="ts">
// Večer's gift list: the contribution in a champagne outline, then a ruled list with
// "Reserve" or a quiet "Reserved", on a panel.
import type { Gift } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'gifts'>; first?: boolean; anchor?: string; gifts: Gift[] }>()
const words = useSiteWords()
const wishes = useGiftReserve(() => props.gifts)
</script>

<template>
  <section :id="anchor" class="bg-panel">
    <div class="wrap py-20 lg:py-32 grid lg:grid-cols-12 gap-x-12 gap-y-12 items-start">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6">{{ tidyText(block.text) }}</p>
        <figure v-if="block.image" class="flex items-center gap-6 mt-10">
          <div class="zoom aspect-square w-[8.5rem] shrink-0"><CmsImage :media="block.image" sizes="14rem" /></div>
          <figcaption v-if="block.imageCaption" class="italic text-[1.0625rem] leading-snug">{{ tidyText(block.imageCaption) }}</figcaption>
        </figure>
      </div>

      <div class="lg:col-span-7 lg:col-start-6">
        <div v-if="wishes.open.value" class="border border-brand/45 px-6 sm:px-10 py-9 grid sm:grid-cols-[1fr_auto] gap-x-9 gap-y-6 items-center">
          <div>
            <p v-if="block.openLabel" class="label text-brand">{{ block.openLabel }}</p>
            <h3 class="text-[1.85rem] leading-tight mt-2">{{ tidyText(wishes.open.value.name) }}</h3>
            <p v-if="wishes.open.value.description" class="mt-3">{{ tidyText(wishes.open.value.description) }}</p>
          </div>
          <a v-if="wishes.open.value.buttonLabel && wishes.open.value.buttonUrl" class="btn label" :href="siteHref(wishes.open.value.buttonUrl)">{{ wishes.open.value.buttonLabel }}</a>
        </div>

        <ul v-if="wishes.list.value.length" class="mt-5">
          <li v-for="g in wishes.list.value" :key="g.id" :data-gift="g.id" :data-reserved="wishes.isReserved(g)" class="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_6.5rem_10.5rem] items-center gap-x-6 gap-y-1 py-6 border-b border-line">
            <div class="max-sm:col-span-2">
              <h3 class="gift-name text-[1.5rem] leading-tight" :class="{ 'is-reserved': wishes.isReserved(g) }">{{ tidyText(g.name) }}</h3>
              <p v-if="g.description" class="italic text-[1.0625rem] leading-snug mt-1">{{ tidyText(g.description) }}</p>
            </div>
            <p class="text-ink"><template v-if="g.price != null">{{ formatPrice(g.price) }}&nbsp;Kč</template></p>
            <div class="text-right">
              <span v-if="wishes.isReserved(g)" class="label text-quiet inline-flex items-center gap-2 min-h-[46px]"><UIcon name="i-lucide-check" class="size-4" aria-hidden="true" /> {{ words.reserved }}</span>
              <button v-else type="button" data-gift-reserve class="btn btn-line label !min-h-[46px] !px-5" :disabled="wishes.busy.value === g.id" @click="wishes.reserve(g)">{{ words.reserve }}</button>
              <p v-if="wishes.failed.value === g.id" class="text-[0.95rem] mt-1" role="alert">{{ words.reserveFailed }}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
