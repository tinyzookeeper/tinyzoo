<script setup lang="ts">
// A small moment after something good happened ("Keeper is watching it now."): an animal,
// a Manrope line and a sentence, in the corner (full width on phones). It leaves by itself.
const props = withDefaults(defineProps<{ title: string; description?: string; seed?: string; animal?: string; timeout?: number }>(), { timeout: 10 })
const open = defineModel<boolean>('open', { default: false })
let timer: ReturnType<typeof setTimeout> | null = null
watch(open, (v) => {
  if (timer) clearTimeout(timer)
  if (v && props.timeout) timer = setTimeout(() => { open.value = false }, props.timeout * 1000)
}, { immediate: true })
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      role="status"
      aria-live="polite"
      class="k-rise k-card fixed inset-x-3 bottom-3 z-50 flex items-start gap-4 p-4 shadow-[0_18px_40px_-14px_rgba(0,0,0,.35)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[25rem]"
    >
      <KAnimal :seed="seed" :name="animal" class="mt-0.5 h-12 w-auto shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="k-display text-base text-highlighted">{{ title }}</p>
        <p v-if="description" class="text-sm text-pretty text-muted">{{ description }}</p>
      </div>
      <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" class="-mt-1 -mr-1" aria-label="Close" @click="() => { open = false }" />
    </div>
  </Teleport>
</template>
