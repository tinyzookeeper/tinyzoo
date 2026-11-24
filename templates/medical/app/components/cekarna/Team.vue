<script setup lang="ts">
// Čekárna's team: four portraits side by side; on a phone a row with a small portrait.
import type { TeamMember } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; items: TeamMember[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28">
    <div class="grid gap-5 lg:grid-cols-[1fr_27rem] lg:gap-16 items-end">
      <div>
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.5rem] lg:text-[3rem]"><KitMarked :text="block.heading" plain /></component>
      </div>
      <p v-if="block.text" class="text-[1.08rem] lg:pb-2">{{ tidyText(block.text) }}</p>
    </div>
    <ul class="mt-10 lg:mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 lg:gap-8">
      <li v-for="m in items" :key="m.id" class="grid grid-cols-[7rem_1fr] gap-x-5 items-start sm:block">
        <CmsImage v-if="m.photo" :media="m.photo" sizes="(min-width: 1024px) 16rem, (min-width: 640px) 40vw, 7rem" class="w-full aspect-[4/5] object-cover rounded-[18px] sm:rounded-[22px]" />
        <div>
          <h3 class="sm:mt-5 text-[1.25rem]">{{ tidyText(m.name) }}</h3>
          <p v-if="m.role" class="mt-1 text-[.95rem] font-semibold text-brand">{{ m.role }}</p>
          <p v-if="m.text" class="mt-2 text-[.98rem]">{{ tidyText(m.text) }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>
