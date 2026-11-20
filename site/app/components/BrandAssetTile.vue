<script setup lang="ts">
// One logo file on the design-system page: drawn on the background it is made for, with its
// downloads (SVG, PNG) and a copy menu underneath.
import { fetchSvg } from '~/lib/brand-assets'
import { DESIGN_SYSTEM_TEXT } from '~/lib/design-system-i18n'

const props = defineProps<{
  /** The file under public/, e.g. /brand/keeper/logo.svg. */
  src: string
  /** The download's name, without the extension. */
  name: string
  /** The brand, for the alt text and the group's name. */
  brand: string
  /** A full logo, a mark, or a square profile picture (its own background). */
  kind: 'logo' | 'mark' | 'avatar'
  /** Made for dark backgrounds (the reversed file). */
  dark?: boolean
}>()

const { lang } = useLang()
const tx = computed(() => DESIGN_SYSTEM_TEXT[lang.value])
const { download, copyItems } = useBrandAssets()
const asset = computed(() => ({ name: props.name, svg: () => fetchSvg(props.src) }))
const label = computed(() => `${props.brand}: ${tx.value.assetKinds[props.kind]}, ${tx.value.assetOn[props.dark ? 'dark' : 'light']}`)
</script>

<template>
  <div role="group" :aria-label="label" class="cms-card flex flex-col overflow-hidden">
    <div class="grid h-32 place-items-center p-6" :style="{ background: dark ? 'var(--tz-charcoal)' : 'var(--tz-cream)' }">
      <img :src="src" :alt="`${brand} ${tx.assetKinds[kind]}`" class="w-auto max-w-full select-none" :class="{ logo: 'h-9', mark: 'h-14', avatar: dark ? 'h-20 rounded-xl' : 'h-20 rounded-xl ring ring-default' }[kind]" draggable="false">
    </div>
    <div class="flex flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-default px-3 py-2.5">
      <span class="min-w-0 leading-tight">
        <span class="block text-sm font-medium text-highlighted">{{ tx.assetKinds[kind] }}</span>
        <span class="block text-xs text-muted">{{ tx.assetOn[dark ? 'dark' : 'light'] }}</span>
      </span>
      <span class="flex items-center gap-1">
        <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-download" :aria-label="tx.downloadSvg" @click="download(asset, 'svg')">SVG</UButton>
        <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-download" :aria-label="tx.downloadPng" @click="download(asset, 'png')">PNG</UButton>
        <UDropdownMenu :items="copyItems(asset)" :content="{ align: 'end' }">
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-copy" :aria-label="tx.copy" />
        </UDropdownMenu>
      </span>
    </div>
  </div>
</template>
