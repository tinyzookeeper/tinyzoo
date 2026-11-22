<script setup lang="ts">
const t = useT()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar />
    <main class="flex-1">
      <slot />
    </main>
    <footer class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 text-xs text-dimmed sm:px-6">
      <span class="inline-flex items-center gap-2 opacity-80"><ZLogo size="sm" /><span class="sr-only">tinyzoo</span></span>
      <span>{{ t('footer.line') }}</span>
    </footer>
  </div>
</template>
