<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-muted/30">
    <div class="text-center">
      <div class="size-12 rounded-2xl bg-primary mx-auto mb-5 flex items-center justify-center text-inverted font-bold text-xl">C</div>
      <h1 class="text-3xl font-bold mb-2">tinyzoo</h1>
      <p class="text-muted mb-6">A code-first CMS layer for Nuxt.</p>
      <UButton to="/admin" size="lg" trailing-icon="i-lucide-arrow-right">
        {{ loggedIn ? 'Open dashboard' : 'Sign in' }}
      </UButton>
    </div>
  </div>
</template>
