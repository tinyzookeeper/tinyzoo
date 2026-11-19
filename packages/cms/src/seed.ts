import type { Insert } from './entity'

/**
 * Seeding: content a site starts with (demo pages, the first menus, its settings),
 * written in code and put into the site with `tinyzoo seed`.
 *
 *   // seed/index.ts
 *   import { defineSeed } from 'tinyzoo'
 *   import { News, Page, SiteSettings } from '../cms.config'
 *
 *   export default defineSeed(async (s) => {
 *     const cover = await s.upload('seed/media/cover.jpg', { alt: 'A desk with a laptop' })
 *     const home = await s.upsert(Page, { title: 'Home', slug: 'home', status: 'published', sections: [] },
 *       { translations: { en: { title: 'Home' } } })
 *     await s.create(News, { title: 'Hello', slug: 'hello', body: s.rich.doc(s.rich.p('First post.')), cover })
 *     await s.global(SiteSettings, { siteName: 'My site' })
 *   })
 *
 * The seed is not written to the database directly: the command signs in to the running
 * site and goes through the same API the admin uses, so every rule an editor meets
 * (validation, translations, media handling, the search index, saved versions,
 * webhooks) applies to the seed too.
 *
 * Running it twice changes nothing: an entry is recognised by a key field (`by`, the
 * address field by default), and a value that already matches is not written again.
 */

/** A rich-text node as the editor stores it. */
export interface SeedRichNode {
  type: string
  text?: string
  content?: SeedRichNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  attrs?: Record<string, unknown>
}

/** What a seed gets back for an entry or a global it wrote: pass `.id` wherever a relation or `s.link` wants one. */
export interface SeedEntry {
  readonly kind: 'entry' | 'global'
  /** The entity's name (`page`, `siteSettings`). */
  readonly entity: string
  readonly id: string
  /** The key the entry is recognised by (`{ slug: 'home' }`); empty for a global. */
  readonly key: Record<string, string>
  /** True when the entry was already there and `s.create` left it as it was. */
  readonly existed: boolean
  /** The values the seed gave (and what was already stored for the rest). */
  readonly data: Record<string, any>
  /** What the seed gave per language (`s.translate`, `translations`). */
  readonly translations: Record<string, Record<string, any>>
}

type EntityLike = { __cms: 'entity'; name: string }

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never
type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true
/** One block or list item as a seed may write it: no `id` (the runner makes a stable one), and no `type` when there is only one. */
type SeedBlock<M, TypeOptional> = M extends unknown
  ? { [K in keyof M as K extends 'id' ? never : K extends 'type' ? (TypeOptional extends true ? never : K) : K]: SeedValue<M[K]> }
    & { id?: string } & (TypeOptional extends true ? { type?: M extends { type: infer Ty } ? Ty : never } : unknown)
  : never
/** A stored value as a seed may write it. */
type SeedValue<T> =
  T extends Date ? T
  : T extends readonly (infer U)[]
    ? ([U] extends [{ id: string; type: string }] ? SeedBlock<U, IsUnion<U extends { type: infer Ty } ? Ty : never> extends true ? false : true>[] : SeedValue<U>[])
  : T extends object ? { [K in keyof T]: SeedValue<T[K]> }
  : T

/** The values of an entry. Media fields take the id `s.upload` returned, relations the id of the other entry. */
export type SeedInsert<E> = E extends EntityLike ? { [K in keyof Insert<E>]: SeedValue<Insert<E>[K]> } : Record<string, any>

export interface SeedWriteOptions<D = Record<string, any>> {
  /**
   * The field (or fields) that tell an entry apart from the others, so a second run finds
   * the entry it made. Default: the entity's address field (`content.slug`, e.g. `slug`).
   * An entity without one needs it said here.
   */
  by?: (keyof D & string) | (keyof D & string)[]
  /**
   * The same entry in other languages: the translated fields only (`{ en: { title: 'Home' } }`).
   * With `publish.perLocale` also the language's own state: the entry's status and publish
   * date (`{ en: { title: 'Home', status: 'published' } }`). Without one the language follows
   * the default language (it is on the website while the entry is).
   */
  translations?: Record<string, Partial<D>>
}

export interface SeedGlobalOptions<D = Record<string, any>> {
  /** The same settings in other languages: the translated fields only. */
  translations?: Record<string, Partial<D>>
  /** Leave the global alone when somebody saved it already (default: make it match the seed). */
  ifMissing?: boolean
}

export interface SeedUploadOptions {
  /** The description screen readers read. Left out: untouched. */
  alt?: string
  /** The description in other languages (`{ en: '…' }`). */
  altLocales?: Record<string, string>
  /** The point to keep in view when the picture is cropped, in percent. */
  focal?: { x: number; y: number }
  /** A library folder: one level, so no "/" or "\\" in the name (the seed stops on one). Default: none. */
  folder?: string
  /** The file name shown in the library. Default: the file's name. Together with the folder and the size, it is how a second run finds the file again. */
  name?: string
  /** Keep the file in the library even when nothing uses it (default: true). */
  library?: boolean
  /** The file type, when the extension does not say. */
  mime?: string
}

export interface SeedLinkOptions {
  /** Open in a new tab. */
  newTab?: boolean
  /** Show in the dropdown of the link above it (menus). */
  sub?: boolean
  /** For a link to an entry: the language whose address is wanted (default: the default language). */
  locale?: string
}

/** A menu link: `{ id, type: 'link', label, url, newTab, sub }`. */
export interface SeedLink {
  id: string
  type: 'link'
  label: string
  url: string
  newTab: boolean
  sub: boolean
}

