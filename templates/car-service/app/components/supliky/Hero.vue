<script setup lang="ts">
// Šuplíky's opening: a large italic headline (a part of it in the brand colour), four facts under
// it, a tall photograph on an offset block, and the next free day on a drawer front.
const props = defineProps<{ block: BlockOf<'hero'>; first?: boolean }>()
const { settings, phone, phoneUrl, todayHours, freeService, tyresInSentence, words } = await useGarage()
const size = computed(() => byLength(props.block.heading, [[60, 'text-[44px] sm:text-[64px] xl:text-[74px]'], [90, 'text-[38px] sm:text-[52px] xl:text-[60px]']], 'text-[32px] sm:text-[44px] xl:text-[50px]'))
const parts = computed(() => emphasisParts(props.block.heading))
const photo = computed(() => openingPhoto(props.block, 'supliky'))
</script>

<template>
  <section class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-12 pt-6 pb-14 lg:pt-10 lg:pb-20">
    <div class="lg:col-span-7 xl:col-span-7">
      <p v-if="block.eyebrow" class="kicker text-brand">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-4 !font-extrabold leading-[0.98] tracking-[-0.01em] [text-wrap:wrap]" :class="size"><template v-for="(part, i) in parts" :key="i"><span v-if="part.marked" class="text-brand sm:whitespace-nowrap">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></component>
      <p v-if="block.text" class="mt-7 text-[19px] leading-[1.55] max-w-[32em]">{{ tidyText(block.text) }}</p>
      <div class="mt-8 flex flex-wrap gap-x-4 gap-y-5">
        <NuxtLink v-if="block.primaryLabel" :to="siteHref(block.primaryUrl)" class="btn btn-brand">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
        <NuxtLink v-if="block.secondaryLabel" :to="siteHref(block.secondaryUrl)" class="btn btn-card">{{ block.secondaryLabel }}</NuxtLink>
      </div>
      <dl class="mt-11 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
        <div v-if="phone"><dt class="text-[14px] font-medium text-quiet">{{ words.phone }}</dt><dd class="num text-[25px] leading-tight whitespace-nowrap"><a :href="phoneUrl" class="text-brand hover:underline underline-offset-4">{{ phone }}</a></dd></div>
        <div><dt class="text-[14px] font-medium text-quiet">{{ words.openToday }}</dt><dd class="num text-[25px] leading-tight whitespace-nowrap">{{ todayHours }}</dd></div>
        <div v-if="settings?.hourlyRate"><dt class="text-[14px] font-medium text-quiet">{{ words.hourlyRate }}</dt><dd class="num text-[25px] leading-tight">{{ priceOf({ price: settings.hourlyRate }) }}</dd></div>
        <div v-if="settings?.warranty"><dt class="text-[14px] font-medium text-quiet">{{ words.warranty }}</dt><dd class="num text-[25px] leading-tight">{{ settings.warranty }}</dd></div>
      </dl>
    </div>
    <div class="lg:col-span-5 relative lg:pl-4">
      <div class="relative">
        <div class="absolute -right-3 -bottom-3 sm:-right-5 sm:-bottom-5 w-[78%] h-[70%] rounded-[32px] bg-brand" aria-hidden="true" />
        <CmsImage v-if="photo" :media="photo" eager sizes="(min-width: 1024px) 32rem, 100vw" class="relative w-full aspect-[5/4] lg:aspect-[4/5] object-cover !object-[30%_50%] rounded-[32px]" />
        <!-- the next free day, on a drawer front -->
        <div v-if="freeService" class="absolute left-3 sm:-left-8 -bottom-8 w-[264px] rounded-[18px] overflow-hidden bg-brand text-white shadow-[0_6px_0_var(--brand-deep)]">
          <span class="pull" />
          <div class="px-4 pt-3.5 pb-4">
            <span class="tag px-3 py-1.5 text-[13px] font-semibold uppercase tracking-[0.06em]">{{ words.nextFree }}</span>
            <p class="num italic text-[30px] leading-none mt-3.5">{{ freeService }}</p>
            <p v-if="tyresInSentence" class="mt-1.5 text-[15px] text-white/90">{{ words.tyresNote(tyresInSentence) }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
