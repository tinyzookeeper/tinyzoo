// The website's own words (what is not content: "Menu", "All", the errors) and the helpers of
// the gallery. The content is in the CMS; Nuxt auto-imports what is exported here. (Addresses,
// prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { Album, Page } from '../lib/cms-content'

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

export const DEFAULT_LANGUAGE = 'cs'

export interface Words {
  menu: string
  close: string
  previousPhoto: string
  nextPhoto: string
  mainMenu: string
  mobileMenu: string
  footerMenu: string
  contact: string
  all: string
  categories: string
  allAlbums: string
  /** "24 alb", "1 album" */
  albums: (n: number) => string
  /** "86 fotografií" */
  photos: (n: number) => string
  /** A hint under a row that is swiped on a phone */
  swipe: string
  phone: string
  email: string
  studio: string
  freeDates: string
  /** The line above the Instagram pictures in a footer */
  instagramNote: string
  /** A note beside the link to all albums: "je jich tam 24" */
  albumsNote: (n: number) => string
  noAlbums: string
  backToGallery: string
  sending: string
  draftPreview: string
  /** The preview's line when an owner's colour is shown lighter or darker than given; for the editor only. */
  ownColorShown: (given: string, shown: string) => string
  welcomeTitle: string
  welcomeBefore: string
  welcomeAdmin: string
  welcomeAfter: string
  notFoundTitle: string
  notFoundText: string
  errorTitle: string
  errorText: string
  goHome: string
  defaultName: string
}

const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

export const WORDS: Record<string, Words> = {
  cs: {
    menu: 'Menu', close: 'Zavřít', previousPhoto: 'Předchozí fotografie', nextPhoto: 'Další fotografie', mainMenu: 'Hlavní menu', mobileMenu: 'Mobilní menu', footerMenu: 'Menu v zápatí', contact: 'Kontakt',
    all: 'Vše', categories: 'Kategorie', allAlbums: 'Všechna alba',
    albums: (n) => `${n} ${plural(n, 'album', 'alba', 'alb')}`,
    photos: (n) => `${n} ${plural(n, 'fotografie', 'fotografie', 'fotografií')}`,
    swipe: 'Posuňte fotografie do strany',
    phone: 'Telefon', email: 'E-mail', studio: 'Ateliér', freeDates: 'Volné termíny',
    instagramNote: 'další fotky dávám na Instagram',
    albumsNote: (n) => `celkem ${n}`,
    noAlbums: 'Zatím tu nejsou žádná alba.', backToGallery: 'Zpět do galerie',
    sending: 'Odesílám…',
    draftPreview: 'Náhled nezveřejněné stránky',
    ownColorShown: (given, shown) => `Vaše barva ${given} je na tomto vzhledu zobrazena jako ${shown}, aby texty zůstaly čitelné.`,
    welcomeTitle: 'Založte úvodní stránku',
    welcomeBefore: 'Otevřete ', welcomeAdmin: 'administraci', welcomeAfter: ' a založte stránku s adresou „home“. Její obsah sestavíte z bloků.',
    notFoundTitle: 'Stránku jsme nenašli', notFoundText: 'Zkontrolujte adresu nebo se vraťte na úvodní stránku.',
    errorTitle: 'Stránku se nepodařilo načíst', errorText: 'Zkuste to prosím za chvíli znovu.',
    goHome: 'Na úvodní stránku', defaultName: 'Web',
  },
}

export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** The addresses that lead to an entry instead of a page from blocks: a category of the gallery, an album. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'category', prefix: 'galerie', entity: 'category', part: 'Albums', titleField: 'name', descriptionField: 'description' },
  { kind: 'album', prefix: 'album', entity: 'album', part: 'Album', descriptionField: 'summary', imageField: 'cover' },
]

/**
 * The looks that lay their headline over the opening's photograph: they take the block's
 * photograph for dark looks when it has one.
 */
const DARK_OPENINGS: readonly string[] = ['negativ']

