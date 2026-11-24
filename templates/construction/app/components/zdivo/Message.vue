<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <div class="wall">
      <div class="brick t1 col-span-4 !items-start !justify-start lg:col-span-14">
        <p v-if="code" class="eyebrow !text-brand-ink">{{ code }}</p>
        <h1 class="font-display text-[44px] font-extrabold leading-[.98] tracking-[-.015em] sm:text-[62px]">{{ title }}</h1>
      </div>
      <div class="brick t3 col-span-4 !items-start lg:col-span-10">
        <p class="text-[18px] leading-[1.5]">{{ text }}</p>
        <button type="button" class="btn btn-ink mt-6 self-start" @click="$emit('act')">{{ action }}</button>
      </div>
    </div>
  </section>
</template>
