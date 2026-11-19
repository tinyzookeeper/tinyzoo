<script setup lang="ts">
const props = defineProps<{ version: string | null; outdated?: boolean; latest?: string | null }>()
const tip = computed(() => {
  if (!props.version) return 'No status yet: add the site’s status token to see its version.'
  if (props.outdated && props.latest) return `tinyzoo ${props.latest} is out.`
  return props.latest ? 'The newest tinyzoo.' : `tinyzoo ${props.version}`
})
</script>

<template>
  <UTooltip :text="tip">
    <UBadge
      :color="!version ? 'neutral' : outdated ? 'warning' : 'neutral'"
      :variant="outdated ? 'soft' : 'outline'"
      class="font-mono tabular"
      :icon="outdated ? 'i-lucide-arrow-up-circle' : undefined"
    >
      {{ version ?? '—' }}
    </UBadge>
  </UTooltip>
</template>
