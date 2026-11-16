<script setup lang="ts">
// A timestamp. The server renders the absolute date (stable, so hydration matches);
// after mount it switches to relative time ("3 hours ago") with the full date on hover.
// A slot receives the text (`{ text }`), so a sentence can put it where its language wants it.
const props = defineProps<{ value: string | Date; relative?: boolean }>()
const { formatDate, formatRelative } = useCmsI18n()
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const iso = computed(() => new Date(props.value).toISOString())
const absolute = computed(() => formatDate(props.value))
const text = computed(() => (props.relative && mounted.value ? formatRelative(props.value) : absolute.value))
</script>

<template>
  <time :datetime="iso" :title="absolute"><slot :text="text">{{ text }}</slot></time>
</template>
