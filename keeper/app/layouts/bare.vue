<template>
  <div class="flex min-h-dvh flex-col bg-(--k-moment-bg)">
    <main class="flex flex-1 items-start justify-center px-4 pt-14 pb-10 sm:items-center sm:pt-10">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </main>
    <footer class="flex justify-center pb-6">
      <KBrand signature />
      <span class="sr-only">Keeper, part of tinyzoo</span>
    </footer>
  </div>
</template>
