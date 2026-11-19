import type { ComputedRef } from 'vue'
import type { CmsBlock } from './blocks'

/**
 * The frontend kit: the props of the components every website draws its content with
 * (`<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`, `<CmsHighlight>`, `<CmsForm>` from
 * `tinyzoo/forms`, and `<CmsConsent>` with `useConsent()` from `tinyzoo/consent`). The components declare their props with these types, so the interfaces below
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

/** Props of `<CmsConsent>` (needs `consentPlugin()` from `tinyzoo/consent`): the cookie banner and its settings dialog. */
export interface CmsConsentProps {
  /** The language of the texts. Default: the page's (`<html lang>`). */
  locale?: string
  /** Leave out the default styles: the markup and its `cms-consent*` classes stay, for the site's own CSS. */
  unstyled?: boolean
}

/** A visitor's cookie choice: yes or no per category they were asked about. `necessary` is always on and not in it. */
export type CmsConsentChoice = Record<string, boolean>

/** A read-only reactive value (a Vue `ComputedRef`): `.value` in a script, unwrapped in a template. */
export type CmsReadonlyRef<T> = ComputedRef<T>

/** The cookie banner's texts in the visitor's language: what editors wrote in the admin, else the standard text. */
export interface CmsConsentTexts {
  title: string
  body: string
  acceptAll: string
  rejectAll: string
  /** The banner's button that opens the settings. */
  settings: string
  /** The settings' button that saves the switches. */
  save: string
  settingsTitle: string
  privacyLabel: string
  /** The privacy policy's address ('' = no link). */
  privacyUrl: string
  /** Next to the switch that cannot be switched off (necessary). */
  alwaysOn: string
  /** The settings' close button (its accessible name). */
  close: string
  /** The heading of a category's list of services and cookies. */
  services: string
  provider: string
  cookies: string
  duration: string
}

/** A service (a tool, an embed, the site itself) and the cookies it sets, in the visitor's language. Empty texts are ''. */
export interface CmsConsentService {
  name: string
  provider: string
  purpose: string
  /** The names of its cookies (`_ga`, `_ga_*`); empty when it sets none. */
  cookies: string[]
  /** How long they are kept, as text (`2 years`). */
  duration: string
  /** The service's own privacy policy ('' = none). */
  privacyUrl: string
}

/** A category of the banner, in the visitor's language. */
export interface CmsConsentCategory {
  key: string
  label: string
  description: string
  /** Always on (necessary): shown, not switchable. */
  required: boolean
  /** Allowed in the visitor's choice now (`required` ones always). */
  granted: boolean
  services: CmsConsentService[]
}

/**
 * What `useConsent()` returns (needs `consentPlugin()` from `tinyzoo/consent`): the visitor's
 * choice for the site's code, and everything a banner and a settings dialog of the site's own need.
 */
export interface CmsConsentApi {
  /** The visitor's choice, or null while they have not chosen (or are asked again). */
  choice: CmsReadonlyRef<CmsConsentChoice | null>
  /** The visitor has a choice that holds. */
  decided: CmsReadonlyRef<boolean>
  /** The browser has read the choice. False while the page is rendered on the server. */
  ready: CmsReadonlyRef<boolean>
  /** Whether a category is allowed: `necessary` always, the others once the visitor said yes. Reactive in a template or `computed`. */
  granted: (category: string) => boolean
  /** Runs `cb` once the choice is known after the page loads, and whenever it changes. Returns a function that stops it (it also stops with the component). */
  onChange: (cb: (choice: CmsConsentChoice | null) => void) => () => void
  /** The banner should show now: the choice is read, the texts are in, and the visitor has no choice that holds (never asked, too old, new texts or a new category). */
  bannerVisible: CmsReadonlyRef<boolean>
  /** The settings are open. */
  settingsOpen: CmsReadonlyRef<boolean>
  /** Opens the settings (a "Cookie settings" link); their switches start from the visitor's choice. */
  open: () => void
  /** Closes the settings without saving. */
  close: () => void
  /** The banner's texts in the page's language (empty strings until they are loaded). */
  texts: CmsReadonlyRef<CmsConsentTexts>
  /** The categories, `necessary` first, each with its services and cookies. */
  categories: CmsReadonlyRef<CmsConsentCategory[]>
  /** The settings' switches, per category key (`necessary` always true). Writable: `v-model="draft[c.key]"`. */
  draft: Record<string, boolean>
  /** Sets one switch of the settings. `necessary` stays on. */
  set: (category: string, value: boolean) => void
  /** Allows every category, saves, and closes the settings. */
  acceptAll: () => Promise<void>
  /** Allows only `necessary`, saves, and closes the settings. */
  rejectAll: () => Promise<void>
  /** Saves a choice (`{ analytics: true }`; a category left out is a no), or the settings' switches without one, and closes the settings. */
  save: (choice?: CmsConsentChoice) => Promise<void>
  /** A choice is on its way to the server. */
  saving: CmsReadonlyRef<boolean>
  /** Why the last choice could not be recorded on the server, or null. The choice holds in this browser all the same. */
  error: CmsReadonlyRef<string | null>
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
