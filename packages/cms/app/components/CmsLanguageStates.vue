<script setup lang="ts">
// The other languages of one entry and the state of each, compactly: "EN ● DE ○". Each mark has its
// words in a tooltip and for screen readers ("English: On the website · not translated"), in the same
// words as the editor (green dot = on the website, ring = draft, clock = scheduled, hourglass = waiting
// for the default language, languages mark = being translated: never on the website yet, visitors see the
// default language meanwhile). The code is dimmed for a language not translated yet.
const props = defineProps<{
  /** The row as the list loaded it (`__states`, `__locales`). */
  row: Record<string, any>
  /** The entity's languages (`meta.locales`: default, all, labels). */
  locales: { default: string; all: string[]; labels?: Record<string, any> }
}>()
const { t, languageName } = useCmsI18n()
const name = (code: string) => languageName(code, props.locales.labels?.[code])
const codes = computed(() => props.locales.all.filter((c) => c !== props.locales.default))
const stateOf = (code: string): 'published' | 'scheduled' | 'draft' => props.row.__states?.[code]?.state ?? 'draft'
const translated = (code: string) => (props.row.__locales ?? []).includes(code)
function words(code: string): string {
  const s = props.row.__states?.[code]
  const parts = [s?.waitingFor ? t('translation.waitingFor', { lang: name(s.waitingFor) })
    : s?.translating ? t('translation.state.translating')
      : t(`translation.state.${stateOf(code)}`)]
  if (s?.translating) parts.push(t('translation.translatingBody', { lang: name(props.locales.default) }))
  if (s && !s.own) parts.push(t('translation.followsShort'))
  if (!translated(code)) parts.push(t('translation.notTranslated'))
  return `${cmsCapitalize(name(code))}: ${parts.join(' · ')}`
}
</script>

<template>
  <span class="inline-flex items-center gap-2.5 text-xs">
    <UTooltip v-for="code in codes" :key="code" :text="words(code)">
      <span class="relative z-10 inline-flex items-center gap-1">
        <span class="font-medium" :class="translated(code) ? 'text-default' : 'text-dimmed'" aria-hidden="true">{{ code.toUpperCase() }}</span>
        <UIcon v-if="row.__states?.[code]?.waitingFor" name="i-lucide-hourglass" class="size-3 text-warning" aria-hidden="true" />
        <UIcon v-else-if="stateOf(code) === 'scheduled'" name="i-lucide-clock" class="size-3 text-warning" aria-hidden="true" />
        <UIcon v-else-if="row.__states?.[code]?.translating" name="i-lucide-languages" class="size-3 text-dimmed" aria-hidden="true" />
        <span v-else class="size-2 rounded-full" :class="stateOf(code) === 'published' ? 'bg-success' : 'border border-(--ui-text-dimmed)'" aria-hidden="true" />
        <span class="sr-only">{{ words(code) }}</span>
      </span>
    </UTooltip>
  </span>
</template>