/** The photograph a look opens with: the first one, or the one meant for dark looks. */
export function openingPhoto(block: BlockOf<'hero'>, look: string) {
  return (DARK_OPENINGS.includes(look) ? block.darkImage : null) ?? block.images[0]?.image ?? null
}

/** One picture of the gallery: a photograph of an album, with what a look writes under it. */
export interface GalleryTile {
  key: string
  media: Album['photos'][number]
  /** The picture's own caption, when it has one */
  caption: string | null
  album: Pick<Album, 'id' | 'title' | 'slug' | 'place' | 'date'>
  category: Album['category']
  /** Its shape, snapped to the three the looks lay out: wide 3:2, tall 4:5, square */
  shape: 'wide' | 'tall' | 'square'
  /** The shape as a width-to-height ratio: 1.5, 0.8 or 1 */
  ratio: number
  /** Its number within its category, from 1: the frame number of the contact sheet */
  frame: number
}

export function shapeOf(media: { width: number | null; height: number | null } | null | undefined): { shape: GalleryTile['shape']; ratio: number } {
  const r = media?.width && media?.height ? media.width / media.height : 1
  return r > 1.15 ? { shape: 'wide', ratio: 1.5 } : r < 0.9 ? { shape: 'tall', ratio: 0.8 } : { shape: 'square', ratio: 1 }
}

/**
 * The photographs of all albums as one mixed row: albums take turns, an album with more
 * pictures comes up more often, and its pictures are spread over the whole row instead of
 * sitting side by side (a smooth weighted round-robin). The order is the same every time.
 * `skip` leaves pictures out (the one in the page's opening); `limit` cuts the row.
 */
export function mixAlbumPhotos(albums: Album[], opts: { limit?: number; skip?: Set<string> } = {}): GalleryTile[] {
  const queues = albums.map((album) => ({
    album,
    photos: (album.photos ?? []).filter((p) => p?.id && !opts.skip?.has(p.id)),
    at: 0,
    credit: 0,
  })).filter((q) => q.photos.length > 0)
  const total = queues.reduce((n, q) => n + q.photos.length, 0)
  const frames = new Map<string, number>()
  const tiles: GalleryTile[] = []
  while (tiles.length < Math.min(total, opts.limit ?? total)) {
    let best: typeof queues[number] | null = null
    for (const q of queues) {
      if (q.at >= q.photos.length) continue
      q.credit += q.photos.length
      if (!best || q.credit > best.credit) best = q
    }
    if (!best) break
    best.credit -= total
    const media = best.photos[best.at++]!
    const category = best.album.category
    const frame = (frames.get(category.id) ?? 0) + 1
    frames.set(category.id, frame)
    tiles.push({
      key: `${best.album.id}:${media.id}`,
      media,
      caption: media.caption?.trim() || null,
      album: { id: best.album.id, title: best.album.title, slug: best.album.slug, place: best.album.place, date: best.album.date },
      category,
      ...shapeOf(media),
      frame,
    })
  }
  return tiles
}

/** The categories that have pictures among the tiles, in the editors' order, each with its count. */
export function tileCategories(tiles: GalleryTile[]): Array<{ id: string; name: string; slug: string; count: number }> {
  const seen = new Map<string, { id: string; name: string; slug: string; count: number; position: number }>()
  for (const t of tiles) {
    const c = seen.get(t.category.id)
    if (c) c.count++
    else seen.set(t.category.id, { id: t.category.id, name: t.category.name, slug: t.category.slug, count: 1, position: t.category.position ?? 0 })
  }
  return [...seen.values()].sort((a, b) => a.position - b.position).map(({ position: _p, ...c }) => c)
}

/** "SV–01": the first two letters of the category and the frame number. */
export const frameCode = (t: GalleryTile): string => `${t.category.name.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}–${String(t.frame).padStart(2, '0')}`

/** An album's address on the website. */
export const albumHref = (album: { slug: string }): string => `/album/${album.slug}`
/** A category's address on the website. */
export const categoryHref = (category: { slug: string }): string => `/galerie/${category.slug}`
/** Where all albums are: the page with the "All albums" block, and the categories under it. */
export const GALLERY_PATH = '/galerie'
