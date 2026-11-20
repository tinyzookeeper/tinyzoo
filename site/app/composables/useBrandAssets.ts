import type { DropdownMenuItem } from '@nuxt/ui'
import { copyPng, copySvg, saveBlob, svgToPng } from '~/lib/brand-assets'
import { DESIGN_SYSTEM_TEXT } from '~/lib/design-system-i18n'

/** A file on the design-system page: its name for the download (no extension) and its SVG. */
export interface BrandAsset {
  name: string
  svg: () => Promise<string>
}

/** Download a brand file as SVG or PNG, or copy it, with a toast saying how it went. */
export function useBrandAssets() {
  const toast = useToast()
  const { lang } = useLang()
  const tx = computed(() => DESIGN_SYSTEM_TEXT[lang.value])
  const failed = (title: string) => toast.add({ title, color: 'error', icon: 'i-lucide-circle-alert' })

  async function download(asset: BrandAsset, format: 'svg' | 'png') {
    try {
      const svg = await asset.svg()
      saveBlob(format === 'svg' ? new Blob([svg], { type: 'image/svg+xml' }) : await svgToPng(svg), `${asset.name}.${format}`)
    }
    catch {
      failed(tx.value.downloadFailed)
    }
  }

  // No await before the clipboard call: the browser only allows it while the click is fresh.
  function copy(asset: BrandAsset, format: 'svg' | 'png') {
    const done = format === 'png' ? copyPng(asset.svg().then((s) => svgToPng(s))) : copySvg(asset.svg())
    done.then(
      () => toast.add({ title: format === 'png' ? tx.value.copiedPng : tx.value.copiedSvg, icon: 'i-lucide-clipboard-check' }),
      () => failed(tx.value.copyFailed),
    )
  }

  const copyItems = (asset: BrandAsset): DropdownMenuItem[] => [
    { label: tx.value.copyPng, icon: 'i-lucide-image', onSelect: () => copy(asset, 'png') },
    { label: tx.value.copySvg, icon: 'i-lucide-code', onSelect: () => copy(asset, 'svg') },
  ]

  /** Everything for one file: download either format, copy either. */
  const menu = (asset: BrandAsset): DropdownMenuItem[][] => [
    [
      { label: tx.value.downloadSvg, icon: 'i-lucide-download', onSelect: () => download(asset, 'svg') },
      { label: tx.value.downloadPng, icon: 'i-lucide-download', onSelect: () => download(asset, 'png') },
    ],
    copyItems(asset),
  ]

  return { download, copy, copyItems, menu }
}
