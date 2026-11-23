<script setup lang="ts">
// The agency's name in a black box, and beside it, in small mono capitals, the small word and
// the town ("reality / Písek"). A logo from Site settings takes the place of all of it.
// `plain` is the phone menu's: the box alone.
defineProps<{ plain?: boolean }>()
const { settings, name, town } = await useOffice()
// A long name steps down in size and may take two lines.
const size = computed(() => byLength(name.value, [[14, 'text-[1.35rem]'], [24, 'text-[1.15rem]']], 'text-[0.95rem] sm:text-[1.05rem]'))
const tight = computed(() => size.value === 'text-[1.35rem]' ? 'leading-none' : 'leading-[1.1]')
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-9 w-auto max-w-[12rem] object-contain" />
  <template v-else>
    <span class="bg-ink text-paper font-extrabold min-w-0 tracking-[-0.04em] px-2.5 pt-[0.5rem] pb-[0.35rem]" :class="[size, tight]" :data-wordmark="plain ? undefined : ''">{{ name }}</span>
    <span v-if="!plain && name.length <= 24 && (settings?.descriptor || town)" class="mono caps leading-[1.2]">{{ settings?.descriptor }}<br v-if="settings?.descriptor && town">{{ town }}</span>
  </template>
</template>
