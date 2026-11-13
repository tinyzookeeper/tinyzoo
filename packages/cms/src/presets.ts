import { eq } from 'drizzle-orm'
import { type BlockDef, defineBlock } from './blocks'
import { defineEntity, defineSingleton } from './entity'
import { f } from './fields'
import type { LocalizedText } from './i18n'
import type { PathTemplate } from './paths'

const SEO_GROUP = { en: 'Search & sharing', cs: 'Vyhledávače a sdílení' }

/**
 * Reusable SEO/metadata fields. Spread into an entity (or singleton):
 *   fields: { ...seo(), title: f.text({ required: true }), … }
 * Produces metaTitle / metaDescription / ogImage columns — plain queryable fields,
 * delivered like any other through the content API.
 */
export function seo() {
  return {
    metaTitle: f.text().optional().position('sidebar').group(SEO_GROUP)
      .label({ en: 'Search title', cs: 'Titulek pro vyhledávače' })
      .help({ en: 'Shown in Google results and browser tabs instead of the title. Around 60 characters.', cs: 'Zobrazí se ve výsledcích Googlu a v záložce prohlížeče místo názvu. Zhruba 60 znaků.' }),
    metaDescription: f.text().optional().position('sidebar').group(SEO_GROUP)
      .label({ en: 'Search description', cs: 'Popis pro vyhledávače' })
      .help({ en: 'The short text under the title in Google results and when shared. Around 155 characters.', cs: 'Krátký text pod titulkem ve výsledcích Googlu a při sdílení. Zhruba 155 znaků.' }),
    ogImage: f.media({ accept: 'image/*' }).optional().position('sidebar').group(SEO_GROUP)
      .label({ en: 'Sharing image', cs: 'Obrázek pro sdílení' })
      .help({ en: 'Shown when the page is shared on social networks and in messages.', cs: 'Zobrazí se při sdílení stránky na sociálních sítích a ve zprávách.' }),
  }
}

/** A link in a menu: label, address, open in a new tab. */
export function linkBlock() {
  return defineBlock({
    label: { en: 'Link', cs: 'Odkaz' },
    description: { en: 'A page on this site or another website.', cs: 'Stránka tohoto webu nebo jiný web.' },
    icon: 'i-lucide-link',
    fields: {
      label: f.text({ required: true }).label({ en: 'Label', cs: 'Text odkazu' }),
      url: f.text({ required: true, format: 'link' }).label({ en: 'Address', cs: 'Adresa' })
        .help({ en: 'A page on this site (/contact) or a full address (https://…).', cs: 'Stránka tohoto webu (/kontakt) nebo celá adresa (https://…).' }),
      newTab: f.boolean().label({ en: 'Open in a new tab', cs: 'Otevřít v nové záložce' }),
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
 */
export function definePages<const B extends Record<string, BlockDef<any>>>(opts: {
  blocks: B
  name?: string
  label?: LocalizedText
  labelSingular?: LocalizedText
  description?: LocalizedText
  localized?: boolean
  path?: PathTemplate
}) {
  const loc = <T extends { localized: () => any }>(d: T): T => (opts.localized ? d.localized() : d)
  const path = opts.path ?? '/:slug'
  return defineEntity(opts.name ?? 'page', {
    label: opts.label ?? { en: 'Pages', cs: 'Stránky' },
    labelSingular: opts.labelSingular ?? { en: 'Page', cs: 'Stránka' },
    description: opts.description ?? { en: 'Pages of the website, built from blocks.', cs: 'Stránky webu poskládané z bloků.' },
    icon: 'i-lucide-file',
    titleField: 'title',
    admin: { list: { columns: ['title', 'status'] } },
    fields: {
      title: loc(f.text({ required: true })).label({ en: 'Title', cs: 'Název' }),
      slug: loc(f.slug({ from: 'title', unique: true })).label({ en: 'URL address', cs: 'Adresa (URL)' }),
      status: f.select({
        options: ['draft', 'published'] as const,
        default: 'draft',
        labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
      }),
      sections: loc(f.blocks(opts.blocks)).label({ en: 'Content', cs: 'Obsah' }),
      ...seo(),
    },
    publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: path },
    content: {
      public: true,
      published: (t) => eq(t.status, 'published'),
      slug: 'slug',
      path,
    },
  })
}

/**
 * Site menus as one settings screen: each menu is an ordered list of links.
 *
 *   export const Navigation = defineNavigation({ localized: true })
 *   // → GET /api/content/_global/navigation → { main: [{ label, url, newTab }], footer: [...] }
 */
export function defineNavigation(opts: { name?: string; menus?: Record<string, LocalizedText>; localized?: boolean } = {}) {
  const menus = opts.menus ?? {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    footer: { en: 'Footer menu', cs: 'Menu v patičce' },
  }
  const fields: Record<string, any> = {}
  for (const [key, label] of Object.entries(menus)) {
    const field = f.blocks({ link: linkBlock() }).label(label)
    fields[key] = opts.localized ? field.localized() : field
  }
  return defineSingleton(opts.name ?? 'navigation', {
    label: { en: 'Navigation', cs: 'Navigace' },
    description: { en: 'The menus of the website.', cs: 'Menu webu.' },
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
    label: { en: 'Redirects', cs: 'Přesměrování' },
    labelSingular: { en: 'Redirect', cs: 'Přesměrování' },
    description: {
      en: 'Send visitors from an old address to a new one — keeps old links and search results working.',
      cs: 'Pošle návštěvníky ze staré adresy na novou — staré odkazy i výsledky vyhledávání dál fungují.',
    },
    icon: 'i-lucide-corner-down-right',
    titleField: 'from',
    // Applied to the website the moment it is saved: authors cannot write redirects.
    live: true,
    admin: { list: { columns: ['from', 'to', 'permanent'] } },
    fields: {
      from: f.text({ required: true, format: 'path' }).unique()
        .label({ en: 'From', cs: 'Z adresy' })
        .help({ en: 'The old address on this site, e.g. /old-page.', cs: 'Stará adresa na tomto webu, např. /stara-stranka.' }),
      to: f.text({ required: true, format: 'link' })
        .label({ en: 'To', cs: 'Na adresu' })
        .help({ en: 'Where to send visitors: /new-page or https://…', cs: 'Kam návštěvníky poslat: /nova-stranka nebo https://…' }),
      permanent: f.boolean({ default: true })
        .label({ en: 'Permanent', cs: 'Trvalé' })
        .help({ en: 'Tells search engines the page moved for good (301).', cs: 'Řekne vyhledávačům, že se stránka přesunula natrvalo (301).' }),
    },
  })
  ;(e as any).preset = 'redirects'
  return e
}
