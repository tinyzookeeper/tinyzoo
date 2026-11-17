import type { CmsBlock } from './blocks'

/**
 * The frontend kit: the props of the components every website draws its content with
 * (`<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`, `<CmsHighlight>`, and `<CmsForm>` from
 * `tinyzoo/forms`). The components declare their props with these types, so the interfaces below
 * *are* the components' API: it is frozen from 1.0 (docs/api-surface.md), and a change to one shows
 * in `api-tinyzoo.txt` and in `frontend-kit.txt`.
 *
 * Types only: this file has no code.
 */

/** A picture as the content API returns it (`hero`, `ogImage`, a gallery item…): what `<CmsImage>` reads. */
export interface CmsImageMedia {
  id?: string
  url: string
  alt?: string | null
  width?: number | null
  height?: number | null
  mime?: string | null
  /** The focal point the editor set, in percent from the top left. */
  focal?: { x: number; y: number } | null
}

/** Props of `<CmsImage>`: a picture with its alt text, real size, lazy loading, `srcset` and focal point. */
export interface CmsImageProps {
  media: CmsImageMedia | null | undefined
  /** Load now (the first picture on the page); otherwise lazily. */
  eager?: boolean
  /** How wide the picture shows (CSS sizes), so the browser picks the right copy. Default: the full screen width. */
  sizes?: string
  /** Override the stored description (e.g. '' for a purely decorative picture). */
  alt?: string
}

/**
 * Props of `<CmsBlocks>`: a `f.blocks()` value, each block drawn by the site's own global component
 * named `<prefix><Type>` (`hero` → `<BlockHero>`).
 */
export interface CmsBlocksProps {
  blocks: CmsBlock[] | null | undefined
  /** The start of the component names. Default `'Block'`. */
  prefix?: string
}

/**
 * What a site's own block component (`BlockHero.vue`) receives from `<CmsBlocks>`: the block and its
 * position in the list.
 */
export interface CmsBlockProps<B extends CmsBlock = CmsBlock> {
  block: B
  index: number
}

/** One node of a rich-text document, as `<CmsContent>` reads it (the TipTap / ProseMirror JSON the content API returns). */
export interface CmsContentNode {
  type: string
  content?: CmsContentNode[]
  text?: string
  marks?: any[]
  attrs?: any
}

/** Props of `<CmsContent>`: a rich-text value drawn as sanitised HTML, in a `div.cms-content`. */
export interface CmsContentProps {
  doc: CmsContentNode | null
}

/** One link of a menu, as `defineNavigation` stores it (`sub` puts it under the link above). */
export interface CmsNavLink {
  id: string
  label: string
  url: string | null
  newTab?: boolean | null
  sub?: boolean | null
}

/** Props of `<CmsNav>`: a menu's links, drawn as a `nav.cms-nav` with nested lists. */
export interface CmsNavProps {
  links: CmsNavLink[] | null | undefined
}

/** Props of `<CmsHighlight>`: text with `<mark>` around each `[start, end)` range (as the search API returns them). */
export interface CmsHighlightProps {
  text: string
  ranges?: [number, number][] | null
}

/** Props of `<CmsForm>` (needs `formsPlugin()` from `tinyzoo/forms`): a website form by name. */
export interface CmsFormProps {
  /** The form's name, as given to `defineForm`. */
  name: string
  /** The language of the form's labels and messages. Default: the default language. */
  locale?: string
}

/** One result of the website search (`useCmsSearch`, `GET /api/content/_search`). */
export interface CmsSearchItem {
  entity: string
  id: string
  title: string
  /** Where the words are in the title, as [start, end) character ranges. */
  titleHighlights: [number, number][]
  /** A sentence or two of the entry's text around the first word found ('' when only the title matched). */
  excerpt: string
  highlights: [number, number][]
  /** The entry's address on the website, in the searched language. */
  path: string | null
  locale: string | null
  updatedAt: string
}

/** The answer of the website search. */
export interface CmsSearchResult { query: string; items: CmsSearchItem[]; total: number }
