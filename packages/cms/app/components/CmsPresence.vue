<script setup lang="ts">
// Who else has this open: small avatars in the page header, a dot on the ones with
// unsaved changes. Names come from the server (their accounts), never the browser.
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
    <div class="flex items-center -space-x-1.5 mr-1" role="status" :aria-label="label">
      <span v-for="p in shown" :key="p.id" class="relative inline-flex">
        <UAvatar :alt="p.name" size="xs" class="ring-2 ring-(--ui-bg)" />
        <span v-if="p.editing" class="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-warning ring-2 ring-(--ui-bg)" />
      </span>
      <span v-if="people.length > shown.length" class="pl-2.5 text-xs text-muted">+{{ people.length - shown.length }}</span>
    </div>
  </UTooltip>
</template>
