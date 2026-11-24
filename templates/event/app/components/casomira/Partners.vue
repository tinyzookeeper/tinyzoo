<script setup lang="ts">
// Časomíra's partners and organiser: the partners set in type by level, and the organiser on a
// panel with the telephone number lit.
import type { Partner } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'partners'>; first?: boolean; anchor?: string; items: Partner[] }>()
const { settings, words } = await useEvent()
const level = (l: string) => props.items.filter((p) => p.level === l)
const main = computed(() => level('main'))
const partners = computed(() => level('partner'))
const supporters = computed(() => level('supporter'))
</script>

<template>
  <section :id="anchor" class="border-t border-line py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="sr-only"><KitMarked :text="block.heading" plain /></component>
        <dl class="mt-6">
          <template v-if="main.length">
            <dt class="mono text-quiet">{{ block.mainLabel }}</dt>
            <dd v-for="p in main" :key="p.id" class="mt-1 text-[clamp(2.6rem,6vw,4.5rem)] font-black tracking-[-0.045em] leading-none">
              <a v-if="p.url" :href="siteHref(p.url)" class="hover:text-led transition-colors" target="_blank" rel="noopener">{{ p.name }}</a><template v-else>{{ p.name }}</template>
            </dd>
          </template>
          <template v-if="partners.length">
            <dt class="mono text-quiet mt-8">{{ block.partnerLabel }}</dt>
            <dd class="mt-2 text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold tracking-[-0.03em] leading-[1.2] flex flex-wrap gap-x-7">
              <template v-for="p in partners" :key="p.id"><a v-if="p.url" :href="siteHref(p.url)" class="hover:text-led transition-colors" target="_blank" rel="noopener">{{ p.name }}</a><span v-else>{{ p.name }}</span></template>
            </dd>
          </template>
          <template v-if="supporters.length">
            <dt class="mono text-quiet mt-8">{{ block.supporterLabel }}</dt>
            <dd class="mt-2 text-lg flex flex-wrap gap-x-6 gap-y-1 text-text/90"><span v-for="p in supporters" :key="p.id">{{ p.name }}</span></dd>
          </template>
        </dl>
      </div>
      <div class="lg:col-span-5 panel p-6 sm:p-8">
        <p v-if="block.organizerLabel" class="mono text-quiet">{{ block.organizerLabel }}</p>
        <h2 class="text-3xl font-extrabold tracking-[-0.03em] mt-2">{{ tidyText(settings?.organizerName) }}</h2>
        <p v-if="settings?.organizerAbout" class="mt-3 text-quiet">{{ tidyText(settings.organizerAbout) }}</p>
        <dl class="mt-6 border-t border-line">
          <div v-if="settings?.contactName" class="flex justify-between gap-4 py-3 border-b border-line"><dt class="mono text-quiet pt-1">{{ ucfirst(settings.contactRole) }}</dt><dd class="font-bold text-right">{{ settings.contactName }}</dd></div>
          <div v-if="settings?.phone" class="flex justify-between gap-4 py-3 border-b border-line items-baseline"><dt class="mono text-quiet">{{ words.phone }}</dt><dd><a :href="telHref(settings.phone)" class="led text-[1.9rem] hover:!text-text transition-colors">{{ settings.phone }}</a></dd></div>
          <div v-if="settings?.email" class="flex justify-between gap-4 py-3 border-b border-line"><dt class="mono text-quiet pt-1">{{ words.email }}</dt><dd><a :href="`mailto:${settings.email}`" class="font-bold hover:text-led transition-colors underline underline-offset-4 decoration-1 break-all">{{ settings.email }}</a></dd></div>
          <div v-if="settings?.address" class="flex justify-between gap-4 py-3"><dt class="mono text-quiet pt-1">{{ words.address }}</dt><dd class="text-right">{{ settings.address }}<template v-if="settings.companyId"><br><span class="text-quiet">{{ words.organizerCompanyId(settings.companyId) }}</span></template></dd></div>
        </dl>
      </div>
    </div>
  </section>
</template>
