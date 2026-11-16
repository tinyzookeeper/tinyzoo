<script setup lang="ts">
const props = defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
const icon = computed(() => cmsFieldIcon(props.field))
const injected = inject<Ref<'outline' | 'ghost'> | null>('cmsFieldVariant', null)
const variant = computed(() => injected?.value ?? 'outline')
</script>

<template>
  <UInput v-model.number="model" type="number" :icon="icon" :variant="variant" class="w-full" />
</template>
