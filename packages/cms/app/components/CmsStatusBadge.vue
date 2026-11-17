<script setup lang="ts">
// Publication status, the same everywhere: a dot and a word, no pill.
// Draft = grey ring, published = green, scheduled (published, date still ahead) =
// an amber clock with the date in its tooltip. Published but held back (`waitingFor`: the name of the
// default language, which gates the other languages and is not live) = an amber pause: "Waiting for Czech".
const props = defineProps<{ published: boolean; scheduledFor?: string | Date | null; waitingFor?: string | null }>()
const { t, formatDate } = useCmsI18n()
const scheduled = computed(() => props.published && !!props.scheduledFor && new Date(props.scheduledFor).getTime() > Date.now())
</script>

<template>
  <UTooltip v-if="published && waitingFor" :text="t('translation.waitingForBody', { lang: waitingFor })">
    <span class="inline-flex items-center gap-1.5 text-sm text-default" tabindex="0">
      <UIcon name="i-lucide-hourglass" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
      {{ t('translation.waitingFor', { lang: waitingFor }) }}
    </span>
  </UTooltip>
  <UTooltip v-else-if="scheduled" :text="t('editor.scheduledFor', { date: formatDate(scheduledFor!) })">
    <span class="inline-flex items-center gap-1.5 text-sm text-default" tabindex="0">
      <UIcon name="i-lucide-clock" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
      {{ t('editor.scheduled') }}
    </span>
  </UTooltip>
  <span v-else class="inline-flex items-center gap-1.5 text-sm" :class="props.published ? 'text-default' : 'text-muted'">
    <span class="size-2 rounded-full shrink-0" :class="props.published ? 'bg-success' : 'border border-(--ui-text-dimmed)'" aria-hidden="true" />
    {{ props.published ? t('editor.published') : t('editor.draft') }}
  </span>
</template>
