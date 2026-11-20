<script setup lang="ts">
// About: which version of tinyzoo the site runs (the first thing support asks for), since
// when this server runs, and what it is made of. Anyone signed in may look; "Copy details"
// puts the facts on the clipboard for an e-mail. A site that turned tinyzoo's signature off
// shows its own name here instead of tinyzoo's.
definePageMeta({ layout: 'admin' })
const { t } = useCmsI18n()
const toast = useToast()
const { theme, productName } = useCmsAdminBrand()
useHead({ title: () => t('about.title') })

interface About {
  tinyzoo: string
  node: string | null
  startedAt: string
  migrations: 'idle' | 'running' | 'done' | 'failed'
  plugins: { name: string; version: string }[]
}
const { data: about, error, refresh } = await useFetch<About>('/api/cms/_about', { key: 'cms-about' })

// tinyzoo signs the admin unless the site turned that off (`signature: false`).
const signed = computed(() => theme.value.signature !== false)
const migrationsText = computed(() => (about.value ? t(`about.migrations.${about.value.migrations}`) : ''))

/** The facts as plain lines, for a support e-mail. */
function details(a: About): string {
  return [
    `${signed.value ? 'tinyzoo' : productName.value} ${a.tinyzoo}`,
    `${t('about.runningSince')}: ${a.startedAt}`,
    a.node ? `${t('about.node')}: ${a.node}` : '',
    `${t('about.database')}: ${migrationsText.value}`,
    `${t('about.plugins')}: ${a.plugins.length ? a.plugins.map((p) => `${p.name} ${p.version}`).join(', ') : t('about.noPlugins')}`,
  ].filter(Boolean).join('\n')
}

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null
onBeforeUnmount(() => { if (copiedTimer) clearTimeout(copiedTimer) })
async function copyDetails() {
  if (!about.value) return
  try {
    await navigator.clipboard.writeText(details(about.value))
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = false }, 2000)
  }
  catch {
    toast.add({ title: t('about.copyFailed'), color: 'warning', icon: 'i-lucide-clipboard-x' })
  }
}
</script>

<template>
  <CmsPage narrow :title="t('about.title')" :description="t('about.description')" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('about.title') }]">
    <CmsLoadError v-if="error" :error="error" @retry="refresh()" />

    <div v-else-if="about" class="space-y-4">
      <!-- the version: the page's one brand moment -->
      <section class="cms-moment flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-5 sm:px-7 sm:py-6">
        <div class="min-w-0">
          <p v-if="signed" class="flex items-center gap-2">
            <CmsMascot class="h-6 w-auto" />
            <CmsWordmark class="h-4 w-auto" />
            <span class="sr-only">tinyzoo</span>
          </p>
          <p v-else class="cms-display truncate text-base text-highlighted">{{ productName }}</p>
          <p class="cms-display mt-2 text-2xl sm:text-[1.75rem] leading-tight text-highlighted tabular-nums">{{ t('about.version', { version: about.tinyzoo }) }}</p>
        </div>
        <UButton
          color="neutral" variant="outline" class="bg-(--cms-surface) max-sm:w-full max-sm:justify-center"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copyDetails"
        >
          {{ copied ? t('about.copied') : t('about.copy') }}
        </UButton>
      </section>

      <section class="cms-card overflow-hidden" :aria-label="t('about.title')">
        <dl class="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] text-sm">
          <dt class="px-4 pt-3 text-muted sm:pb-3">{{ t('about.versionLabel') }}</dt>
          <dd class="px-4 pb-3 sm:pt-3 text-highlighted tabular-nums">{{ signed ? 'tinyzoo' : productName }} {{ about.tinyzoo }}</dd>

          <dt class="border-t border-(--ui-border-muted) px-4 pt-3 text-muted sm:pb-3">{{ t('about.runningSince') }}</dt>
          <dd class="px-4 pb-3 sm:border-t sm:border-(--ui-border-muted) sm:pt-3">
            <CmsTime :value="about.startedAt" class="text-highlighted" />
            <span class="block text-xs text-muted">{{ t('about.runningSinceHint') }}</span>
          </dd>

          <template v-if="about.node">
            <dt class="border-t border-(--ui-border-muted) px-4 pt-3 text-muted sm:pb-3">{{ t('about.node') }}</dt>
            <dd class="px-4 pb-3 sm:border-t sm:border-(--ui-border-muted) sm:pt-3 font-mono text-[0.8125rem] text-highlighted">{{ about.node }}</dd>
          </template>

          <dt class="border-t border-(--ui-border-muted) px-4 pt-3 text-muted sm:pb-3">{{ t('about.database') }}</dt>
          <dd class="px-4 pb-3 sm:border-t sm:border-(--ui-border-muted) sm:pt-3" :class="about.migrations === 'failed' ? 'text-error' : 'text-highlighted'">{{ migrationsText }}</dd>

          <dt class="border-t border-(--ui-border-muted) px-4 pt-3 text-muted sm:pb-3">{{ t('about.plugins') }}</dt>
          <dd class="px-4 pb-3 sm:border-t sm:border-(--ui-border-muted) sm:pt-3">
            <ul v-if="about.plugins.length" class="flex flex-wrap gap-1.5">
              <li v-for="p in about.plugins" :key="p.name">
                <UBadge color="neutral" variant="subtle" size="md" class="font-normal">
                  {{ p.name }} <span class="font-mono text-muted tabular-nums">{{ p.version }}</span>
                </UBadge>
              </li>
            </ul>
            <span v-else class="text-muted">{{ t('about.noPlugins') }}</span>
          </dd>
        </dl>
      </section>
    </div>
  </CmsPage>
</template>
