// The Wedding template's own helpers: its words, the couple's names, and which photographs
// each look shows. The content is in the CMS; Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { CmsMedia, Page, SiteSettings } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** Every address is a page built from blocks: the wedding has no entries with pages of their own. */
export const ENTRY_PAGES: EntryPage[] = []

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `program` (for `/#program`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── the couple ──

export interface Couple {
  /** "Anežka" (or the whole name when it is not two names) */
  first: string
  /** "Šimon"; null when the site's name is not two names joined by "a", "&", "and" or "+" */
  second: string | null
  /** "A", "Š" */
  initials: string[]
}

/** "Anežka a Šimon" → Anežka, Šimon, A, Š. A name that is not a pair stays whole. */
export function coupleOf(name: string | null | undefined): Couple {
  const whole = (name ?? '').trim().replace(/\s+/g, ' ')
  const pair = /^(.+?)\s+(?:a|&|and|und|\+)\s+(.+)$/i.exec(whole)
  const initial = (s: string) => (s.trim()[0] ?? '').toUpperCase()
  if (pair) return { first: pair[1]!, second: pair[2]!, initials: [initial(pair[1]!), initial(pair[2]!)] }
  return { first: whole, second: null, initials: whole.split(' ').slice(0, 2).map(initial).filter(Boolean) }
}

/** "Sedmilípy u Sněžného, Vysočina" → "Sedmilípy u Sněžného": the place without its region, where a line is short. */
export const beforeComma = (text: string | null | undefined): string => (text ?? '').split(',')[0]!.trim()

/** "Devět skal, to ráno, kdy…" → ["Devět skal", "to ráno, kdy…"]: the words a look sets larger, and the rest. */
export function captionParts(caption: string | null | undefined): [lead: string, rest: string] {
  const text = (caption ?? '').trim()
  const at = text.indexOf(', ')
  return at === -1 ? ['', text] : [text.slice(0, at), text.slice(at + 2)]
}

/** "790 Kč / osoba" → ["790 Kč", "/ osoba"]: the price, and what it is for. */
export function priceParts(price: string | null | undefined): [amount: string, unit: string] {
  const text = (price ?? '').trim()
  const at = text.indexOf('/')
  return at === -1 ? [text, ''] : [text.slice(0, at).trim(), `/ ${text.slice(at + 1).trim()}`]
}

// ── which photographs a look shows ──
// One set of content serves three designs that place photographs differently. These rules are
// the only place that knows which look takes which; the looks' components and the gallery
// (which leaves out what the page already shows) both ask here.

type Photo = { image: CmsMedia | null }
const withImage = <T extends Photo>(items: T[] | null | undefined): Array<T & { image: CmsMedia }> => (items ?? []).filter((p): p is T & { image: CmsMedia } => !!p.image)

/** The opening's photograph: Večer's own for the dark opening, Magazín's own for the cover, else the couple's portrait. */
export function invitationPhoto(block: BlockOf<'invitation'>, look: string): CmsMedia | null {
  if (look === 'vecer') return block.nightImage ?? block.image
  if (look === 'magazin') return block.coverImage ?? block.image
  return block.image
}

/** The programme's photographs: Oznámení the first, Večer the last (across the page), Magazín all. */
export function programmePhotos(block: BlockOf<'programme'>, look: string) {
  const all = withImage(block.photos)
  if (look === 'oznameni') return all.slice(0, 1)
  if (look === 'vecer') return all.slice(-1)
  return all
}

/** The place's photographs: Oznámení the first two, Večer the first and the last, Magazín the first. */
export function placePhotos(block: BlockOf<'place'>, look: string) {
  const all = withImage(block.photos)
  if (look === 'oznameni') return all.slice(0, 2)
  if (look === 'vecer') return all.length > 1 ? [all[0]!, all[all.length - 1]!] : all
  return all.slice(0, 1)
}

/** The photographs a page shows outside its gallery in this look, by id. */
export function shownPhotoIds(sections: Page['sections'], look: string, settings: Pick<SiteSettings, 'footerImage'> | null): Set<string> {
  const ids = new Set<string>()
  const add = (m: CmsMedia | null | undefined) => { if (m?.id) ids.add(m.id) }
  for (const b of sections) {
    if (b.type === 'invitation') {
      add(invitationPhoto(b, look))
      // (Večer shows the portrait too, framed under its opening)
      if (look !== 'magazin') add(b.image)
    }
    else if (b.type === 'story') {
      for (const p of b.parts) add(p.image)
      if (look === 'magazin') add(b.wideImage)
    }
    else if (b.type === 'programme') for (const p of programmePhotos(b, look)) add(p.image)
    else if (b.type === 'place') for (const p of placePhotos(b, look)) add(p.image)
    else if (b.type === 'rsvp') { if (look === 'vecer') add(b.image) }
    else if (b.type === 'gifts') add(b.image)
  }
  if (look === 'vecer') add(settings?.footerImage)
  return ids
}

/** How many photographs a look's gallery holds; null for all. */
export const GALLERY_SIZE: Record<string, number | null> = { oznameni: 5, vecer: 4, magazin: null }

/** A gallery's photographs in this look: without those the page already shows, as many as the look holds. */
export function galleryPhotos(block: BlockOf<'gallery'>, sections: Page['sections'], look: string, settings: Pick<SiteSettings, 'footerImage'> | null): CmsMedia[] {
  const shown = shownPhotoIds(sections, look, settings)
  const free = withImage(block.photos).map((p) => p.image).filter((m, i, all) => !shown.has(m.id) && all.findIndex((o) => o.id === m.id) === i)
  const size = GALLERY_SIZE[look]
  return size == null ? free : free.slice(0, size)
}

/** A photograph's shape, snapped to the three the looks lay out. */
export function shapeOf(media: { width: number | null; height: number | null } | null | undefined): 'wide' | 'tall' | 'square' {
  const r = media?.width && media?.height ? media.width / media.height : 1
  return r > 1.15 ? 'wide' : r < 0.9 ? 'tall' : 'square'
}
