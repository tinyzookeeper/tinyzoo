<script setup lang="ts">
import type { LookDef } from '#shared/templates'

// One look of a template: a tall picture of the finished website, its name and one sentence.
// A choice (a radio button drawn as a card), as a template is in the gallery.
defineProps<{ look: LookDef; selected: boolean; isDefault?: boolean }>()
defineEmits<{ pick: [id: string] }>()
const t = useT()
const l = useL()
</script>

<template>
  <button
    type="button" role="radio" :aria-checked="selected"
    class="look group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-(--z-surface) text-left transition"
    :class="selected ? 'border-(--ui-primary) ring-2 ring-(--ui-primary)' : 'border-default hover:border-(--ui-border-accented)'"
    :data-look="look.id"
    @click="$emit('pick', look.id)"
  >
    <!-- The top of the home page, two screens of it: the card shows most, the rest glides in under a pointer. -->
    <div class="relative aspect-[4/5] overflow-hidden bg-(--z-moment-bg)">
      <img :src="look.preview" alt="" class="look__shot absolute inset-x-0 top-0 w-full">
      <span v-if="selected" class="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-full bg-(--ui-primary) text-inverted shadow-sm">
        <UIcon name="i-lucide-check" class="size-[1.125rem]" />
      </span>
    </div>
    <div class="flex flex-1 flex-col border-t border-default p-4 sm:p-5">
      <h3 class="flex items-center gap-2 z-title text-lg leading-snug text-highlighted">
        {{ l(look.name) }}
        <span v-if="isDefault" class="rounded-full bg-(--ui-bg-elevated) px-2 py-0.5 text-xs font-medium text-toned">{{ t('new.lookDefault') }}</span>
      </h3>
      <p class="mt-1 text-sm leading-relaxed text-pretty text-muted">{{ l(look.description) }}</p>
    </div>
  </button>
</template>

<style scoped>
/* The picture is the page's top; with a pointer on the card it glides down a little, as if scrolled. */
.look__shot { transition: transform 1.6s cubic-bezier(.3, .1, .2, 1); }
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .look:hover .look__shot { transform: translateY(-16.6%); }
}
</style>
