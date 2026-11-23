<script setup lang="ts">
// Šachovnice's products and gift voucher: two halves under a heavy line, the names in one line
// with a square between them, and the voucher in the brand colour with its amounts as tiles.
defineProps<{ block: BlockOf<'brands'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="border-t-2 border-ink grid lg:grid-cols-2">
    <div class="px-5 md:px-10 lg:pl-[max(40px,calc((100vw-1280px)/2+40px))] py-14 md:py-20 border-ink" :class="block.voucherHeading ? 'lg:border-r-2' : 'lg:col-span-2'">
      <component :is="first ? 'h1' : 'h2'" class="tag">{{ tidyText(block.heading) }}</component>
      <p v-if="block.names.length" class="mt-6 font-display font-extrabold text-[26px] sm:text-[36px] leading-[1.25] tracking-[-0.02em]">
        <template v-for="(n, i) in block.names" :key="n.id"><template v-if="i">{{ ' ' }}<span class="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-brand align-middle" aria-hidden="true" />{{ ' ' }}</template>{{ n.name }}</template>
      </p>
      <div class="mt-8 grid grid-cols-[112px_1fr] sm:grid-cols-[160px_1fr] gap-5 sm:gap-7 items-start">
        <div class="aspect-square border-2 border-ink overflow-hidden"><CmsImage v-if="block.image" :media="block.image" sizes="160px" class="w-full h-full object-cover" /></div>
        <p v-if="block.text" class="max-w-[26rem]">{{ tidyText(block.text) }}</p>
      </div>
    </div>
    <div v-if="block.voucherHeading" class="bg-brand text-brand-ink px-5 md:px-10 lg:pr-[max(40px,calc((100vw-1280px)/2+40px))] py-14 md:py-20 border-t-2 lg:border-t-0 border-ink">
      <p v-if="block.voucherEyebrow" class="tag">{{ block.voucherEyebrow }}</p>
      <h2 class="mt-5" :class="byLength(block.voucherHeading, [[12, 'text-[40px] leading-[1] md:text-[56px]']], 'text-[30px] leading-[1.05] md:text-[40px]')">{{ tidyText(block.voucherHeading) }}</h2>
      <p v-if="block.voucherText" class="mt-5 max-w-[28rem] text-[18px] font-semibold">{{ tidyText(block.voucherText) }}</p>
      <ul v-if="block.amounts.length" class="mt-8 grid grid-cols-3 max-w-[30rem] border-l-2 border-t-2 border-ink font-display font-extrabold text-[18px] sm:text-[24px]">
        <li v-for="(a, i) in block.amounts" :key="a.id" class="aspect-[4/3] border-r-2 border-b-2 border-ink flex items-center justify-center" :class="i === 1 ? 'bg-ink text-paper' : 'bg-paper text-ink'">{{ formatPrice(a.amount ?? 0) }}</li>
      </ul>
      <template v-if="block.voucherLabel && block.voucherUrl">
        <a v-if="isExternal(block.voucherUrl) || block.voucherUrl.startsWith('mailto:')" :href="block.voucherUrl" class="btn btn-ink mt-8">{{ block.voucherLabel }}</a>
        <NuxtLink v-else :to="siteHref(block.voucherUrl)" class="btn btn-ink mt-8">{{ block.voucherLabel }}</NuxtLink>
      </template>
    </div>
  </section>
</template>
