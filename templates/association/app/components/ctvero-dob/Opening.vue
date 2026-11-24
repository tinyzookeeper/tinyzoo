<script setup lang="ts">
// Čtvero dob's opening: the heading and two buttons beside a photograph. The season it is now
// shows quietly: a soft block behind the photograph, the label above the heading, the date
// tile of the nearest event, which stands under the photograph's corner.
import type { Event as CalendarEvent } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; events: CalendarEvent[] }>()
const { settings, words, month, season } = await useAssociation()
const { nearest } = useCalendar(() => props.events)
const parts = computed(() => dayParts(nearest.value?.date))
const label = computed(() => {
  const doing = settings.value?.months?.[month.value - 1]?.doing
  return doing ? `${words.value.months[month.value - 1]!.replace(/^./, (c) => c.toUpperCase())}: ${doing}` : ''
})
</script>

<template>
  <section class="bg-sand" :class="first ? 'pt-[80px]' : ''">
    <div class="wrap pb-16 pt-6 md:pb-24 md:pt-12">
      <div class="grid items-center gap-x-12 gap-y-10 lg:grid-cols-12">
        <div class="lg:col-span-6">
          <p v-if="label" class="chip" data-season-label><span class="h-2.5 w-2.5 rounded-full" :class="MARK[season]" />{{ label }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-6 text-[clamp(2.35rem,4.6vw,3.9rem)] leading-[1.05]"><KitMarked :text="block.heading" /></component>
          <p v-if="block.text" class="mt-6 max-w-[33rem] text-[1.2rem] leading-[1.55]">{{ tidy(block.text) }}</p>
          <div class="mt-9 flex flex-wrap gap-3">
            <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
            <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="siteHref(block.secondaryUrl)" class="btn btn-line">{{ block.secondaryLabel }}</NuxtLink>
          </div>
        </div>
        <div class="relative lg:col-span-6">
          <div class="absolute -right-3 -top-3 bottom-10 left-8 rounded-[36px] sm:-right-5 sm:-top-5 sm:left-14 lg:bottom-6" :class="TINT[season]" aria-hidden="true" />
          <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 40rem, 100vw" class="relative aspect-[5/4] w-full rounded-[28px] object-cover" />
          <NuxtLink v-if="nearest && parts" :to="`/#${anchorOf('events')}`" class="group relative z-10 -mt-12 ml-4 mr-4 block max-w-[23rem] rounded-[24px] bg-paper p-5 shadow-[0_1px_2px_rgb(20_30_25/0.06),0_14px_36px_rgb(20_30_25/0.14)] transition-transform hover:-translate-y-1 sm:ml-[-1.5rem] lg:absolute lg:bottom-[-2rem] lg:left-[-3rem] lg:mt-0" data-nearest>
            <span class="flex items-center gap-4">
              <span class="flex h-[72px] w-[72px] flex-none flex-col items-center justify-center rounded-[18px] text-ink" :class="TINT[season]"><span class="serif lnum text-[2rem] font-extrabold leading-none">{{ parts.day }}.</span><span class="text-[0.78rem] font-semibold leading-tight">{{ words.monthsOf[parts.month - 1] }}</span></span>
              <span class="leading-snug"><span class="block text-[0.9rem] font-semibold text-body">{{ words.nearestAt(words.weekdays[parts.weekday]!, clockOf(parts)) }}</span><span class="serif block text-[1.4rem] font-bold leading-[1.12] text-ink">{{ tidy(nearest.title) }}</span></span>
            </span>
            <span class="mt-3 flex items-center justify-between gap-3 border-t border-[var(--rule)] pt-3 text-[0.98rem] text-body"><span>{{ tidy(nearest.teaser || nearest.summary) }}</span><span class="flex items-center gap-1.5 font-semibold text-ink">{{ nearest.signup ? words.signUp : words.details }} <UIcon name="i-lucide-arrow-right" class="size-[1em] transition-transform group-hover:translate-x-1" aria-hidden="true" /></span></span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
