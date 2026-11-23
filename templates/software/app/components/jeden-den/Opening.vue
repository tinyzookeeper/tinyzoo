<script setup lang="ts">
// One Day's opening, 06:40: the story in the heading, the photograph with the phone of the moment
// laid over its corner, and the button.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string }>()
const phone = computed(() => props.block.screen === 'swap' || !!props.block.image)
</script>

<template>
  <section :id="anchor" class="bg-dawn">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-4 lg:pt-14" :time="block.time" :note="block.timeNote" />
      <div class="grid gap-10 pb-16 pt-6 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pl-14 lg:pt-14">
        <div class="lg:col-span-6">
          <p v-if="block.eyebrow" class="text-[16px] font-semibold">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 font-display text-[40px] font-semibold leading-[1.06] tracking-[-0.015em] sm:text-[54px] lg:text-[60px]"><KitMarked :text="block.heading" /></component>
          <p v-if="block.text" class="mt-6 max-w-[33rem] text-[18px]"><KitMarked :text="block.text" as="b" :attrs="{ class: 'font-semibold' }" /></p>
          <div v-if="(block.primaryLabel && block.primaryUrl) || (block.secondaryLabel && block.secondaryUrl)" class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <SiteLink v-if="block.primaryLabel && block.primaryUrl" class="btn btn-brand" :to="block.primaryUrl">{{ tidyText(block.primaryLabel) }} <UIcon name="i-lucide-arrow-right" class="size-[19px]" aria-hidden="true" /></SiteLink>
            <SiteLink v-if="block.secondaryLabel && block.secondaryUrl" class="ul text-[16px] font-medium" :to="block.secondaryUrl">{{ tidyText(block.secondaryLabel) }}</SiteLink>
          </div>
          <p v-if="block.note" class="mt-4 text-[15px]">{{ tidyText(block.note) }}</p>
        </div>
        <div class="relative lg:col-span-6">
          <CmsImage v-if="block.photo" :media="block.photo" eager sizes="(min-width: 1024px) 30rem, 90vw" class="ml-auto aspect-[4/3] w-[88%] rounded-[22px] object-cover object-[78%_50%] sm:aspect-[5/4] lg:aspect-[4/5] lg:w-[78%]" />
          <JedenDenScreen v-if="phone" :kind="block.screen" :image="block.image" place="opening" :class="block.photo ? 'relative z-10 -mt-24 sm:-mt-52 lg:absolute lg:bottom-[-34px] lg:left-0 lg:mt-0 lg:w-[262px]' : ''" />
        </div>
      </div>
    </div>
  </section>
</template>
