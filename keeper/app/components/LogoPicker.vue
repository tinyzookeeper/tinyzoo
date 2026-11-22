<script setup lang="ts">
import type { LogoOrigin } from '#keeper/types/keeper'

// A team's or workspace's logo in its settings: what it shows now (its own upload, or one
// borrowed from a site or a team), with Upload and Remove for whoever may change it.
// `endpoint` takes a multipart PUT (field `file`) and a DELETE (logos.ts).
const props = defineProps<{
  origin: LogoOrigin
  /** The team or workspace, for the initials and the sentences. */
  name: string
  /** `team` or `workspace`: what borrows from what. */
  kind: 'team' | 'workspace'
  endpoint: string
  canEdit?: boolean
}>()
const emit = defineEmits<{ changed: [] }>()
const toast = useToast()
const input = ref<HTMLInputElement>()
const busy = ref<'upload' | 'remove' | null>(null)

const initials = computed(() => props.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?')
const line = computed(() => {
  const o = props.origin
  if (o.ownLogo) return `${props.name}'s own logo.`
  if (o.logoFrom?.kind === 'site') return `From the site ${o.logoFrom.name}: Keeper reads it from the site itself.`
  if (o.logoFrom?.kind === 'team') return `From the team ${o.logoFrom.name}.`
  return props.kind === 'team'
    ? 'None yet: it shows the logo of its first site that has one, else its initials.'
    : 'None yet: it shows its default team’s logo, else its initials.'
})

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  if (file.size > 512 * 1024) {
    toast.add({ title: 'That file is too large', description: 'Use a logo of at most 512 KB: an SVG, or a PNG of about 512 × 512.', color: 'error' })
    return
  }
  busy.value = 'upload'
  try {
    const body = new FormData()
    body.append('file', file)
    await $fetch(props.endpoint, { method: 'PUT', body })
    emit('changed')
    toast.add({ title: 'Logo saved', color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: 'Could not save the logo', description: errorMessage(err), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

async function remove() {
  busy.value = 'remove'
  try {
    await $fetch(props.endpoint, { method: 'DELETE' })
    emit('changed')
  }
  catch (err) {
    toast.add({ title: 'Could not remove the logo', description: errorMessage(err), color: 'error' })
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <KLogo :logo="origin.logo" class="size-14 rounded-xl">
        <span class="inline-flex size-14 shrink-0 items-center justify-center rounded-xl bg-(--k-moment-strong) text-base font-semibold text-highlighted">{{ initials }}</span>
      </KLogo>
      <p class="min-w-0 text-sm text-pretty text-toned">{{ line }}</p>
    </div>
    <div v-if="canEdit" class="flex shrink-0 gap-2">
      <input ref="input" type="file" accept="image/svg+xml,image/png,image/webp,image/jpeg,image/gif" class="hidden" @change="upload">
      <UButton :label="origin.ownLogo ? 'Replace' : 'Upload logo'" icon="i-lucide-upload" color="neutral" variant="outline" size="sm" :loading="busy === 'upload'" @click="input?.click()" />
      <UButton v-if="origin.ownLogo" label="Remove" color="neutral" variant="ghost" size="sm" :loading="busy === 'remove'" @click="remove" />
    </div>
  </div>
</template>
