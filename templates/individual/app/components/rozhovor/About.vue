<script setup lang="ts">
// Rozhovor's about: two photographs, the second smaller and overlapping the first, the
// visitor's question, the owner's answer, the story and a dated list as small cards.
defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="wrap py-20 lg:py-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-12 items-start">
      <div v-if="block.image" class="lg:col-span-5 relative max-w-[30rem] lg:max-w-none" :class="block.secondImage ? 'pb-10 sm:pb-16' : ''">
        <div class="ph aspect-[4/5] rounded-[2.25rem]" :class="block.secondImage ? 'w-[86%]' : ''"><CmsImage :media="block.image" sizes="(min-width: 1024px) 28rem, 26rem" /></div>
        <div v-if="block.secondImage" class="ph absolute right-0 bottom-0 w-[52%] aspect-[4/3] rounded-[1.5rem] border-[6px] border-paper"><CmsImage :media="block.secondImage" sizes="(min-width: 1024px) 16rem, 14rem" /></div>
      </div>
      <div :class="block.image ? 'lg:col-span-7' : 'lg:col-span-12'">
        <RozhovorQuestion :question="block.question" />
        <RozhovorAnswer :heading="block.heading" :first="first" :asked="!!block.question" />
        <div v-if="block.text" class="mt-7 space-y-4 max-w-[40rem]">
          <p v-for="(para, i) in paragraphs(block.text)" :key="i">{{ czText(para) }}</p>
        </div>
        <ul v-if="block.timeline.length" class="mt-8 grid sm:grid-cols-2 gap-3">
          <li v-for="(line, i) in block.timeline" :key="i" class="card p-5">
            <span class="serif font-bold text-brand text-[1.05rem]">{{ czText(line.when) }}</span>
            <span class="block mt-1 text-ink leading-[1.35]">{{ czText(line.text) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
