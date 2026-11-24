<script setup lang="ts">
// Výloha's products and gift voucher: the names in spaced capitals with brass diamonds between
// them, and the voucher in its own panel with the amounts on one line.
defineProps<{ block: BlockOf<'brands'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28 pb-20 md:pb-28">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-14 items-center">
      <div class="min-w-0" :class="block.voucherHeading ? 'lg:col-span-7' : 'lg:col-span-12'">
        <component :is="first ? 'h1' : 'h2'" class="caps text-brass">{{ tidyText(block.heading) }}</component>
        <p v-if="block.names.length" class="mt-6 font-display uppercase text-cream text-[20px] sm:text-[24px] md:text-[34px] leading-[1.5] tracking-[.08em] sm:tracking-[.12em]">
          <template v-for="(n, i) in block.names" :key="n.id"><template v-if="i">{{ ' ' }}<span class="dia mx-2 -translate-y-1.5" aria-hidden="true" />{{ ' ' }}</template>{{ n.name }}</template>
        </p>
        <div class="mt-8 grid grid-cols-[104px_1fr] sm:grid-cols-[150px_1fr] gap-6 items-center">
          <div class="frame"><div class="aspect-square overflow-hidden"><CmsImage v-if="block.image" :media="block.image" sizes="150px" class="w-full h-full object-cover" /></div></div>
          <p v-if="block.text" class="max-w-[30rem] text-[16px]">{{ tidyText(block.text) }}</p>
        </div>
      </div>
      <div v-if="block.voucherHeading" class="lg:col-span-5 min-w-0 panel px-5 sm:px-6 py-10 md:px-10 md:py-12 text-center" style="--r:22px">
        <p v-if="block.voucherEyebrow" class="caps text-brass">{{ block.voucherEyebrow }}</p>
        <h2 class="lettering mt-3 text-[40px] md:text-[48px] leading-[1.05]">{{ tidyText(block.voucherHeading) }}</h2>
        <p v-if="block.amounts.length" class="mt-6 flex items-center justify-center gap-2.5 sm:gap-4 font-display text-cream text-[21px] sm:text-[28px]">
          <template v-for="(a, i) in block.amounts" :key="a.id"><span v-if="i" class="dia" aria-hidden="true" /><span>{{ i === block.amounts.length - 1 ? kc(a.amount ?? 0) : formatPrice(a.amount ?? 0) }}</span></template>
        </p>
        <p v-if="block.voucherText" class="mt-5 text-[16px]">{{ tidyText(block.voucherText) }}</p>
        <template v-if="block.voucherLabel && block.voucherUrl">
          <a v-if="isExternal(block.voucherUrl) || block.voucherUrl.startsWith('mailto:')" :href="block.voucherUrl" class="plate btn btn-cream mt-8">{{ block.voucherLabel }}</a>
          <NuxtLink v-else :to="siteHref(block.voucherUrl)" class="plate btn btn-cream mt-8">{{ block.voucherLabel }}</NuxtLink>
        </template>
      </div>
    </div>
  </section>
</template>
