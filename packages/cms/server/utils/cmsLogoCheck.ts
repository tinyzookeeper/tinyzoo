import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { logoAddressKind, logoFileNotes, type CmsAdminTheme, type CmsLogoFileInfo, type CmsLogoSlot, type CmsThemeNote } from 'tinyzoo'
import { BRAND_SOURCE_MAX_BYTES, brandSourcePath, publicFilePath, svgHasText } from './cmsBrandFiles'
import { fetchRemoteLogo } from './cmsRemoteLogo'

// The logo checks that need the files (development, at start: server/plugins/cms-logo-check.ts).
// The rules are pure and live in src/themeLogo.ts; this reads what they need: a `/…`
// address from the site's public/ folder, an https:// one over the network (4 s at most,
// public addresses only, like the PNG files). The address notes the theme already has are
// printed by the plugin first; these are only what the files are like.

/** The notes on the theme's logo files. Each logo is checked on its own: one that cannot be checked never hides the others. */
export async function checkAdminLogos(theme: Pick<CmsAdminTheme, 'logo'>, publicDir: string): Promise<CmsThemeNote[]> {
  const slots: Array<[CmsLogoSlot, string | null]> = [
    ['full', theme.logo.full],
    ['mark', theme.logo.mark],
    ['fullDark', theme.logo.fullDarkPlate ? null : theme.logo.fullDark],
    ['markDark', theme.logo.markDarkPlate ? null : theme.logo.markDark],
  ]
  const checked = await Promise.all(slots.map(async ([slot, address]): Promise<CmsThemeNote[]> => {
    if (!address) return []
    try {
      const notes: CmsThemeNote[] = []
      // The full logo and the mark are also made into PNG files on the server, which reads only pictures on the site or https.
      if ((slot === 'full' || slot === 'mark') && logoAddressKind(address) === 'path' && !brandSourcePath(address)) {
        notes.push({ kind: 'logo', message: `cms.admin.logo.${slot} "${address}" cannot be made into the PNG files (${slot === 'full' ? 'the email logo' : 'the tab and home-screen icons'}): tinyzoo reads only a picture file of the site, a path ending in .svg, .png, .webp, .jpg or .avif, outside /api/, with any % written as %25.` })
      }
      const info = await logoFileInfo(address, publicDir)
      return info ? [...notes, ...logoFileNotes(slot, address, info)] : notes
    }
    catch {
      return [] // a check that cannot run says nothing
    }
  }))
  return checked.flat()
}

/** What the logo at `address` is: its size, or that it is missing. `null` when it cannot be told (offline, no public folder). */
export async function logoFileInfo(address: string, publicDir: string): Promise<CmsLogoFileInfo | null> {
  let body: Buffer
  const kind = logoAddressKind(address)
  if (kind === 'path') {
    if (!publicDir) return null
    let path: string
    try {
      path = decodeURIComponent(address.replace(/[?#].*$/, ''))
    }
    catch {
      return { missing: true, where: 'the address is not a valid path: write a % in a file name as %25' }
    }
    const file = publicFilePath(publicDir, path)
    if (!file) return null
    try {
      body = await readFile(file)
    }
    catch {
      return { missing: true, where: `no file at public${path}` }
    }
  }
  else if (kind === 'https') {
    try {
      body = await fetchRemoteLogo(address, { timeoutMs: 4000, maxBytes: BRAND_SOURCE_MAX_BYTES })
    }
    catch (err) {
      const answered = /the server answered (\d+)/.exec(err instanceof Error ? err.message : '')
      return answered ? { missing: true, where: `the server answered ${answered[1]}` } : null
    }
  }
  else {
    return null // http:// and invalid addresses have their note already
  }
  try {
    const meta = await sharp(body, { limitInputPixels: 80_000_000 }).metadata()
    const vector = meta.format === 'svg'
    return { width: meta.width ?? 0, height: meta.height ?? 0, vector, ...(vector && svgHasText(body) ? { text: true } : {}) }
  }
  catch {
    return { unreadable: true }
  }
}
