<script setup lang="ts">
// Cesta's opening: today's hours, the heading, a sentence, two buttons and the next free days as
// two plain figures; a tall photograph beside it.
const props = defineProps<{ block: BlockOf<'hero'>; first?: boolean }>()
const { openLine, place, phone, phoneUrl, freeService, freeTyres, words } = await useGarage()
const size = computed(() => byLength(props.block.heading, [[44, 'text-[46px] sm:text-[64px] xl:text-[76px]'], [70, 'text-[40px] sm:text-[52px] xl:text-[60px]']], 'text-[34px] sm:text-[44px] xl:text-[50px]'))
</script>

<template>
  <section class="wrap grid lg:grid-cols-12 gap-x-14 gap-y-10 pt-4 pb-14 lg:pt-8 lg:pb-20">
    <div class="lg:col-span-6 flex flex-col justify-center lg:py-6">
      <p class="flex items-center gap-2.5 text-[16px] font-medium"><span class="w-2.5 h-2.5 rounded-full bg-brand" aria-hidden="true" />{{ openLine }}<span v-if="place" class="text-quiet font-normal hidden sm:inline">· {{ place }}</span></p>
      <component :is="first ? 'h1' : 'h2'" class="mt-6 font-extrabold leading-[1.02] tracking-[-0.028em]" :class="size">{{ plainEmphasis(block.heading) }}</component>
      <p v-if="block.text" class="mt-6 text-[19px] sm:text-[20px] leading-[1.55] text-quiet max-w-[30em]">{{ tidyText(block.text) }}</p>
      <div class="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
        <NuxtLink v-if="block.primaryLabel" :to="siteHref(block.primaryUrl)" class="btn btn-brand">{{ block.primaryLabel }}</NuxtLink>
        <a v-if="phone" :href="phoneUrl" class="btn btn-soft num"><UIcon name="i-lucide-phone" aria-hidden="true" />{{ phone }}</a>
      </div>
      <div v-if="freeService || freeTyres" class="mt-12 pt-7 border-t border-line max-w-[520px]">
        <p class="text-[16px] text-quiet">{{ words.nextFree }}</p>
        <dl class="mt-2 grid grid-cols-2 gap-x-8">
          <div v-if="freeService" class="flex flex-col-reverse"><dt class="text-[15px] text-quiet mt-0.5">{{ words.forService }}</dt><dd class="num font-bold text-[24px] sm:text-[27px] leading-tight">{{ freeService }}</dd></div>
          <div v-if="freeTyres" class="flex flex-col-reverse"><dt class="text-[15px] text-quiet mt-0.5">{{ words.forTyres }}</dt><dd class="num font-bold text-[24px] sm:text-[27px] leading-tight">{{ freeTyres }}</dd></div>
        </dl>
      </div>
    </div>
    <div class="lg:col-span-6">
      <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 40rem, 100vw" class="w-full aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[620px] object-cover !object-[44%_50%] rounded-[28px]" />
    </div>
  </section>
</template>
