<script setup lang="ts">
// Soutisk's partners and organiser: the partners set in the display face by level, and the
// organiser on a paper card under a photograph of the village cut with a line of hills.
import type { Partner } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'partners'>; first?: boolean; anchor?: string; items: Partner[] }>()
const { settings, words } = await useEvent()
const level = (l: string) => props.items.filter((p) => p.level === l)
const main = computed(() => level('main'))
const partners = computed(() => level('partner'))
const supporters = computed(() => level('supporter'))
</script>

<template>
  <section :id="anchor" class="relative bg-paper pt-6 sm:pt-10 pb-16 sm:pb-24" :class="first ? 'mt-14 sm:mt-28' : ''">
    <svg class="hills text-paper" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><use href="#soutisk-hl2" fill="currentColor" /></svg>
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        <dl class="mt-8">
          <template v-if="main.length">
            <dt class="font-bold text-quiet">{{ block.mainLabel }}</dt>
            <dd v-for="p in main" :key="p.id" class="disp text-[clamp(2.4rem,5.4vw,3.9rem)] mt-1">
              <a v-if="p.url" :href="siteHref(p.url)" class="hover:underline decoration-[4px] underline-offset-8 decoration-c1" target="_blank" rel="noopener">{{ p.name }}</a><template v-else>{{ p.name }}</template>
            </dd>
          </template>
          <template v-if="partners.length">
            <dt class="font-bold text-quiet mt-8">{{ block.partnerLabel }}</dt>
            <dd class="disp text-[clamp(1.25rem,2.4vw,1.7rem)] leading-[1.5] mt-1 flex flex-wrap gap-x-7">
              <template v-for="p in partners" :key="p.id"><a v-if="p.url" :href="siteHref(p.url)" class="hover:underline decoration-[3px] underline-offset-4 decoration-c1" target="_blank" rel="noopener">{{ p.name }}</a><span v-else>{{ p.name }}</span></template>
            </dd>
          </template>
          <template v-if="supporters.length">
            <dt class="font-bold text-quiet mt-8">{{ block.supporterLabel }}</dt>
            <dd class="mt-1 text-lg font-medium flex flex-wrap gap-x-6 gap-y-1"><span v-for="p in supporters" :key="p.id">{{ p.name }}</span></dd>
          </template>
        </dl>
      </div>
      <div class="lg:col-span-5">
        <div class="relative">
          <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 32rem, 100vw" class="hillclip w-full aspect-[16/10] object-cover" />
          <div class="bg-paper2 p-6 sm:p-8" :class="block.image ? 'rounded-b-[28px]' : 'rounded-[28px]'">
            <p v-if="block.organizerLabel" class="kicker">{{ block.organizerLabel }}</p>
            <h2 class="disp text-[1.7rem] sm:text-[2rem] leading-[1.1] mt-2">{{ tidyText(settings?.organizerName) }}</h2>
            <p v-if="settings?.organizerAbout" class="mt-3 text-quiet">{{ tidyText(settings.organizerAbout) }}</p>
            <p v-if="settings?.contactName" class="mt-5 font-bold">{{ settings.contactName }}<template v-if="settings.contactRole">, {{ settings.contactRole }}</template></p>
            <p v-if="settings?.phone"><a :href="telHref(settings.phone)" class="disp text-[1.9rem] inline-flex items-center min-h-11 hover:underline decoration-[3px] underline-offset-4 decoration-c1">{{ settings.phone }}</a></p>
            <p v-if="settings?.email"><a :href="`mailto:${settings.email}`" class="ulink break-all">{{ settings.email }}</a></p>
            <p v-if="settings?.address" class="mt-3 text-quiet text-[0.95rem]">{{ settings.address }}<template v-if="settings.companyId"> · {{ words.organizerCompanyId(settings.companyId) }}</template></p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