/** Builders for the rich-text documents of `f.richtext()` fields. */
export interface SeedRich {
  doc(...content: SeedRichNode[]): { type: 'doc'; content: SeedRichNode[] }
  /** A paragraph from plain text and/or ready-made inline nodes (`s.rich.bold('x')`). */
  p(...parts: (string | SeedRichNode)[]): SeedRichNode
  h(level: 1 | 2 | 3 | 4 | 5 | 6, text: string): SeedRichNode
  h2(text: string): SeedRichNode
  h3(text: string): SeedRichNode
  ul(...items: (string | SeedRichNode[])[]): SeedRichNode
  ol(...items: (string | SeedRichNode[])[]): SeedRichNode
  quote(text: string, by?: string): SeedRichNode
  bold(text: string): SeedRichNode
  italic(text: string): SeedRichNode
  link(text: string, href: string): SeedRichNode
  /** A picture from the library: pass what `s.upload` returned. */
  image(media: string, alt?: string): SeedRichNode
}

export interface SeedContext {
  /**
   * Make sure an entry exists: made when nothing has this key yet, otherwise left exactly as
   * it is (editors' changes stay). Returns the entry either way.
   */
  create<E extends EntityLike>(entity: E, data: SeedInsert<E>, options?: SeedWriteOptions<SeedInsert<E>>): Promise<SeedEntry>
  create(entity: string, data: Record<string, any>, options?: SeedWriteOptions): Promise<SeedEntry>
  /**
   * Make sure an entry exists and carries these values: made when missing, otherwise brought
   * up to the seed. Fields the seed leaves out are not touched.
   */
  upsert<E extends EntityLike>(entity: E, data: SeedInsert<E>, options?: SeedWriteOptions<SeedInsert<E>>): Promise<SeedEntry>
  upsert(entity: string, data: Record<string, any>, options?: SeedWriteOptions): Promise<SeedEntry>
  /**
   * An entry in another language: only the `.localized()` fields. Follows how the entry was
   * written: after `s.create` an existing translation is left alone, after `s.upsert` it is
   * made to match.
   */
  translate(entry: SeedEntry, locale: string, data: Record<string, any>): Promise<void>
  /** A global (site settings, menus): saved whole. */
  global<E extends EntityLike>(entity: E, data: SeedInsert<E>, options?: SeedGlobalOptions<SeedInsert<E>>): Promise<SeedEntry>
  global(entity: string, data: Record<string, any>, options?: SeedGlobalOptions): Promise<SeedEntry>
  /**
   * A file from disk (relative to the site's folder) into the media library; returns its id.
   * A second run finds the file by name, folder and size and uploads nothing.
   */
  upload(file: string, options?: SeedUploadOptions): Promise<string>
  /** A menu link. `to` is an address or an entry the seed made (its address on the website is worked out). */
  link(label: string, to: string | SeedEntry, options?: SeedLinkOptions): SeedLink
  /** Rich-text builders. */
  rich: SeedRich
  /** The languages of the site: the default first. Empty without `defineLocales`. */
  locales: string[]
}

export interface SeedDefinition {
  readonly __cms: 'seed'
  run(s: SeedContext): Promise<void>
}

/** The seed of a site: `export default defineSeed(async (s) => { … })` in `seed/index.ts`. */
export function defineSeed(run: (s: SeedContext) => Promise<void> | void): SeedDefinition {
  if (typeof run !== 'function') throw new Error('defineSeed() takes a function: defineSeed(async (s) => { … })')
  return { __cms: 'seed', run: async (s) => { await run(s) } }
}

/** @internal */
export function isSeed(value: unknown): value is SeedDefinition {
  return !!value && typeof value === 'object' && (value as any).__cms === 'seed' && typeof (value as any).run === 'function'
}

// ── rich text builders ──────────────────────────────────────────────────────────

const text = (t: string, marks?: SeedRichNode['marks']): SeedRichNode => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t })
const inline = (parts: (string | SeedRichNode)[]): SeedRichNode[] => parts.map((x) => (typeof x === 'string' ? text(x) : x))
const paragraph = (...parts: (string | SeedRichNode)[]): SeedRichNode => ({ type: 'paragraph', content: inline(parts) })
const item = (x: string | SeedRichNode[]): SeedRichNode => ({
  type: 'listItem',
  content: [typeof x === 'string' ? paragraph(x) : { type: 'paragraph', content: x }],
})

/** The rich-text builders (also on `s.rich`); `image` needs the media's address, so the runner supplies it. */
export function richBuilders(mediaUrl: (id: string) => string): SeedRich {
  const heading = (level: 1 | 2 | 3 | 4 | 5 | 6, t: string): SeedRichNode => ({ type: 'heading', attrs: { level }, content: [text(t)] })
  return {
    doc: (...content) => ({ type: 'doc', content }),
    p: paragraph,
    h: heading,
    h2: (t) => heading(2, t),
    h3: (t) => heading(3, t),
    ul: (...items) => ({ type: 'bulletList', content: items.map(item) }),
    ol: (...items) => ({ type: 'orderedList', content: items.map(item) }),
    quote: (t, by) => ({
      type: 'blockquote',
      content: [paragraph(t), ...(by ? [{ type: 'paragraph', content: [text(`— ${by}`, [{ type: 'italic' }])] }] : [])],
    }),
    bold: (t) => text(t, [{ type: 'bold' }]),
    italic: (t) => text(t, [{ type: 'italic' }]),
    link: (t, href) => text(t, [{ type: 'link', attrs: { href } }]),
    image: (media, alt) => ({ type: 'image', attrs: { src: mediaUrl(media), mediaId: media, alt: alt ?? '' } }),
  }
}
