// The website's own words (what is not content: "Menu", "All", the errors) and the small
// helpers every look uses. The content is in the CMS; Nuxt auto-imports what is exported here.
import type { Album, Page } from '~/lib/cms-content'

export const DEFAULT_LANGUAGE = 'cs'

export interface Words {
  menu: string
  close: string
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
    menu: 'Menu', close: 'Zavřít', mainMenu: 'Hlavní', mobileMenu: 'Mobilní', footerMenu: 'Patička', contact: 'Kontakt',
    all: 'Vše', categories: 'Kategorie', allAlbums: 'Všechna alba',
    albums: (n) => `${n} ${plural(n, 'album', 'alba', 'alb')}`,
    photos: (n) => `${n} ${plural(n, 'fotografie', 'fotografie', 'fotografií')}`,
    swipe: 'Táhněte do strany',
    phone: 'Telefon', email: 'E-mail', studio: 'Ateliér', freeDates: 'Volné termíny',
    instagramNote: 'čerstvé fotky dávám na Instagram',
    albumsNote: (n) => `je jich tam ${n}`,
    noAlbums: 'Zatím tu nejsou žádná alba.', backToGallery: 'Zpět do galerie',
    sending: 'Odesílám…',
    draftPreview: 'Náhled konceptu · zatím není na webu',
    welcomeTitle: 'Web je připravený.',
    welcomeBefore: 'V ', welcomeAdmin: 'administraci', welcomeAfter: ' založte stránku s adresou home a poskládejte ji z bloků. Objeví se tady.',
    notFoundTitle: 'Stránka nenalezena', notFoundText: 'Možná se přesunula, nebo je v adrese překlep.',
    errorTitle: 'Něco se pokazilo', errorText: 'Zkuste to prosím za chvíli znovu.',
    goHome: 'Na úvodní stránku', defaultName: 'Web',
  },
}

export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** An address from the content API as the website writes it: the home page (address `home`) is `/`. */
export function siteHref(path: string | null | undefined): string {
  if (!path) return '/'
  return path.replace(/^\/home\/?$/, '') || '/'
}

/** Whether a link leaves the website (opens in a new tab). */
export const isExternal = (url: string | null | undefined): boolean => /^https?:\/\//i.test(url ?? '')

/** 19900 → "19 900" with a non-breaking space, the Czech way. */
export const formatPrice = (n: number | string | null | undefined): string => new Intl.NumberFormat('cs-CZ').format(Number(n ?? 0)).replace(/\s/g, ' ')

/** "+420 731 482 906" → "tel:+420731482906" */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`

/** "https://www.instagram.com/johana.loudova/" → "@johana.loudova" */
export function socialHandle(url: string | null | undefined): string {
  const last = (url ?? '').replace(/[?#].*$/, '').split('/').filter(Boolean).pop() ?? ''
  return last && !last.includes('.com') ? `@${last.replace(/^@/, '')}` : 'Instagram'
}

/** A text's paragraphs: an empty line starts a new one. */
export const paragraphs = (text: string | null | undefined): string[] => (text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

/** A date as Czech writes it: "22. srpna 2026" (`short`: "8/2026"). */
export function formatDate(iso: string | null | undefined, style: 'long' | 'short' = 'long'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // (all-day dates are stored at 0:00 in the admin's time zone, Europe/Prague)
  const parts = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: style === 'long' ? 'long' : 'numeric', year: 'numeric' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return style === 'long' ? `${get('day')}. ${get('month')} ${get('year')}` : `${get('month')}/${get('year')}`
}

// ── photographs of the gallery ──

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

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

/**
 * A class by the length of a text, for type so large that a long heading needs a smaller size:
 * `byLength(heading, [[12, 'text-[12vw]'], [30, 'text-[8vw]']], 'text-[6vw]')` gives the first
 * class whose limit the text fits, else the last one.
 */
export function byLength(text: string | null | undefined, steps: Array<[max: number, cls: string]>, otherwise: string): string {
  // (without the asterisks of a marked part)
  const n = (text ?? '').replace(/\*/g, '').trim().length
  return steps.find(([max]) => n <= max)?.[1] ?? otherwise
}
