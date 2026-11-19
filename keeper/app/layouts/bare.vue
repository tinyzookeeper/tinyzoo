<template>
  <div class="moment min-h-dvh flex flex-col">
    <header class="px-5 pt-6 sm:px-8">
      <div class="flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" class="size-8">
        <span class="font-display font-bold text-lg text-highlighted">Keeper</span>
      </div>
    </header>
    <main class="flex-1 flex items-start sm:items-center justify-center px-4 py-10">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </main>
  </div>
</template>
