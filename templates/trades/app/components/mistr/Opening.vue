<script setup lang="ts">
// Mistr's opening: the heading and the phone number on the left, the owner's photograph with
// a caption on the right.
defineProps<{ block: BlockOf<'opening'>; first?: boolean }>()
const { phone, words } = await useTrades()
</script>

<template>
  <section class="wrap pt-10 md:pt-16">
    <div class="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
      <div class="lg:col-span-7 lg:pt-6">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[2.5rem] sm:text-[3.25rem] lg:text-[4.1rem] leading-[1.03] tracking-[-0.035em] font-bold">{{ tidyText(block.heading) }}</component>
        <p v-if="block.text" class="serif mt-6 max-w-[34rem] md:text-[1.25rem]">{{ tidyText(block.text) }}</p>
        <div class="mt-8 flex flex-col sm:flex-row gap-3">
          <a v-if="phone" :href="phone.href" class="btn btn-brand !min-h-[64px] !px-6 text-[1.5rem] font-bold tabular-nums tracking-[-0.01em]" :aria-label="words.callNumber(phone.text)">
            <UIcon name="i-lucide-phone" class="size-[22px]" aria-hidden="true" /> {{ phone.text }}
          </a>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="siteHref(block.secondaryUrl)" class="btn btn-line !min-h-[64px] !px-6 text-[1.0625rem]">{{ block.secondaryLabel }}</NuxtLink>
        </div>
        <p v-if="block.note" class="mt-5 text-[0.9375rem] max-w-[34rem]"><KitMarked :text="block.note" as="span" :attrs="{ class: 'font-semibold text-ink' }" /></p>
      </div>
      <figure v-if="block.image" class="lg:col-span-5">
        <div class="ph aspect-[4/3] sm:aspect-[3/2] lg:aspect-[4/5]"><CmsImage :media="block.image" eager sizes="(min-width: 1024px) 34rem, (min-width: 640px) 92vw, 100vw" /></div>
        <figcaption v-if="block.imageCaption" class="cap">{{ tidyText(block.imageCaption) }}</figcaption>
      </figure>
    </div>
  </section>
</template>
