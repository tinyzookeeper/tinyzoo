<script setup lang="ts">
// The name of the event: three overprinted dots and the name in the display face. A logo
// uploaded in Site settings takes their place. `plain` is the name alone (the phone menu),
// `large` the footer's.
const props = defineProps<{ plain?: boolean; large?: boolean }>()
const { settings, name } = await useEvent()
const withMark = computed(() => !props.plain && !props.large)
</script>

<template>
  <span class="flex items-center gap-2.5">
    <CmsImage v-if="settings?.logo && !plain" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain" :class="large ? 'h-10' : 'h-8'" data-wordmark />
    <template v-else>
      <span v-if="withMark" class="relative block w-10 h-7" aria-hidden="true"><span class="ink-m absolute left-0 bottom-0 w-5 h-5 rounded-full bg-c2" /><span class="ink-m absolute left-2.5 bottom-0 w-6 h-6 rounded-full bg-c1" /><span class="ink-m absolute left-5 bottom-0 w-5 h-5 rounded-full bg-c3" /></span>
      <span class="disp" :class="large ? 'text-[2rem]' : 'text-[1.45rem]'" data-wordmark>{{ name }}</span>
    </template>
  </span>
</template>
