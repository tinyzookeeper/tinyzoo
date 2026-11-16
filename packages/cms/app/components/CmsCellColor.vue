<script setup lang="ts">
// A colour in a list: a swatch and its code.
const props = defineProps<{ field: any; row: any; entity?: string }>()
const v = computed(() => props.row[props.field.key] as string | null | undefined)
</script>

<template>
  <span v-if="v" class="inline-flex items-center gap-1.5">
    <span class="size-3.5 rounded-sm border border-default" :style="{ background: v }" aria-hidden="true" />
    <span class="font-mono text-xs text-muted uppercase">{{ v }}</span>
  </span>
  <span v-else>—</span>
</template>
