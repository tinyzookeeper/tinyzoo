<script setup lang="ts">
// Cesta's makes: the makes as text, the ones the garage knows best set larger, and "what we do
// not do" on a white surface.
defineProps<{ block: BlockOf<'makes'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="blk-makes scroll-mt-4">
    <div class="wrap grid lg:grid-cols-12 gap-x-14 gap-y-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 font-extrabold text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
        <template v-for="(g, i) in block.groups" :key="g.id">
          <p class="mt-9 font-display" :class="i === 0 ? 'font-bold text-[28px] sm:text-[34px] leading-[1.2] tracking-[-0.02em]' : 'font-semibold text-[22px] sm:text-[25px] leading-[1.35] tracking-[-0.01em]'">{{ g.names }}</p>
          <p v-if="g.text" class="mt-3 text-quiet max-w-[34em]">{{ tidyText(g.text) }}</p>
        </template>
      </div>
      <div v-if="block.notDoing.length" class="lg:col-span-5">
        <div class="rounded-[28px] bg-white p-7 sm:p-10">
          <h3 v-if="block.notHeading" class="font-bold text-[28px]">{{ block.notHeading }}</h3>
          <p v-if="block.notText" class="mt-2 text-[17px] text-quiet">{{ tidyText(block.notText) }}</p>
          <ul class="mt-6 space-y-4 text-[17px] leading-snug">
            <li v-for="n in block.notDoing" :key="n.id" class="flex gap-3.5">
              <UIcon name="i-lucide-minus" class="flex-none size-5 mt-0.5 text-quiet" aria-hidden="true" />
              <span><span class="font-semibold">{{ tidyText(n.text) }}</span><template v-if="n.note">{{ ' ' }}<span class="text-quiet">{{ tidyText(n.note) }}</span></template></span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
