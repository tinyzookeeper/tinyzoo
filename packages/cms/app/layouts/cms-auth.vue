<script setup lang="ts">
// Sign-in, first-run setup, password reset and invitation pages: one centred card.
const { productName } = useCmsAdminHead()
const { t } = useCmsI18n()
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center justify-center px-4 py-12 bg-muted">
    <div class="w-full max-w-sm">
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <span class="size-8 rounded-md bg-inverted text-inverted grid place-items-center text-sm font-semibold" aria-hidden="true">{{ productName.charAt(0) }}</span>
        <span class="font-semibold text-highlighted">{{ productName }}</span>
      </div>
      <div class="cms-card p-6 sm:p-8">
        <slot />
      </div>
      <p class="mt-6 text-center text-xs text-dimmed">{{ t('auth.poweredBy') }}</p>
    </div>
  </div>
</template>
