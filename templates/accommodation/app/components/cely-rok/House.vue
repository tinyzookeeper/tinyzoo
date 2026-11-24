<script setup lang="ts">
// Celý rok's "what you find here": a tall photograph with its caption beside the features,
// two to a row, each a name in Gloock over a quiet line.
import type { Feature } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'house'>; first?: boolean; anchor?: string; features: Feature[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div v-if="block.image" class="lg:col-span-4">
        <div class="ph aspect-[4/5]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 28rem, 100vw" /></div>
        <p v-if="block.imageCaption" class="mt-3 text-sm text-quiet">{{ tidyText(block.imageCaption) }}</p>
      </div>
      <div :class="block.image ? 'lg:col-span-7 lg:col-start-6' : 'lg:col-span-10 lg:col-start-2'">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <dl class="mt-10 grid sm:grid-cols-2 gap-x-10">
          <div v-for="f in features" :key="f.id" class="rule py-6"><dt class="font-display text-[1.6rem] leading-tight">{{ f.name }}</dt><dd v-if="f.text" class="mt-2 text-quiet">{{ tidyText(f.text) }}</dd></div>
        </dl>
      </div>
    </div>
  </section>
</template>
