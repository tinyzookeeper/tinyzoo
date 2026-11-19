// The documentation on the website: its addresses in each language and the shape of the
// pages the build renders from docs/ (modules/docs). Shared by the build, the server
// routes (server/api/site-docs) and the pages (app/pages/dokumentace).
//
//   /dokumentace                          /en/docs                       /de/dokumentation
//   /dokumentace/pro-editory              /en/docs/editors               /de/dokumentation/redaktion
//   /dokumentace/pro-editory/preklady     /en/docs/editors/translations  /de/dokumentation/redaktion/uebersetzungen
//                                         /en/docs/developers/roles
//
// The developer pages are in English and only on the English website (decided for 1.0). The Czech
// and German contents list them at their English address, and their old addresses redirect there.

export const DOCS_LANGS = ['cs', 'en', 'de'] as const
export type DocsLang = (typeof DOCS_LANGS)[number]
export type DocsSection = 'editors' | 'developers'
export const DOCS_SECTIONS: DocsSection[] = ['editors', 'developers']

/** The docs' first address segment in each language. */
export const DOCS_SEGMENT: Record<DocsLang, string> = { cs: 'dokumentace', en: 'docs', de: 'dokumentation' }
/** Each part's segment in each language. */
export const DOCS_SECTION_SEGMENT: Record<DocsSection, Record<DocsLang, string>> = {
  editors: { cs: 'pro-editory', en: 'editors', de: 'redaktion' },
  developers: { cs: 'pro-vyvojare', en: 'developers', de: 'entwicklung' },
}

/** An address in the docs: (lang) → the landing page, (lang, section) → its index, (lang, section, slug) → a page. */
export function docsPath(lang: DocsLang, section?: DocsSection, slug?: string): string {
  const base = `${lang === 'cs' ? '' : `/${lang}`}/${DOCS_SEGMENT[lang]}`
  if (!section) return base
  const s = `${base}/${DOCS_SECTION_SEGMENT[section][lang]}`
  return slug ? `${s}/${slug}` : s
}

/** The section of a section segment in a language ('pro-editory' → 'editors'). */
export function sectionOfSegment(lang: DocsLang, segment: string | undefined): DocsSection | null {
  return DOCS_SECTIONS.find((s) => DOCS_SECTION_SEGMENT[s][lang] === segment) ?? null
}

/** A piece of a page: rendered HTML, or a looping clip (drawn by ClipVideo). */
export type DocsSegment = { html: string } | { clip: { src: string; label: string } }

export interface DocsHeading { id: string; text: string; level: 2 | 3 }

export interface DocsLinkTo { title: string; path: string }

/** One page of the docs, as the build renders it for one website language. */
export interface DocsPage {
  section: DocsSection
  /** '' for the part's own first page (its README). */
  slug: string
  path: string
  /** The language the text is written in (the developer pages: English). */
  textLang: DocsLang
  title: string
  /** The page's first paragraph, as plain text (meta description, cards). */
  description: string
  toc: DocsHeading[]
  body: DocsSegment[]
  /** The same page in each website language that has it (a developer page: English only). */
  alternates: Partial<Record<DocsLang, string>>
  prev: DocsLinkTo | null
  next: DocsLinkTo | null
  /** Where the Markdown lives in the repository (docs/…). */
  source: string
}

export interface DocsNavPage { slug: string; title: string; description: string; path: string }
export interface DocsNavGroup { id: string; title: string; pages: DocsNavPage[] }
export interface DocsNavSection { section: DocsSection; title: string; path: string; textLang: DocsLang; groups: DocsNavGroup[] }
/** The table of contents of both parts, for one website language. */
export interface DocsNav { lang: DocsLang; sections: Record<DocsSection, DocsNavSection> }

/** One heading's worth of text, for the search. */
export interface DocsSearchSection {
  /** The page's address and the heading's anchor ('' for the text before the first heading). */
  path: string
  anchor: string
  page: string
  heading: string
  section: DocsSection
  text: string
}

/** What the page route answers. */
export interface DocsPageResponse { page: DocsPage; nav: DocsNav }

/** A docs search hit, in the shape of the website search's own results. */
export interface DocsSearchHit {
  entity: 'docs'
  id: string
  title: string
  titleHighlights: [number, number][]
  excerpt: string
  highlights: [number, number][]
  path: string
  /** The page the heading is on (empty when the hit is the page itself). */
  page: string
  section: DocsSection
}
