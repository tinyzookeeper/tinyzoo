import { eq } from 'drizzle-orm'
import { type BlockDef, defineBlock } from './blocks'
import { defineEntity, defineSingleton } from './entity'
import { f } from './fields'
import type { LocalizedText } from './i18n'
import type { PathTemplate } from './paths'
import { cmsDeprecated } from './deprecate'
import { defineForm as formsDefineForm, defineFormSettings as formsDefineFormSettings, IMPLICIT_FORMS_REQUIREMENT } from '../forms'
import { TREE_DEFAULT_MAX_DEPTH } from './tree'

const SEO_GROUP = { en: 'Search & sharing', cs: 'Vyhledávače a sdílení', de: 'Suche & Teilen' }

/**
 * Reusable SEO/metadata fields. Spread into an entity (or singleton):
 *   fields: { ...seo(), title: f.text({ required: true }), … }
 * Produces metaTitle / metaDescription / ogImage columns — plain queryable fields,
 * delivered like any other through the content API. `seo({ localized: true })` makes
 * the title and description translatable (the sharing image stays shared);
 * `definePages({ localized: true })` does this for its pages.
 */
export function seo(opts: { localized?: boolean } = {}) {
  // Translatable search texts: each language gets its own title and description.
  const text = () => (opts.localized ? f.text().optional().localized() : f.text().optional())
  return {
    metaTitle: text().position('sidebar').group(SEO_GROUP)
      .label({ en: 'Search title', cs: 'Titulek pro vyhledávače', de: 'Titel für Suchmaschinen' })
      .help({ en: 'Shown in Google results and browser tabs instead of the title. Around 60 characters.', cs: 'Zobrazí se ve výsledcích Googlu a v záložce prohlížeče místo názvu. Zhruba 60 znaků.', de: 'Erscheint statt des Titels in Google-Ergebnissen und Browser-Tabs. Etwa 60 Zeichen.' }),
    metaDescription: text().position('sidebar').group(SEO_GROUP)
      .label({ en: 'Search description', cs: 'Popis pro vyhledávače', de: 'Beschreibung für Suchmaschinen' })
      .help({ en: 'The short text under the title in Google results and when shared. Around 155 characters.', cs: 'Krátký text pod titulkem ve výsledcích Googlu a při sdílení. Zhruba 155 znaků.', de: 'Kurzer Text unter dem Titel in Google-Ergebnissen und beim Teilen. Etwa 155 Zeichen.' }),
    ogImage: f.media({ accept: 'image/*' }).optional().position('sidebar').group(SEO_GROUP)
      .label({ en: 'Sharing image', cs: 'Obrázek pro sdílení', de: 'Bild zum Teilen' })
      .help({ en: 'Shown when the page is shared on social networks and in messages.', cs: 'Zobrazí se při sdílení stránky na sociálních sítích a ve zprávách.', de: 'Erscheint beim Teilen der Seite in sozialen Netzwerken und Nachrichten.' }),
  }
}

/** A link in a menu: label, address, open in a new tab. */
export function linkBlock() {
  return defineBlock({
    label: { en: 'Link', cs: 'Odkaz', de: 'Link' },
    description: { en: 'A page on this site or another website.', cs: 'Stránka tohoto webu nebo jiný web.', de: 'Eine Seite dieser oder einer anderen Website.' },
    icon: 'i-lucide-link',
    fields: {
      label: f.text({ required: true }).label({ en: 'Label', cs: 'Text odkazu', de: 'Linktext' }),
      url: f.text({ required: true, format: 'link' }).label({ en: 'Address', cs: 'Adresa', de: 'Adresse' })
        .help({ en: 'A page on this site (/contact) or a full address (https://…).', cs: 'Stránka tohoto webu (/kontakt) nebo celá adresa (https://…).', de: 'Eine Seite dieser Website (/kontakt) oder eine vollständige Adresse (https://…).' }),
      newTab: f.boolean().label({ en: 'Open in a new tab', cs: 'Otevřít v nové záložce', de: 'In neuem Tab öffnen' }),
      sub: f.boolean({ needsPrevious: true }).label({ en: 'Under the link above', cs: 'Pod odkazem nad ním', de: 'Unter dem vorherigen Link' })
        .help({ en: 'Shows in the dropdown of the link above it.', cs: 'Zobrazí se v rozbalovacím menu odkazu nad ním.', de: 'Erscheint im Untermenü des vorherigen Links.' }),
    },
  })
}

/**
 * A ready-made pages collection: title, URL address, status and a page built from
 * your blocks, plus search & sharing fields, publishing and draft preview.
 *
 *   export const Page = definePages({ blocks: { hero, text, gallery }, localized: true })
 *
 * `localized: true` makes the title, address and blocks translatable (needs
 * `defineLocales`). `path` is the page's address on the website (default '/:slug'),
 * or one per language: { cs: '/:slug', en: '/pages/:slug' }.
 *
 * `tree: true` lets pages sit under each other: every page gets a `parent` and a
 * `position` among its siblings, and its address is its ancestors' address parts and its
 * own ('/o-nas/tym', in each language its own translated parts). Moving a page moves
 * everything below it and leaves redirects (through `defineRedirects`); deleting a page
 * that has subpages is refused. Pages can be nested 4 levels deep, or `{ maxDepth }`
 * (up to 10). Opt-in: a site that does not set it keeps its flat pages; turning it on
 * later needs one migration (`tinyzoo generate`).
 */
