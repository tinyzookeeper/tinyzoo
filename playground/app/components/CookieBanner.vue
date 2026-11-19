<script setup lang="ts">
// A cookie banner of the site's own, built on useConsent() only (docs/consent.md, "Your own
// banner"). The playground shows it with ?banner=custom instead of <CmsConsent />.
const {
  bannerVisible, settingsOpen, texts, categories, draft,
  acceptAll, rejectAll, save, open, close, saving, error,
} = useConsent()

// The settings are a native modal <dialog>: focus stays inside, Escape closes it.
const dialog = ref<HTMLDialogElement | null>(null)
watch(settingsOpen, (isOpen) => {
  if (isOpen && !dialog.value?.open) dialog.value?.showModal()
  if (!isOpen && dialog.value?.open) dialog.value.close()
}, { flush: 'post' })

const button = 'flex-1 basis-36 rounded-lg px-4 py-2.5 font-medium disabled:opacity-60'
const solid = `${button} bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200`
const quiet = `${button} border border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800`
</script>

<template>
  <div
    v-if="bannerVisible" role="dialog" aria-labelledby="cookie-title"
    class="fixed inset-x-2 bottom-2 z-50 mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-xl sm:inset-x-4 sm:bottom-4 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
  >
    <h2 id="cookie-title" class="text-lg font-semibold">{{ texts.title }}</h2>
    <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
      {{ texts.body }}
      <a v-if="texts.privacyUrl" :href="texts.privacyUrl" class="underline">{{ texts.privacyLabel }}</a>
    </p>
    <div class="mt-4 flex flex-wrap gap-2">
      <!-- "Reject all" and "Accept all": the same size and style -->
      <button type="button" :class="solid" :disabled="saving" @click="rejectAll()">{{ texts.rejectAll }}</button>
      <button type="button" :class="solid" :disabled="saving" @click="acceptAll()">{{ texts.acceptAll }}</button>
      <button type="button" :class="quiet" aria-haspopup="dialog" @click="open()">{{ texts.settings }}</button>
    </div>
  </div>

  <dialog
    ref="dialog" aria-labelledby="cookie-settings-title"
    class="m-auto w-[min(36rem,calc(100vw-1rem))] rounded-2xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/50 dark:bg-gray-900 dark:text-white"
    @cancel.prevent="close()" @close="close()"
  >
    <form class="flex max-h-[88dvh] flex-col" @submit.prevent="save()">
      <header class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 pr-3 pl-5 dark:border-gray-800">
        <h2 id="cookie-settings-title" class="text-lg font-semibold">{{ texts.settingsTitle }}</h2>
        <button type="button" class="size-11 rounded-full text-2xl hover:bg-gray-100 dark:hover:bg-gray-800" :aria-label="texts.close" @click="close()">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <ul class="divide-y divide-gray-200 overflow-y-auto px-5 dark:divide-gray-800">
        <li v-for="c in categories" :key="c.key" class="py-4">
          <label class="flex items-start justify-between gap-4">
            <span>
              <span class="block font-medium">{{ c.label }}</span>
              <span class="mt-1 block text-sm text-gray-600 dark:text-gray-400">{{ c.description }}</span>
            </span>
            <span class="flex shrink-0 flex-col items-end gap-1">
              <input v-model="draft[c.key]" type="checkbox" role="switch" class="size-5 accent-gray-900 dark:accent-white" :disabled="c.required">
              <span v-if="c.required" class="text-xs text-gray-500">{{ texts.alwaysOn }}</span>
            </span>
          </label>

          <details v-if="c.services.length" class="mt-2 text-sm">
            <summary class="cursor-pointer py-2 underline">{{ texts.services }} ({{ c.services.length }})</summary>
            <ul class="space-y-2">
              <li v-for="s in c.services" :key="s.name" class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p class="font-medium">{{ s.name }}</p>
                <p class="text-gray-600 dark:text-gray-300">{{ s.purpose }}</p>
                <dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-gray-600 dark:text-gray-400">
                  <template v-if="s.provider"><dt>{{ texts.provider }}</dt><dd>{{ s.provider }}</dd></template>
                  <template v-if="s.cookies.length"><dt>{{ texts.cookies }}</dt><dd>{{ s.cookies.join(', ') }}</dd></template>
                  <template v-if="s.duration"><dt>{{ texts.duration }}</dt><dd>{{ s.duration }}</dd></template>
                </dl>
                <a v-if="s.privacyUrl" :href="s.privacyUrl" target="_blank" rel="noopener" class="underline">{{ texts.privacyLabel }}</a>
              </li>
            </ul>
          </details>
        </li>
      </ul>

      <footer class="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
        <!-- The choice holds in this browser even when the server could not record it. -->
        <p v-if="error" role="status" class="mb-3 text-sm text-gray-600 dark:text-gray-400">{{ error }}</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" :class="solid" :disabled="saving" @click="rejectAll()">{{ texts.rejectAll }}</button>
          <button type="button" :class="solid" :disabled="saving" @click="acceptAll()">{{ texts.acceptAll }}</button>
          <button type="submit" :class="quiet" :disabled="saving">{{ texts.save }}</button>
        </div>
      </footer>
    </form>
  </dialog>
</template>
