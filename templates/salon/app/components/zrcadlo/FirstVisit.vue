<script setup lang="ts">
// Zrcadlo's first visit: the heading beside four numbered circles.
defineProps<{ block: BlockOf<'firstVisit'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="bg-surface rounded-b-[36px] md:rounded-b-[56px] scroll-mt-4">
    <div class="wrap pb-20 md:pb-28 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[38px] md:text-[48px] leading-[1.08]">{{ tidyText(block.heading) }}</component>
        <p v-if="block.text" class="mt-5 max-w-[26rem]">{{ tidyText(block.text) }}</p>
      </div>
      <ol class="lg:col-span-8 grid sm:grid-cols-2 gap-x-10 gap-y-10">
        <li v-for="(step, i) in block.steps" :key="step.id" class="flex gap-5">
          <span class="flex-none w-14 h-14 rounded-full shadow-[inset_0_0_0_1px_var(--ink)] flex items-center justify-center font-display text-[24px] text-ink">{{ i + 1 }}</span>
          <div><h3 class="text-[24px] leading-tight">{{ tidyText(step.heading) }}</h3><p v-if="step.text" class="mt-2">{{ tidyText(step.text) }}</p></div>
        </li>
      </ol>
    </div>
  </section>
</template>