export function definePages<const B extends Record<string, BlockDef<any>>, const T extends boolean | { maxDepth?: number } | undefined = undefined>(opts: {
  blocks: B
  name?: string
  label?: LocalizedText
  labelSingular?: LocalizedText
  description?: LocalizedText
  localized?: boolean
  path?: PathTemplate
  tree?: T
  /** Row-level rules on top of the roles (as `defineEntity({ access })`): who may read, create, change or delete which pages. */
  access?: Partial<Record<'read' | 'create' | 'update' | 'delete', (ctx: { user: any; table: any }) => unknown>>
}) {
  const loc = <T extends { localized: () => any }>(d: T): T => (opts.localized ? d.localized() : d)
  const path = opts.path ?? '/:slug'
  const tree = opts.tree ? { maxDepth: typeof opts.tree === 'object' ? opts.tree.maxDepth ?? TREE_DEFAULT_MAX_DEPTH : TREE_DEFAULT_MAX_DEPTH } : null
  // The page tree's own fields (a page points at its parent: itself, so a forward reference).
  const self: { entity: any } = { entity: null }
  const treeFields = (tree ? treePageFields(() => self.entity) : {}) as [T] extends [false | undefined] ? {} : ReturnType<typeof treePageFields>
  const entity = defineEntity(opts.name ?? 'page', {
    label: opts.label ?? { en: 'Pages', cs: 'Stránky', de: 'Seiten' },
    labelSingular: opts.labelSingular ?? { en: 'Page', cs: 'Stránka', de: 'Seite' },
    description: opts.description ?? { en: 'Pages of the website, built from blocks.', cs: 'Stránky webu poskládané z bloků.', de: 'Die Seiten der Website, aus Blöcken aufgebaut.' },
    icon: 'i-lucide-file',
    titleField: 'title',
    admin: { list: { columns: ['title', 'status'], ...(tree ? { orderField: 'position' as any } : {}) } },
    fields: {
      title: loc(f.text({ required: true })).label({ en: 'Title', cs: 'Název', de: 'Titel' }),
      // In a tree the address part only has to be unique under its parent: the whole address is checked instead.
      slug: loc(f.slug({ from: 'title', unique: !tree })).label({ en: 'URL address', cs: 'Adresa (URL)', de: 'Adresse (URL)' }),
      status: f.select({
        options: ['draft', 'published'] as const,
        default: 'draft',
        labels: { draft: { en: 'Draft', cs: 'Koncept', de: 'Entwurf' }, published: { en: 'Published', cs: 'Zveřejněno', de: 'Veröffentlicht' } },
      }),
      sections: loc(f.blocks(opts.blocks)).label({ en: 'Content', cs: 'Obsah', de: 'Inhalte' }),
      ...treeFields,
      ...seo({ localized: opts.localized }),
    },
    publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: path },
    ...(opts.access ? { access: opts.access as {} } : {}),
    content: {
      public: true,
      published: (t: any) => eq(t.status, 'published'),
      slug: 'slug',
      path,
    },
    ...((tree ? { tree: { parent: 'parent', order: 'position', maxDepth: tree.maxDepth } } : {}) as {}),
  })
  self.entity = entity
  return entity
}

/** `parent` and `position`, the fields `definePages({ tree: true })` adds. */
function treePageFields(entity: () => any) {
  return {
    parent: f.relation({ to: entity, kind: 'many-to-one', onDelete: 'restrict' }).position('sidebar')
      .label({ en: 'Parent page', cs: 'Nadřazená stránka', de: 'Übergeordnete Seite' })
      .help({ en: 'The page this one sits under. Its address continues the parent’s: /about/team.', cs: 'Stránka, pod kterou tato leží. Adresa pokračuje za adresou nadřazené: /o-nas/tym.', de: 'Die Seite, unter der diese liegt. Die Adresse setzt die der übergeordneten fort: /ueber-uns/team.' }),
    position: f.number().withDefault(0).label({ en: 'Position', cs: 'Pořadí', de: 'Reihenfolge' }),
  }
}

/**
 * Site menus as one settings screen: each menu is an ordered list of links.
 *
 *   export const Navigation = defineNavigation({ localized: true })
 *   // → GET /api/content/_global/navigation → { main: [{ id, type, label, url, newTab, sub }], footer: [...] }
 */
