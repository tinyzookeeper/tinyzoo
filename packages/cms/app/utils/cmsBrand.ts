import faviconUrl from '../assets/brand/logo/favicon.svg?url'
import mascotUrl from '../assets/brand/logo/mascot.svg?url'
import mascotReversedUrl from '../assets/brand/logo/mascot-reversed.svg?url'
import wordmarkUrl from '../assets/brand/logo/wordmark.svg?url'
import wordmarkReversedUrl from '../assets/brand/logo/wordmark-reversed.svg?url'
import logoUrl from '../assets/brand/logo/logo-primary.svg?url'
import logoReversedUrl from '../assets/brand/logo/logo-primary-reversed.svg?url'

/**
 * tinyzoo's own brand inside the admin (docs/brand/brand-guide.md). The client's name
 * leads; tinyzoo shows in calm places: its signature under the sidebar and on the
 * sign-in, the tab icon, and one animal at each moment (welcome, sign-in, empty
 * states, success, errors) — never in the chrome.
 */
export const cmsBrand = { name: 'tinyzoo', faviconUrl, mascotUrl, mascotReversedUrl, wordmarkUrl, wordmarkReversedUrl, logoUrl, logoReversedUrl }

const muted = import.meta.glob('../assets/brand/characters/muted/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const bright = import.meta.glob('../assets/brand/characters/bright/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const list = (files: Record<string, string>) => Object.entries(files)
  .map(([path, url]) => ({ name: path.split('/').pop()!.replace(/\.svg$/, ''), url }))
  // One fixed order everywhere (in Czech "ch" sorts after "h": the server and a Czech browser would disagree).
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))

/** The animal family: 26 muted characters (the admin's) and the 6 bright ones. */
export const cmsCharacters = { muted: list(muted), bright: list(bright) }

/** The same animal for the same place every time (a collection always has its own). */
export function cmsCharacterFor(seed: string): { name: string; url: string } {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return cmsCharacters.muted[h % cmsCharacters.muted.length]!
}

/** One animal by name ('owl', 'hedgehog'…), muted first — for the fixed moments. */
export function cmsCharacter(name: string, set: 'muted' | 'bright' = 'muted'): { name: string; url: string } {
  return cmsCharacters[set].find((c) => c.name === name) ?? cmsCharacters.muted[0]!
}
