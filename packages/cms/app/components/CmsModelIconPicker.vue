<script setup lang="ts">
import { CMS_MODEL_ICONS } from '../utils/cmsModel'

// The icons a content type can wear, as one choice among many squares: arrows move through them,
// as in any group of radio buttons.
const model = defineModel<string>({ required: true })
defineProps<{ label: string }>()
const { t } = useCmsI18n()

function iconKey(icon: string): string {
  return icon.replace(/^i-lucide-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}
function move(event: KeyboardEvent) {
  const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!delta) return
  event.preventDefault()
  const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]')]
  const at = buttons.findIndex((b) => b === document.activeElement)
  const next = buttons[(at + delta + buttons.length) % buttons.length]
  if (!next) return
  model.value = CMS_MODEL_ICONS[buttons.indexOf(next)] ?? model.value
  next.focus()
}
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="grid w-fit grid-cols-6 gap-1.5 sm:grid-cols-8" @keydown="move">
    <button
      v-for="icon in CMS_MODEL_ICONS" :key="icon" type="button" role="radio" :aria-checked="model === icon"
      :aria-label="t(`model.icons.${iconKey(icon)}` as any)" :tabindex="model === icon ? 0 : -1"
      class="grid size-11 place-items-center rounded-md border transition-colors sm:size-10"
      :class="model === icon ? 'border-transparent bg-(--cms-moment-strong) text-highlighted ring-2 ring-inset ring-(--ui-text-highlighted)' : 'border-default text-muted hover:bg-elevated hover:text-highlighted'"
      @click="model = icon"
    >
      <UIcon :name="icon" class="size-5" aria-hidden="true" />
    </button>
  </div>
</template>
