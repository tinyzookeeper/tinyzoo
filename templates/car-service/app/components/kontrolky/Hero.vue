<script setup lang="ts">
// Kontrolky's opening: first the line above, the question and the way to book, then the facts under
// a line (the next free day, today's hours, the hourly rate); the dusk photograph framed beside
// the text, nothing laid over it.
const props = defineProps<{ block: BlockOf<'hero'>; first?: boolean }>()
const { settings, phone, phoneUrl, freeService, todayHours, today, words } = await useGarage()
const size = computed(() => byLength(props.block.heading, [[28, 'text-[46px] sm:text-[64px] xl:text-[76px]'], [48, 'text-[40px] sm:text-[52px] xl:text-[60px]']], 'text-[34px] sm:text-[44px] xl:text-[50px]'))
const photo = computed(() => openingPhoto(props.block, 'kontrolky'))
</script>

<template>
  <section class="wrap grid lg:grid-cols-12 gap-x-14 gap-y-10 pt-6 lg:pt-6 pb-10 lg:pb-10">
    <div class="lg:col-span-6 flex flex-col justify-center">
      <p v-if="block.eyebrow" class="cap">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-5 leading-[1.0] tracking-[-0.01em]" :class="size">{{ plainEmphasis(block.heading) }}</component>
      <p v-if="block.text" class="mt-6 text-[19px] leading-[1.6] text-quiet max-w-[29em]">{{ tidyText(block.text) }}</p>
      <div class="mt-9 flex flex-wrap gap-3">
        <NuxtLink v-if="block.primaryLabel" :to="siteHref(block.primaryUrl)" class="btn btn-brand">{{ block.primaryLabel }}</NuxtLink>
        <a v-if="phone" :href="phoneUrl" class="btn btn-quiet dig sm:hidden"><UIcon name="i-lucide-phone" aria-hidden="true" />{{ phone }}</a>
        <NuxtLink v-if="block.secondaryLabel" :to="siteHref(block.secondaryUrl)" class="btn btn-quiet hidden sm:inline-flex">{{ block.secondaryLabel }}</NuxtLink>
      </div>
      <dl class="mt-10 pt-7 border-t border-line grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-6">
        <div v-if="freeService" class="col-span-2 sm:col-span-1"><dt class="text-[14.5px] text-quiet">{{ words.nextFree }}</dt><dd class="dig mt-1 text-[23px] font-semibold leading-tight">{{ freeService }}</dd></div>
        <div><dt class="text-[14.5px] text-quiet">{{ words.openToday }}</dt><dd class="dig mt-1 text-[23px] font-semibold leading-tight">{{ todayHours }}</dd></div>
        <div v-if="settings?.hourlyRate"><dt class="text-[14.5px] text-quiet">{{ words.hourlyRate }}</dt><dd class="dig mt-1 text-[23px] font-semibold leading-tight">{{ priceOf({ price: settings.hourlyRate }) }}</dd></div>
      </dl>
    </div>
    <div class="lg:col-span-6">
      <CmsImage v-if="photo" :media="photo" eager sizes="(min-width: 1024px) 40rem, 100vw" class="w-full aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[460px] object-cover !object-[62%_50%] rounded-[22px]" />
    </div>
  </section>
</template>
