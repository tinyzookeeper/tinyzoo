<script setup lang="ts">
// Publication status, the same everywhere: a dot and a word, no pill.
// Draft = grey ring, on the website = green, scheduled (published, date still ahead) =
// an amber clock with the date in its tooltip. Published but held back (`waitingFor`: the name of the
// default language, which gates the other languages and is not live) = an amber hourglass: "Waiting for Czech".
// A translation being worked on (`translating`: the name of the default language, which visitors see
// meanwhile; a draft that was never on the website) = a muted languages mark: "Being translated".
// `lang` names whose state it is when an entry has languages: "English · Draft".
// `compact` (a phone's bar, where the state is the language switcher): the mark and `lang` as it is given ("EN"),
// nothing else is drawn. The control around it names the state in full ("Language: English · Draft").
const props = defineProps<{ published: boolean; scheduledFor?: string | Date | null; waitingFor?: string | null; translating?: string | null; lang?: string | null; compact?: boolean }>()
const { t, formatDate, locale } = useCmsI18n()
const scheduled = computed(() => props.published && !!props.scheduledFor && new Date(props.scheduledFor).getTime() > Date.now())
const translatingNow = computed(() => !props.published && !!props.translating)
const word = computed(() => (props.published && props.waitingFor ? t('translation.waitingFor', { lang: props.waitingFor })
  : scheduled.value ? t('editor.scheduled')
    : translatingNow.value ? t('translation.state.translating')
      : props.published ? t('editor.published') : t('editor.draft')))
const text = computed(() => (props.lang ? cmsLanguageState(props.lang, word.value, locale.value) : word.value))
</script>

<template>
  <!-- compact: no tooltip (a phone has no hover) and no tab stop of its own: the button around it is the control -->
  <UTooltip v-if="!compact && published && waitingFor" :text="t('translation.waitingForBody', { lang: waitingFor })">
    <span class="inline-flex items-center gap-1.5 text-sm text-default min-w-0" tabindex="0">
      <UIcon name="i-lucide-hourglass" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span class="truncate">{{ text }}</span>
    </span>
  </UTooltip>
  <UTooltip v-else-if="!compact && scheduled" :text="t('editor.scheduledFor', { date: formatDate(scheduledFor!) })">
    <span class="inline-flex items-center gap-1.5 text-sm text-default min-w-0" tabindex="0">
      <UIcon name="i-lucide-clock" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span class="truncate">{{ text }}</span>
    </span>
  </UTooltip>
  <UTooltip v-else-if="!compact && translatingNow" :text="t('translation.translatingBody', { lang: translating! })">
    <span class="inline-flex items-center gap-1.5 text-sm text-muted min-w-0" tabindex="0">
      <UIcon name="i-lucide-languages" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
      <span class="truncate">{{ text }}</span>
    </span>
  </UTooltip>
  <span v-else-if="!compact" class="inline-flex items-center gap-1.5 text-sm min-w-0" :class="props.published ? 'text-default' : 'text-muted'">
    <span class="size-2 rounded-full shrink-0" :class="props.published ? 'bg-success' : 'border border-(--ui-text-dimmed)'" aria-hidden="true" />
    <span class="truncate">{{ text }}</span>
  </span>
  <!-- compact: the same marks (green dot, grey ring, amber clock, amber hourglass, muted languages) and the code -->
  <span v-else class="inline-flex items-center gap-1.5 text-sm min-w-0" :class="props.published && !translatingNow ? 'text-default' : 'text-muted'">
    <UIcon v-if="published && waitingFor" name="i-lucide-hourglass" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
    <UIcon v-else-if="scheduled" name="i-lucide-clock" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
    <UIcon v-else-if="translatingNow" name="i-lucide-languages" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
    <span v-else class="size-2 rounded-full shrink-0" :class="props.published ? 'bg-success' : 'border border-(--ui-text-dimmed)'" aria-hidden="true" />
    <span aria-hidden="true">{{ lang }}</span>
  </span>
</template>
