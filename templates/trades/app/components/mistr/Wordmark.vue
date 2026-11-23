<script setup lang="ts">
// The business's name with what it does in capitals under it. A logo uploaded in Site settings
// takes the place of both. `footer` is the footer's: white on the dark band, and the name is
// marked as the site's name in the header only.
defineProps<{ footer?: boolean }>()
const { settings, name } = await useTrades()
// A longer name steps down so that it fits on two lines beside the buttons.
const size = computed(() => byLength(name.value, [[20, 'text-[1.45rem]'], [32, 'text-[1.2rem]']], 'text-[1.05rem]'))
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] h-[40px] object-contain object-left" />
  <span v-else class="flex flex-col leading-none min-w-0">
    <span :data-wordmark="footer ? undefined : ''" class="font-extrabold tracking-[-0.03em]" :class="[footer ? 'text-white' : 'text-ink', size]">{{ name }}</span>
    <span v-if="settings?.trade" class="text-[0.72rem] font-semibold tracking-[0.08em] uppercase" :class="footer ? 'mt-1.5' : 'mt-1 text-quiet'">{{ settings.trade }}</span>
  </span>
</template>
