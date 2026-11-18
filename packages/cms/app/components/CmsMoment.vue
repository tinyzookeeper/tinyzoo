<script setup lang="ts">
// A small brand moment that arrives after something good happened ("It's on the
// website."): one animal, a Manrope line, one sentence and up to two ways on. It
// sits in the corner (full width on phones), goes away by itself after a while,
// and never covers the page with a modal or confetti.
const props = withDefaults(defineProps<{
  title: string
  description?: string
  animal?: string
  /** Seconds before it leaves by itself (0: stays). */
  timeout?: number
}>(), { animal: 'whale', timeout: 12 })
const open = defineModel<boolean>('open', { default: false })
const { t } = useCmsI18n()
const animals = useCmsAnimals()

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
      v-if="open" role="status" aria-live="polite"
      class="cms-rise fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[25rem] cms-card flex items-start gap-4 p-4 shadow-[0_18px_40px_-14px_rgba(0,0,0,.35)]"
    >
      <CmsAnimal v-if="animals" :name="animal" class="h-12 w-auto shrink-0 mt-0.5" />
      <div class="min-w-0 flex-1">
        <p class="cms-display text-base text-highlighted">{{ title }}</p>
        <p v-if="description" class="text-sm text-muted text-pretty">{{ description }}</p>
        <div v-if="$slots.default" class="mt-2.5 flex flex-wrap gap-1.5">
          <slot />
        </div>
      </div>
      <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" class="-mr-1 -mt-1" :aria-label="t('common.close')" @click="() => { open = false }" />
    </div>
  </Teleport>
</template>
