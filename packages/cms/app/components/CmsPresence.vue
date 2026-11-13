<script setup lang="ts">
// Who else has this open: small avatars in the page header; a pencil badge on the
// ones with unsaved changes (shape, not only colour). The tooltip and the hidden
// text say the same for screen readers and keyboards. Names come from the server
// (their accounts), never the browser.
import type { LivePerson } from '../composables/useCmsLive'

const props = defineProps<{ people: LivePerson[] }>()
const { t } = useCmsI18n()
const shown = computed(() => props.people.slice(0, 3))
const label = computed(() => props.people
  .map((p) => t(p.editing ? 'live.editing' : 'live.viewing', { name: p.name }))
  .join(' · '))
</script>

<template>
  <UTooltip v-if="people.length" :text="label">
    <div class="flex items-center -space-x-1.5 mr-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-primary)" tabindex="0">
      <span class="sr-only" role="status">{{ t('live.presence') }}: {{ label }}</span>
      <span v-for="p in shown" :key="p.id" class="relative inline-flex" aria-hidden="true">
        <UAvatar :alt="p.name" size="xs" class="ring-2 ring-(--ui-bg)" />
        <span v-if="p.editing" class="absolute -bottom-1 -right-1 grid place-items-center size-3.5 rounded-full bg-warning text-inverted ring-2 ring-(--ui-bg)">
          <UIcon name="i-lucide-pencil" class="size-2" />
        </span>
      </span>
      <span v-if="people.length > shown.length" class="pl-2.5 text-xs text-muted" aria-hidden="true">+{{ people.length - shown.length }}</span>
    </div>
  </UTooltip>
</template>