export function defineNavigation(opts: { name?: string; menus?: Record<string, LocalizedText>; localized?: boolean } = {}) {
  const menus = opts.menus ?? {
    main: { en: 'Main menu', cs: 'Hlavní menu', de: 'Hauptmenü' },
    footer: { en: 'Footer menu', cs: 'Menu v patičce', de: 'Menü im Seitenfuß' },
  }
  const fields: Record<string, any> = {}
  for (const [key, label] of Object.entries(menus)) {
    // A list of links (stored type 'link', as before); a link marked `sub` belongs in
    // the dropdown of the one above it: `cmsMenuTree()` in @tinyzoo/client nests them.
    const field = f.list({ fields: linkBlock().fields, itemType: 'link', itemLabel: { en: 'Link', cs: 'Odkaz', de: 'Link' } }).label(label)
    fields[key] = opts.localized ? field.localized() : field
  }
  return defineSingleton(opts.name ?? 'navigation', {
    label: { en: 'Navigation', cs: 'Navigace', de: 'Navigation' },
    description: { en: 'The menus of the website.', cs: 'Menu webu.', de: 'Die Menüs der Website.' },
    icon: 'i-lucide-menu',
    titleField: Object.keys(menus)[0]!,
    fields,
    content: { public: true },
  } as any)
}

/**
 * Redirects from old addresses to new ones, applied by the server to every page
 * request (301 permanent by default, 302 temporary).
 *
 *   export const Redirect = defineRedirects()
 */
export function defineRedirects(opts: { name?: string } = {}) {
  const e = defineEntity(opts.name ?? 'redirect', {
    label: { en: 'Redirects', cs: 'Přesměrování', de: 'Weiterleitungen' },
    labelSingular: { en: 'Redirect', cs: 'Přesměrování', de: 'Weiterleitung' },
    description: {
      en: 'Send visitors from an old address to a new one — keeps old links and search results working.',
      cs: 'Pošle návštěvníky ze staré adresy na novou — staré odkazy i výsledky vyhledávání dál fungují.',
      de: 'Leitet Besucher von einer alten Adresse auf eine neue weiter. Alte Links und Suchergebnisse funktionieren weiterhin.',
    },
    icon: 'i-lucide-corner-down-right',
    titleField: 'from',
    // Applied to the website the moment it is saved: authors cannot write redirects.
    live: true,
    admin: { list: { columns: ['from', 'to', 'permanent'] } },
    fields: {
      from: f.text({ required: true, format: 'path' }).unique()
        .label({ en: 'From', cs: 'Z adresy', de: 'Von' })
        .help({ en: 'The old address on this site, e.g. /old-page.', cs: 'Stará adresa na tomto webu, např. /stara-stranka.', de: 'Die alte Adresse auf dieser Website, z. B. /alte-seite.' }),
      to: f.text({ required: true, format: 'link' })
        .label({ en: 'To', cs: 'Na adresu', de: 'Nach' })
        .help({ en: 'Where to send visitors: /new-page or https://…', cs: 'Kam návštěvníky poslat: /nova-stranka nebo https://…', de: 'Zieladresse für Besucher: /neue-seite oder https://…' }),
      permanent: f.boolean({ default: true })
        .label({ en: 'Permanent', cs: 'Trvalé', de: 'Dauerhaft' })
        .help({ en: 'Tells search engines the page moved for good (301).', cs: 'Řekne vyhledávačům, že se stránka přesunula natrvalo (301).', de: 'Teilt Suchmaschinen mit, dass die Seite dauerhaft umgezogen ist (301).' }),
    },
  })
  ;(e as any).preset = 'redirects'
  return e
}

// ── forms: moved to the forms plugin (`tinyzoo/forms`); these keep old sites working ──
export { FORM_FIELD_TYPES, type FormOptions } from '../forms'

/**
 * @deprecated Import `defineForm` from `tinyzoo/forms` and register `formsPlugin()` in
 * `export const plugins = [...]`. Still works (it registers the plugin by itself), same
 * tables and endpoints. Removed in 0.4.
 */
export function defineForm<F extends Record<string, any>>(name: string, opts: import('../forms').FormOptions<F>) {
  cmsDeprecated(
    'defineForm',
    '`defineForm()` from "tinyzoo" is replaced by `defineForm()` from "tinyzoo/forms" with `export const plugins = [formsPlugin()]` in cms.config.ts.',
    { removeIn: '0.4.0' },
  )
  const e = formsDefineForm(name, opts)
  ;(e as any).requiresPlugin = IMPLICIT_FORMS_REQUIREMENT
  return e
}

/**
 * @deprecated Import `defineFormSettings` from `tinyzoo/forms` and register `formsPlugin()`.
 * Still works (it registers the plugin by itself). Removed in 0.4.
 */
export function defineFormSettings(opts: Parameters<typeof formsDefineFormSettings>[0] = {}) {
  cmsDeprecated(
    'defineFormSettings',
    '`defineFormSettings()` from "tinyzoo" is replaced by `defineFormSettings()` from "tinyzoo/forms" with `export const plugins = [formsPlugin()]` in cms.config.ts.',
    { removeIn: '0.4.0' },
  )
  const e = formsDefineFormSettings(opts)
  ;(e as any).requiresPlugin = IMPLICIT_FORMS_REQUIREMENT
  return e
}
