<script setup lang="ts">
// Sign-in, first-run setup, password reset and invitation pages: one centred card on
// tinyzoo's cream, with the client's name above it and tinyzoo's mark in the footer.
const { productName, unbranded } = useCmsAdminHead()
const { t } = useCmsI18n()
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center justify-center px-4 py-12 bg-(--cms-auth-bg)">
    <div class="w-full max-w-sm">
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <CmsMascot v-if="unbranded" class="h-8 w-auto" />
        <span v-else class="size-8 rounded-md bg-inverted text-inverted grid place-items-center text-sm font-semibold" aria-hidden="true">{{ productName.charAt(0) }}</span>
        <span class="font-semibold text-highlighted">{{ productName }}</span>
      </div>
      <div class="cms-card p-6 sm:p-8">
        <slot />
      </div>
      <p class="mt-6 flex items-center justify-center gap-1.5 text-xs text-dimmed">
        <span>{{ t('auth.poweredBy') }}</span>
        <template v-if="!unbranded">
          <span aria-hidden="true">·</span>
          <span class="inline-flex items-center gap-1">
            <CmsMascot class="h-3 w-auto opacity-80" />
            <CmsWordmark class="h-2.5 w-auto opacity-80" />
            <span class="sr-only">tinyzoo</span>
          </span>
        </template>
      </p>
    </div>
  </div>
</template>
