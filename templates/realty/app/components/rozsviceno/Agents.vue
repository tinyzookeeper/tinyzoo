<script setup lang="ts">
// Rozsvíceno's agents: each in a window (a portrait under a shallow arch), with a name, what
// they do in the lamp colour, a sentence and a pill with the phone number.
import type { Agent } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'agents'>; first?: boolean; anchor?: string; agents: Agent[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-32">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="hand text-[1.2rem]">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.3rem] md:text-[3.2rem]"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'hand' }" /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 text-quiet">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 grid md:grid-cols-3 gap-x-8 gap-y-8">
      <article v-for="a in agents" :key="a.id" class="grid grid-cols-[7rem_1fr] md:grid-cols-1 gap-x-5 items-center md:items-start content-start">
        <div class="window aspect-[4/5] md:aspect-[1/1.04]"><CmsImage v-if="a.photo" :media="a.photo" sizes="(min-width: 768px) 24rem, 7rem" :style="{ objectPosition: '50% 30%' }" /></div>
        <div class="md:mt-5">
          <h3 class="text-[1.5rem] md:text-[1.7rem]">{{ a.name }}</h3>
          <p v-if="a.role" class="hand mt-1">{{ tidyText(a.role) }}</p>
          <p v-if="a.text" class="mt-2 text-[0.98rem] text-quiet">{{ tidyText(a.text) }}</p>
          <a v-if="a.phone" class="mt-3 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-surface font-semibold hover:bg-lamp hover:text-lamp-ink transition-colors" :href="telHref(a.phone)"><UIcon name="i-lucide-phone" class="size-4" aria-hidden="true" />{{ a.phone }}</a>
          <a v-if="a.email" class="flex items-center min-h-[44px] text-[0.95rem] text-quiet hover:text-lamp transition-colors break-all" :href="`mailto:${a.email}`">{{ a.email }}</a>
        </div>
      </article>
    </div>
  </section>
</template>
