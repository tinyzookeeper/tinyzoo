<script setup lang="ts">
// Rozhovor's steps: the visitor asks how it goes, the owner answers beside a photograph with a
// question on its edge, then the steps as cards, each with a pill saying when it happens.
defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="wrap py-20 lg:py-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10 items-center">
      <div :class="block.image ? 'lg:col-span-6' : 'lg:col-span-12'">
        <RozhovorQuestion :question="block.question" />
        <RozhovorAnswer :heading="block.heading" :first="first" :asked="!!block.question" class="max-w-[40rem]" />
      </div>
      <figure v-if="block.image" class="lg:col-span-6">
        <div class="ph aspect-[3/2] rounded-[1.75rem] md:rounded-[2.25rem]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 38rem, 100vw" /></div>
        <figcaption v-if="block.imageQuestion || block.imageCaption" class="relative ml-5 mr-6" :class="block.imageQuestion ? '-mt-7' : 'mt-3'">
          <span v-if="block.imageQuestion" class="bubble serif italic text-[1.05rem] leading-[1.35] px-5 py-3 shadow-[0_14px_30px_-18px_rgba(0,0,0,.45)]">{{ czText(block.imageQuestion) }}</span>
          <span v-if="block.imageCaption" class="block text-[1rem] text-quiet" :class="block.imageQuestion ? 'mt-3' : ''">{{ czText(block.imageCaption) }}</span>
        </figcaption>
      </figure>
    </div>

    <ol class="mt-12 lg:mt-14 grid sm:grid-cols-2 gap-4 lg:gap-5" :class="block.items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'">
      <li v-for="(step, i) in block.items" :key="i" class="card p-6 lg:p-7">
        <span v-if="step.when" class="inline-flex items-center min-h-[2.2rem] px-3.5 rounded-full bg-paper text-ink font-bold text-[1rem]">{{ czText(step.when) }}</span>
        <h3 class="text-[1.35rem] leading-[1.2] font-bold" :class="step.when ? 'mt-5' : ''">{{ czText(step.title) }}</h3>
        <p class="mt-2 text-[1.1rem]">{{ czText(step.text) }}</p>
      </li>
    </ol>
  </section>
</template>
