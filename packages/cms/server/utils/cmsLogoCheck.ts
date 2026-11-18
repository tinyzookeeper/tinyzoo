import { readFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import sharp from 'sharp'
import { logoAddressKind, logoFileNotes, type CmsAdminTheme, type CmsLogoFileInfo, type CmsLogoSlot, type CmsThemeNote } from 'tinyzoo'

// The logo checks that need the files (development, at start: server/plugins/cms-logo-check.ts).
// The rules are pure and live in src/themeLogo.ts; this reads what they need: a `/…`
// address from the site's public/ folder, an https:// one over the network (4 s at most).

/** The notes on the theme's logos: the address notes the theme already has, then what the files are like. */
export async function checkAdminLogos(theme: CmsAdminTheme, publicDir: string): Promise<CmsThemeNote[]> {
  const notes = theme.notes.filter((n) => n.kind === 'logo')
  const slots: Array<[CmsLogoSlot, string | null]> = [
    ['full', theme.logo.full],
    ['mark', theme.logo.mark],
    ['fullDark', theme.logo.fullDarkPlate ? null : theme.logo.fullDark],
    ['markDark', theme.logo.markDarkPlate ? null : theme.logo.markDark],
  ]
  const checked = await Promise.all(slots.map(async ([slot, address]) => {
    if (!address) return []
    const info = await logoFileInfo(address, publicDir)
    return info ? logoFileNotes(slot, address, info) : []
  }))
  return [...notes, ...checked.flat()]
}

/** What the logo at `address` is: its size, or that it is missing. `null` when it cannot be told (offline, no public folder). */
export async function logoFileInfo(address: string, publicDir: string): Promise<CmsLogoFileInfo | null> {
  let body: Buffer
  const kind = logoAddressKind(address)
  if (kind === 'path') {
    if (!publicDir) return null
    const path = decodeURIComponent(address.replace(/[?#].*$/, ''))
    const file = resolve(join(publicDir, path))
    const inside = relative(publicDir, file)
    if (!inside || inside.startsWith('..') || inside.startsWith(sep)) return null
    try {
      body = await readFile(file)
    }
    catch {
      return { missing: true, where: `no file at public${path}` }
    }
  }
  else if (kind === 'https' || kind === 'http') {
    try {
      const res = await fetch(address, { signal: AbortSignal.timeout(4000), redirect: 'follow' })
      if (!res.ok) return { missing: true, where: `the server answered ${res.status}` }
      body = Buffer.from(await res.arrayBuffer())
    }
    catch {
      return null
    }
  }
  else {
    return null
  }
  try {
    const meta = await sharp(body, { limitInputPixels: 80_000_000 }).metadata()
    return { width: meta.width ?? 0, height: meta.height ?? 0, vector: meta.format === 'svg' }
  }
  catch {
    return { unreadable: true }
  }
}
