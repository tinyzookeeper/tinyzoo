<script setup lang="ts">
// Where you are in the wizard: the steps as a row of numbered marks, the ones behind you
// ticked and clickable (to go back).
defineProps<{ steps: string[]; current: number }>()
defineEmits<{ go: [step: number] }>()
</script>

<template>
  <ol class="flex items-center gap-2 sm:gap-3">
    <li v-for="(label, i) in steps" :key="label" class="flex min-w-0 items-center gap-2 sm:gap-3">
      <component
        :is="i + 1 < current ? 'button' : 'span'"
        :type="i + 1 < current ? 'button' : undefined"
        class="flex min-w-0 items-center gap-2 rounded-full py-1 pr-1 text-sm"
        :class="i + 1 === current ? 'font-semibold text-highlighted' : i + 1 < current ? 'text-toned hover:text-highlighted' : 'text-dimmed'"
        :aria-current="i + 1 === current ? 'step' : undefined"
        @click="i + 1 < current && $emit('go', i + 1)"
      >
        <span
          class="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular"
          :class="i + 1 === current ? 'bg-(--ui-primary) text-inverted' : i + 1 < current ? 'bg-(--z-moment-strong) text-highlighted' : 'border border-default text-dimmed'"
        >
          <UIcon v-if="i + 1 < current" name="i-lucide-check" class="size-3.5" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="truncate" :class="i + 1 === current ? '' : 'hidden sm:inline'">{{ label }}</span>
      </component>
      <span v-if="i < steps.length - 1" class="h-px w-5 shrink-0 bg-(--ui-border-accented) sm:w-8" aria-hidden="true" />
    </li>
  </ol>
</template>
