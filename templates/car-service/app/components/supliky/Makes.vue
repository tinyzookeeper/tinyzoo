<script setup lang="ts">
// Šuplíky's makes: the makes in bold italic, the ones the garage knows best set larger, and "what we
// do not do" on a dark slab with white crosses.
defineProps<{ block: BlockOf<'makes'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="blk-makes scroll-mt-4">
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="kicker text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[42px] sm:text-[60px]">{{ plainEmphasis(block.heading) }}</component>
        <template v-for="(g, i) in block.groups" :key="g.id">
          <p class="font-display italic font-semibold" :class="i === 0 ? 'mt-6 text-[27px] sm:text-[33px] leading-[1.2]' : 'mt-7 text-[21px] sm:text-[24px] leading-[1.3]'">{{ g.names }}</p>
          <p v-if="g.text" class="mt-2 text-quiet max-w-[36em]">{{ tidyText(g.text) }}</p>
        </template>
      </div>
      <div v-if="block.notDoing.length" class="lg:col-span-5">
        <div class="rounded-[28px] bg-ink text-white p-6 sm:p-8">
          <h3 v-if="block.notHeading" class="text-[30px]">{{ block.notHeading }}</h3>
          <p v-if="block.notText" class="mt-2 text-[16px] text-white/80">{{ tidyText(block.notText) }}</p>
          <ul class="mt-5 text-[16.5px] leading-snug">
            <li v-for="n in block.notDoing" :key="n.id" class="flex gap-3 py-3 border-t border-white/20 last:pb-0">
              <UIcon name="i-lucide-x" class="flex-none size-[22px] mt-px" aria-hidden="true" />
              <span><b class="font-semibold">{{ tidyText(n.text) }}</b><template v-if="n.note">{{ ' ' }}<span class="text-white/80">{{ tidyText(n.note) }}</span></template></span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
