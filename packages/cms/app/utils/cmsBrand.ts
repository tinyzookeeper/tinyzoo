import faviconUrl from '../assets/brand/logo/favicon.svg?url'
import mascotUrl from '../assets/brand/logo/mascot.svg?url'
import mascotReversedUrl from '../assets/brand/logo/mascot-reversed.svg?url'
import wordmarkUrl from '../assets/brand/logo/wordmark.svg?url'
import wordmarkReversedUrl from '../assets/brand/logo/wordmark-reversed.svg?url'
import logoUrl from '../assets/brand/logo/logo-primary.svg?url'
import logoReversedUrl from '../assets/brand/logo/logo-primary-reversed.svg?url'

/**
 * tinyzoo's own brand inside the admin (docs/brand/brand-guide.md). The admin stays
 * white-label — the client's name leads — and tinyzoo shows in a few calm places:
 * the sign-in footer, first-run setup, the tab icon and the animals in empty states.
 */
export const cmsBrand = { name: 'tinyzoo', faviconUrl, mascotUrl, mascotReversedUrl, wordmarkUrl, wordmarkReversedUrl, logoUrl, logoReversedUrl }

const muted = import.meta.glob('../assets/brand/characters/muted/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const bright = import.meta.glob('../assets/brand/characters/bright/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const list = (files: Record<string, string>) => Object.entries(files)
  .map(([path, url]) => ({ name: path.split('/').pop()!.replace(/\.svg$/, ''), url }))
  .sort((a, b) => a.name.localeCompare(b.name))

/** The animal family: 26 muted characters (the admin's) and the 6 bright ones. */
export const cmsCharacters = { muted: list(muted), bright: list(bright) }

/** The same animal for the same place every time (a collection always has its own). */
export function cmsCharacterFor(seed: string): { name: string; url: string } {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return cmsCharacters.muted[h % cmsCharacters.muted.length]!
}
