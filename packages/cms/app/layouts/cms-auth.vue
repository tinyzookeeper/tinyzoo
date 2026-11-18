<script setup lang="ts">
// Sign-in, first-run setup, password reset and invitation pages: tinyzoo's cream
// (charcoal in dark mode), no card — one animal above a short greeting, the client's
// name, a narrow form, and tinyzoo's signature at the bottom. First-run setup brings
// its own animals (the whole family says hello), so the layout's one stays away there.
// The client's brand: the full logo, larger; else the mark or the initials with the name.
const { unbranded, signature } = useCmsAdminHead()
const { t } = useCmsI18n()
const route = useRoute()
const animal = computed(() => (route.path.startsWith('/admin/setup') ? null : cmsCharacter('hedgehog')))
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center px-4 bg-(--cms-auth-bg)">
    <!-- anchored from the top, so a message appearing below never shifts the card -->
    <main class="cms-touch w-full max-w-[22rem] flex-1 flex flex-col justify-start pt-[12dvh] pb-10 sm:pt-[16dvh]">
      <img v-if="animal" :src="animal.url" alt="" class="mx-auto mb-6 h-20 sm:h-24 w-auto select-none" draggable="false">
      <div class="flex justify-center mb-6">
        <CmsBrandLogo size="auth" class="max-w-56" />
      </div>
      <slot />
    </main>
    <footer class="pb-6 flex items-center justify-center gap-1.5 text-xs text-muted">
      <span>{{ t('auth.poweredBy') }}</span>
      <template v-if="signature && !unbranded">
        <span aria-hidden="true">·</span>
        <span class="inline-flex items-center gap-1">
          <CmsMascot class="h-3 w-auto" />
          <CmsWordmark class="h-2.5 w-auto" />
          <span class="sr-only">tinyzoo</span>
        </span>
      </template>
    </footer>
  </div>
</template>
