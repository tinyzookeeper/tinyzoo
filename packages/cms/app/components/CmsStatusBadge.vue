<script setup lang="ts">
// Publication status, the same everywhere: a dot and a word, no pill.
// Draft = grey ring, on the website = green, scheduled (published, date still ahead) =
// an amber clock with the date in its tooltip. Published but held back (`waitingFor`: the name of the
// default language, which gates the other languages and is not live) = an amber hourglass: "Waiting for Czech".
// `lang` names whose state it is when an entry has languages: "English · Draft".
const props = defineProps<{ published: boolean; scheduledFor?: string | Date | null; waitingFor?: string | null; lang?: string | null }>()
const { t, formatDate, locale } = useCmsI18n()
const scheduled = computed(() => props.published && !!props.scheduledFor && new Date(props.scheduledFor).getTime() > Date.now())
const word = computed(() => (props.published && props.waitingFor ? t('translation.waitingFor', { lang: props.waitingFor })
  : scheduled.value ? t('editor.scheduled')
    : props.published ? t('editor.published') : t('editor.draft')))
const text = computed(() => (props.lang ? cmsLanguageState(props.lang, word.value, locale.value) : word.value))
</script>

<template>
  <UTooltip v-if="published && waitingFor" :text="t('translation.waitingForBody', { lang: waitingFor })">
    <span class="inline-flex items-center gap-1.5 text-sm text-default min-w-0" tabindex="0">
      <UIcon name="i-lucide-hourglass" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span class="truncate">{{ text }}</span>
    </span>
  </UTooltip>
  <UTooltip v-else-if="scheduled" :text="t('editor.scheduledFor', { date: formatDate(scheduledFor!) })">
    <span class="inline-flex items-center gap-1.5 text-sm text-default min-w-0" tabindex="0">
      <UIcon name="i-lucide-clock" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span class="truncate">{{ text }}</span>
    </span>
  </UTooltip>
  <span v-else class="inline-flex items-center gap-1.5 text-sm min-w-0" :class="props.published ? 'text-default' : 'text-muted'">
    <span class="size-2 rounded-full shrink-0" :class="props.published ? 'bg-success' : 'border border-(--ui-text-dimmed)'" aria-hidden="true" />
    <span class="truncate">{{ text }}</span>
  </span>
</template>
