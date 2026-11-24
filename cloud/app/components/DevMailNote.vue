<script setup lang="ts">
// Development only: e-mail is printed to the server log, not sent, so the page shows the link
// to open by hand (as Keeper does with invitations). Never rendered without a link, and the
// server only hands one out in development with NUXT_MAIL_TRANSPORT=log.
const props = defineProps<{ url: string | null | undefined; label: string }>()
const t = useT()
const toast = useToast()
async function copy() {
  if (!props.url) return
  await navigator.clipboard.writeText(props.url).catch(() => {})
  toast.add({ title: t('dev.copied'), icon: 'i-lucide-check' })
}
</script>

<template>
  <div v-if="url" class="z-note flex flex-col gap-2 p-3.5 text-sm" data-dev-mail>
    <p class="flex items-center gap-2 font-medium text-highlighted">
      <UIcon name="i-lucide-flask-conical" class="size-4 shrink-0" />
      {{ t('dev.mailTitle') }}
    </p>
    <p class="z-moment-text text-pretty">{{ t('dev.mailText') }}</p>
    <div class="flex flex-wrap items-center gap-2">
      <UButton :to="url" :label="label" color="neutral" variant="outline" size="sm" icon="i-lucide-mail-open" data-dev-link />
      <UButton :label="t('dev.copy')" color="neutral" variant="ghost" size="sm" icon="i-lucide-copy" @click="copy" />
    </div>
  </div>
</template>
