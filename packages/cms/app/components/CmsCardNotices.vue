<script setup lang="ts">
// What a card section says about itself at the top of its content (editor in the preview, part 3c): the blocks
// that show nothing on the website (with *Remove unbound* and *Design the card again*), and that the type has
// no entry yet (with a way to add the first one: the sheet beside the preview when there is one, else the
// admin's page for a new entry in a new tab). Saving is never blocked by either. The owner of the section
// does the rewriting: this only counts and asks.
import { cardBindingFieldOf } from '../../shared/builder-card'
import { cmsBindingRead } from '../utils/cmsBinding'

const props = defineProps<{ section: any; def: any; readOnly?: boolean }>()
const emit = defineEmits<{ drop: []; redesign: [] }>()
const { t } = useCmsI18n()
const builder = useCmsBuilder()
const edit = useCmsCardEdit(() => '')

const typeName = computed(() => {
  const key = cardBindingFieldOf(props.def)?.key
  return key ? cmsBindingRead(props.section?.[key])?.type ?? null : null
})
const unbound = computed(() => edit.unboundOf(props.section, props.def).length)

// The count of entries, asked again when an entry beside the page was saved or its sheet closed.
const card = useCmsCardType(typeName)
watch(() => builder.value?.entriesChanged.value, (now, before) => { if (now !== before) void card.refresh() })
const empty = computed(() => !!card.type.value && card.total.value === 0)
const beside = computed(() => !!builder.value?.panel.value)
</script>

<template>
  <div v-if="unbound || empty" class="cms-card-notices">
    <div v-if="unbound" role="status" class="cms-card-notice cms-card-notice--warn">
      <p class="flex items-start gap-2">
        <UIcon name="i-lucide-unlink" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <span class="min-w-0 text-pretty">{{ t('card.unboundBox', { count: unbound }) }} {{ t('card.unboundHidden') }}</span>
      </p>
      <div v-if="!readOnly" class="flex flex-wrap gap-2">
        <UButton size="xs" color="neutral" variant="outline" class="pointer-coarse:min-h-11" @click="emit('drop')">{{ t('card.dropUnbound') }}</UButton>
        <UButton size="xs" color="neutral" variant="outline" class="pointer-coarse:min-h-11" @click="emit('redesign')">{{ t('card.redesign') }}</UButton>
      </div>
    </div>
    <div v-if="empty" role="status" class="cms-card-notice cms-card-notice--quiet">
      <p class="flex items-start gap-2">
        <UIcon name="i-lucide-inbox" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="min-w-0 text-pretty">{{ t('card.noEntries', { type: card.meta.value?.label ?? typeName ?? '' }) }}</span>
      </p>
      <div v-if="!readOnly && typeName" class="flex flex-wrap gap-2">
        <UButton v-if="beside" size="xs" color="neutral" variant="outline" icon="i-lucide-plus" class="pointer-coarse:min-h-11" @click="builder?.editEntry(typeName, null)">{{ t('card.addFirst') }}</UButton>
        <UButton v-else :to="`/admin/${typeName}/new`" target="_blank" size="xs" color="neutral" variant="outline" icon="i-lucide-plus" trailing-icon="i-lucide-arrow-up-right" class="pointer-coarse:min-h-11">{{ t('card.addFirst') }}</UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cms-card-notices { display: flex; flex-direction: column; gap: 0.5rem; }
.cms-card-notice { display: flex; flex-direction: column; gap: 0.625rem; padding: 0.625rem 0.75rem; border-radius: 0.625rem; font-size: 0.8125rem; line-height: 1.45; color: var(--ui-text); animation: cms-card-notice-in 200ms ease-out; }
.cms-card-notice--warn { background: color-mix(in oklab, var(--ui-warning) 10%, transparent); border: 1px solid color-mix(in oklab, var(--ui-warning) 28%, transparent); }
.cms-card-notice--quiet { background: var(--ui-bg-elevated); border: 1px solid var(--ui-border); color: var(--ui-text-toned); }
@keyframes cms-card-notice-in { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .cms-card-notice { animation: none; } }
</style>
