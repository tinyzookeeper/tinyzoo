<script setup lang="ts">
import type { SiteView } from '#shared/api'
import { tidySlugInput } from '#shared/slug'

// Move a website here: the archive of a tinyzoo website that ran elsewhere (an export of this
// service, or `tinyzoo backup` with the site's `site.json`), an address for it, and it becomes
// a new website of the same template with its content, users and files. The archive is sent
// as it is, in one request.
const t = useT()
const errorText = useErrorText()
const { account } = useAccount()
useHead({ title: () => t('import.title') })

const form = reactive({ slug: '', name: '' })
const file = shallowRef<File | null>(null)
const busy = ref(false)
const error = ref('')
const onFile = (event: Event) => { file.value = (event.target as HTMLInputElement).files?.[0] ?? null }
const onSlug = (value: string | number) => { form.slug = tidySlugInput(String(value)) }

async function submit() {
  if (!file.value) { error.value = t('import.pick'); return }
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ site: SiteView }>('/api/sites/import', {
      method: 'POST', query: { slug: form.slug, name: form.name.trim() }, body: file.value, headers: { 'content-type': 'application/x-tar' },
    })
    await navigateTo(`/sites/${res.site.id}`)
  }
  catch (err) { error.value = errorText(err) }
  finally { busy.value = false }
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
    <nav class="mb-3 flex items-center gap-1.5 text-sm" :aria-label="t('nav.where')">
      <NuxtLink to="/sites" class="text-muted hover:text-highlighted">{{ t('nav.sites') }}</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
      <span class="truncate font-medium text-highlighted">{{ t('import.title') }}</span>
    </nav>
    <h1 class="z-display text-[1.75rem] leading-tight text-balance text-highlighted sm:text-4xl">{{ t('import.title') }}</h1>
    <p class="mt-1.5 max-w-2xl text-[0.9375rem] text-pretty text-muted">{{ t('import.lead') }}</p>

    <InfoCard class="mt-8" :title="t('import.formTitle')">
      <form class="flex flex-col gap-4" data-import @submit.prevent="submit">
        <UFormField :label="t('import.file')" name="file">
          <input type="file" accept=".tar,application/x-tar" required class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-(--ui-bg-elevated) file:px-3 file:py-2 file:text-sm file:font-medium file:text-highlighted" data-import-file @change="onFile">
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('import.slug')" name="slug">
            <UInput :model-value="form.slug" size="lg" required class="w-full" autocapitalize="none" autocomplete="off" spellcheck="false" :ui="{ base: 'font-mono' }" data-import-slug @update:model-value="onSlug">
              <template #trailing><span class="font-mono text-[0.8125rem] text-dimmed">{{ account.siteHost }}</span></template>
            </UInput>
          </UFormField>
          <UFormField :label="t('import.name')" name="name" :help="t('import.nameHint')">
            <UInput v-model="form.name" size="lg" maxlength="80" class="w-full" data-import-name />
          </UFormField>
        </div>
        <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" data-import-error />
        <div class="flex justify-end">
          <UButton type="submit" :label="t('import.submit')" size="lg" icon="i-lucide-upload" :loading="busy" :disabled="!file || !form.slug" data-import-submit />
        </div>
      </form>
    </InfoCard>
  </div>
</template>
