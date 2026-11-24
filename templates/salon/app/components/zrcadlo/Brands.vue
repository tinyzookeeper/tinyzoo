<script setup lang="ts">
// Zrcadlo's products and gift voucher: two rounded panels side by side, the names in one line
// with a dot between them, and the voucher on the accent colour with its amounts in rings.
defineProps<{ block: BlockOf<'brands'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="wrap pb-20 md:pb-28">
    <div class="grid lg:grid-cols-12 gap-6">
      <div class="rounded-[36px] md:rounded-[48px] bg-surface p-7 md:p-14 flex flex-col" :class="block.voucherHeading ? 'lg:col-span-7' : 'lg:col-span-12'">
        <component :is="first ? 'h1' : 'h2'" class="label font-sans">{{ tidyText(block.heading) }}</component>
        <p v-if="block.names.length" class="mt-6 font-display text-ink text-[30px] leading-[1.3] md:text-[42px] md:leading-[1.25]">
          <template v-for="(n, i) in block.names" :key="n.id"><template v-if="i">{{ ' ' }}<span class="text-accent" aria-hidden="true">●</span>{{ ' ' }}</template>{{ n.name }}</template>
        </p>
        <div class="mt-8 lg:mt-auto lg:pt-10 sm:grid sm:grid-cols-[128px_1fr] gap-8 items-center">
          <div v-if="block.image" class="mirror mirror-on-surface aspect-square m-2.5 w-24 sm:w-auto"><CmsImage :media="block.image" sizes="160px" class="w-full h-full object-cover" /></div>
          <p v-if="block.text" class="max-w-[30rem] mt-7 sm:mt-0">{{ tidyText(block.text) }}</p>
        </div>
      </div>
      <div v-if="block.voucherHeading" class="lg:col-span-5 rounded-[36px] md:rounded-[48px] bg-accent text-ink p-7 md:p-14 flex flex-col">
        <p v-if="block.voucherEyebrow" class="text-[12px] font-semibold tracking-[.14em] uppercase">{{ block.voucherEyebrow }}</p>
        <h2 class="mt-4 text-[34px] md:text-[42px] leading-[1.1]">{{ tidyText(block.voucherHeading) }}</h2>
        <p v-if="block.voucherText" class="mt-5">{{ tidyText(block.voucherText) }}</p>
        <ul v-if="block.amounts.length" class="mt-6 flex flex-wrap gap-2 font-display text-[20px]">
          <li v-for="a in block.amounts" :key="a.id" class="px-4 min-h-12 inline-flex items-center rounded-full shadow-[inset_0_0_0_1px_var(--ink)] whitespace-nowrap">{{ kc(a.amount ?? 0, true) }}</li>
        </ul>
        <template v-if="block.voucherLabel && block.voucherUrl">
          <a v-if="isExternal(block.voucherUrl) || block.voucherUrl.startsWith('mailto:')" :href="block.voucherUrl" class="mt-8 lg:mt-auto lg:pt-8 inline-flex items-center gap-2 min-h-11 font-semibold underline underline-offset-4 decoration-1 hover:decoration-2">{{ block.voucherLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></a>
          <NuxtLink v-else :to="siteHref(block.voucherUrl)" class="mt-8 lg:mt-auto lg:pt-8 inline-flex items-center gap-2 min-h-11 font-semibold underline underline-offset-4 decoration-1 hover:decoration-2">{{ block.voucherLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
        </template>
      </div>
    </div>
  </section>
</template>
