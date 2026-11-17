<script setup lang="ts">
// The address an entry has on the website, under its title. A link to the live page only while the
// page (in the language being edited) is on the website; otherwise it says "Not on the website yet"
// and offers the preview, which is what can be seen of it now.
defineProps<{ path: string; live: boolean; canPreview?: boolean }>()
const emit = defineEmits<{ preview: [] }>()
const { t } = useCmsI18n()
</script>

<template>
  <p class="mt-1.5 flex flex-wrap min-w-0 items-center gap-x-2 gap-y-0.5 text-xs text-muted">
    <a v-if="live" :href="path" target="_blank" rel="noopener" class="min-w-0 truncate font-mono hover:text-highlighted">
      {{ path }} <UIcon name="i-lucide-arrow-up-right" class="size-3 align-[-1px]" />
    </a>
    <template v-else>
      <span class="min-w-0 max-w-full truncate font-mono">{{ path }}</span>
      <span class="shrink-0 text-dimmed" aria-hidden="true">·</span>
      <span class="shrink-0">{{ t('editor.notPublished') }}</span>
      <template v-if="canPreview">
        <span class="shrink-0 text-dimmed" aria-hidden="true">·</span>
        <!-- a link-styled control, not a <button>: it only shows the page, so a read-only form (a disabled fieldset) keeps it -->
        <a href="#" role="button" class="shrink-0 underline underline-offset-2 hover:text-highlighted" @click.prevent="emit('preview')" @keydown.space.prevent="emit('preview')">{{ t('editor.preview') }}</a>
      </template>
    </template>
  </p>
</template>
