<script setup lang="ts">
const props = defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
const multiline = computed(() => !!props.field?.meta?.multiline)
const max = computed<number | undefined>(() => props.field?.meta?.max)
</script>

<template>
  <div class="w-full">
    <UTextarea v-if="multiline" v-model="model" class="w-full" autoresize :rows="3" :maxrows="12" :maxlength="max" />
    <UInput v-else v-model="model" class="w-full" :maxlength="max" />
    <p v-if="max && (model?.length ?? 0) > max * 0.8" class="mt-1 text-xs text-muted tabular-nums text-right">
      {{ model?.length ?? 0 }} / {{ max }}
    </p>
  </div>
</template>
