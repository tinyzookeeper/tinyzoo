<script setup lang="ts">
// Oznámení's gift list: the contribution on a tinted panel, then a ruled list with
// "Reserve" or a quiet "Reserved".
import type { Gift } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'gifts'>; first?: boolean; anchor?: string; gifts: Gift[] }>()
const words = useSiteWords()
const wishes = useGiftReserve(() => props.gifts)
</script>

<template>
  <section :id="anchor" class="wrap py-20 lg:py-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-12 items-start">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.6rem] lg:text-[3.4rem] leading-[1.08] mt-4"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5">{{ tidyText(block.text) }}</p>
        <figure v-if="block.image" class="mt-9 max-w-[17rem]">
          <div class="frame aspect-square"><CmsImage :media="block.image" sizes="26rem" /></div>
        </figure>
        <p v-if="block.imageCaption" class="mt-5 italic">{{ tidyText(block.imageCaption) }}</p>
      </div>

      <div class="lg:col-span-8">
        <div v-if="wishes.open.value" class="bg-tint px-6 sm:px-9 py-8 grid sm:grid-cols-[1fr_auto] gap-x-8 gap-y-5 items-center">
          <div>
            <p v-if="block.openLabel" class="label text-brand">{{ block.openLabel }}</p>
            <h3 class="text-[1.9rem] leading-tight mt-2">{{ tidyText(wishes.open.value.name) }}</h3>
            <p v-if="wishes.open.value.description" class="mt-2 text-ink">{{ tidyText(wishes.open.value.description) }}</p>
          </div>
          <a v-if="wishes.open.value.buttonLabel && wishes.open.value.buttonUrl" class="btn label" :href="siteHref(wishes.open.value.buttonUrl)">{{ wishes.open.value.buttonLabel }}</a>
        </div>

        <ul v-if="wishes.list.value.length" class="border-b border-line mt-2">
          <li v-for="g in wishes.list.value" :key="g.id" :data-gift="g.id" :data-reserved="wishes.isReserved(g)" class="grid sm:grid-cols-[1fr_6.5rem_10.5rem] items-center gap-x-6 gap-y-2 py-5 border-t border-line">
            <div>
              <h3 class="gift-name text-[1.45rem] leading-tight" :class="{ 'is-reserved': wishes.isReserved(g) }">{{ tidyText(g.name) }}</h3>
              <p v-if="g.description" class="text-[0.95rem] italic">{{ tidyText(g.description) }}</p>
            </div>
            <p class="text-ink"><template v-if="g.price != null">{{ formatPrice(g.price) }}&nbsp;Kč</template></p>
            <div class="sm:text-right">
              <span v-if="wishes.isReserved(g)" class="label text-quiet inline-flex items-center gap-2 min-h-[44px]"><UIcon name="i-lucide-check" class="size-4" aria-hidden="true" /> {{ words.reserved }}</span>
              <button v-else type="button" data-gift-reserve class="btn btn-line label !min-h-[44px] !px-5" :disabled="wishes.busy.value === g.id" @click="wishes.reserve(g)">{{ words.reserve }}</button>
              <p v-if="wishes.failed.value === g.id" class="text-[0.9rem] mt-1" role="alert">{{ words.reserveFailed }}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
