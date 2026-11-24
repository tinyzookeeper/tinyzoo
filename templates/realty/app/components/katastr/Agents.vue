<script setup lang="ts">
// Katastr's agents: on the card's white a narrow column with the heading, and the agents
// beside it, each a portrait, a name, what they do and a ruled phone and e-mail (the portrait
// small beside the text on a phone).
import type { Agent } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'agents'>; first?: boolean; anchor?: string; agents: Agent[] }>()
</script>

<template>
  <section :id="anchor" class="bg-card border-y border-line">
    <div class="wrap py-16 md:py-24 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-3">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[2.1rem] md:text-[2.5rem] leading-[1.1]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5">{{ tidyText(block.text) }}</p>
      </div>
      <div class="lg:col-span-9 grid md:grid-cols-3 gap-x-8 gap-y-8">
        <article v-for="a in agents" :key="a.id" class="grid grid-cols-[104px_1fr] md:grid-cols-1 gap-x-5 content-start items-start">
          <div class="aspect-[4/5] bg-tint overflow-hidden"><CmsImage v-if="a.photo" :media="a.photo" sizes="(min-width: 768px) 22rem, 104px" class="w-full h-full object-cover" /></div>
          <div class="md:mt-5">
            <h3 class="text-[1.4rem] leading-tight">{{ a.name }}</h3>
            <p v-if="a.role" class="mt-1 label text-quiet">{{ tidyText(a.role) }}</p>
            <p v-if="a.text" class="mt-3 text-[0.97rem]">{{ tidyText(a.text) }}</p>
            <div class="mt-3 border-t border-line">
              <a v-if="a.phone" class="rowlink num border-b border-line" :href="telHref(a.phone)"><UIcon name="i-lucide-phone" class="ic" aria-hidden="true" />{{ a.phone }}</a>
              <a v-if="a.email" class="rowlink border-b border-line break-all" :href="`mailto:${a.email}`"><UIcon name="i-lucide-mail" class="ic" aria-hidden="true" />{{ a.email }}</a>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
