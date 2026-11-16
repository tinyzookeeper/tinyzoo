import { eq } from 'drizzle-orm'
import { type BlockDef, defineBlock } from './blocks'
import { defineEntity, defineSingleton } from './entity'
import { f } from './fields'
import type { LocalizedText } from './i18n'
import type { PathTemplate } from './paths'

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
      sub: f.boolean().label({ en: 'Under the link above', cs: 'Pod odkazem nad ním', de: 'Unter dem vorherigen Link' })
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
    label: opts.label ?? { en: 'Pages', cs: 'Stránky', de: 'Seiten' },
    labelSingular: opts.labelSingular ?? { en: 'Page', cs: 'Stránka', de: 'Seite' },
    description: opts.description ?? { en: 'Pages of the website, built from blocks.', cs: 'Stránky webu poskládané z bloků.', de: 'Die Seiten der Website, aus Blöcken aufgebaut.' },
    icon: 'i-lucide-file',
    titleField: 'title',
    admin: { list: { columns: ['title', 'status'] } },
    fields: {
      title: loc(f.text({ required: true })).label({ en: 'Title', cs: 'Název', de: 'Titel' }),
      slug: loc(f.slug({ from: 'title', unique: true })).label({ en: 'URL address', cs: 'Adresa (URL)', de: 'Adresse (URL)' }),
      status: f.select({
        options: ['draft', 'published'] as const,
        default: 'draft',
        labels: { draft: { en: 'Draft', cs: 'Koncept', de: 'Entwurf' }, published: { en: 'Published', cs: 'Zveřejněno', de: 'Veröffentlicht' } },
      }),
      sections: loc(f.blocks(opts.blocks)).label({ en: 'Content', cs: 'Obsah', de: 'Inhalte' }),
      ...seo({ localized: opts.localized }),
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

/** Field types a visitor can fill in on a website form. */
export const FORM_FIELD_TYPES = new Set(['text', 'number', 'boolean', 'select', 'datetime'])

export interface FormOptions<F extends Record<string, any>> {
  /** The form's name in the admin ("Contact form", { cs: 'Kontaktní formulář' }). */
  label: LocalizedText
  /** One submission ("Message"); the list of submissions is labelled with `label`. */
  labelSingular?: LocalizedText
  description?: LocalizedText
  /** What visitors fill in: text (also `format: 'email'`, `multiline`), number, yes/no, a choice, a date. */
  fields: F
  /** The field that names a submission in the list (default: the first text field). */
  titleField?: keyof F & string
  /** The button under the form on the website. */
  submitLabel?: LocalizedText
  /** Shown after sending. */
  successMessage?: LocalizedText
  /**
   * Who is told about a new submission, by email. Addresses set by editors in the
   * Forms settings (defineFormSettings) come first; these are the fallback.
   */
  notify?: { to?: string[] }
  /**
   * Delete a submission this many days after it arrived (a scheduled task does it, daily;
   * the admin says so under the list). Default: keep them until someone deletes them.
   * Set it to what the site's privacy policy promises.
   */
  retentionDays?: number
}

/**
 * A form on the website (contact, sign-up, order): visitors fill it in, every
 * submission lands in the admin as an entry of this collection, and editors are told
 * by email. Spam is kept out by a hidden field, a minimum time to fill it in, a rate
 * limit per visitor and, when configured, Cloudflare Turnstile.
 *
 *   export const ContactForm = defineForm('contactForm', {
 *     label: { en: 'Contact form', cs: 'Kontaktní formulář' },
 *     fields: {
 *       name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
 *       email: f.text({ required: true, format: 'email' }).label({ en: 'Email', cs: 'E-mail' }),
 *       message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'Message', cs: 'Zpráva' }),
 *     },
 *   })
 *   // on the website: <CmsForm name="contactForm" />
 *   // or POST /api/content/_form/contactForm { name, email, message }
 */
export function defineForm<F extends Record<string, any>>(name: string, opts: FormOptions<F>) {
  if (opts.retentionDays !== undefined && (!Number.isInteger(opts.retentionDays) || opts.retentionDays < 1)) {
    throw new Error(`Form "${name}": retentionDays must be a whole number of days, at least 1 (leave it out to keep submissions).`)
  }
  for (const [key, fld] of Object.entries(opts.fields) as [string, any][]) {
    if (key === 'status' || key === 'id') throw new Error(`Form field "${key}" is reserved.`)
    if (!FORM_FIELD_TYPES.has(fld.type) || fld.relation) {
      throw new Error(`Form field "${key}" has type "${fld.type}", which website forms do not support (allowed: ${[...FORM_FIELD_TYPES].join(', ')}).`)
    }
  }
  const keys = Object.keys(opts.fields)
  const titleField = opts.titleField ?? keys.find((k) => (opts.fields as any)[k].type === 'text') ?? keys[0]!
  const e = defineEntity(name, {
    label: opts.label,
    labelSingular: opts.labelSingular ?? { en: 'Submission', cs: 'Odpověď', de: 'Nachricht' },
    description: opts.description,
    icon: 'i-lucide-inbox',
    titleField,
    fields: {
      ...opts.fields,
      status: f.select({
        options: ['new', 'read', 'done'] as const, default: 'new',
        labels: { new: { en: 'New', cs: 'Nové', de: 'Neu' }, read: { en: 'Read', cs: 'Přečtené', de: 'Gelesen' }, done: { en: 'Done', cs: 'Vyřízené', de: 'Erledigt' } },
        icons: { new: 'i-lucide-mail', read: 'i-lucide-mail-open', done: 'i-lucide-check' },
      }).position('sidebar').label({ en: 'State', cs: 'Stav', de: 'Status' }),
    },
    admin: { list: { columns: [...keys.slice(0, 3), 'status'] as any, searchable: keys.filter((k) => (opts.fields as any)[k].type === 'text') as any } },
  } as any)
  ;(e as any).preset = 'form'
  ;(e as any).form = {
    fields: keys,
    submitLabel: opts.submitLabel ?? null,
    successMessage: opts.successMessage ?? null,
    notify: { to: opts.notify?.to ?? [] },
    retentionDays: opts.retentionDays ?? null,
  }
  return e
}

/**
 * Settings for every website form: who gets an email about new submissions. Optional;
 * without it, each form's `notify.to` (code) or `cms.forms.notifyTo` (env) is used.
 */
export function defineFormSettings(opts: { name?: string } = {}) {
  const e = defineSingleton(opts.name ?? 'formSettings', {
    label: { en: 'Forms', cs: 'Formuláře', de: 'Formulare' },
    description: { en: 'Who is told about new messages from the website.', cs: 'Komu přijde e-mail o nových zprávách z webu.', de: 'Wer über neue Nachrichten von der Website informiert wird.' },
    icon: 'i-lucide-inbox',
    titleField: 'notifyTo',
    fields: {
      notifyTo: f.list({
        fields: { email: f.text({ required: true, format: 'email' }).label({ en: 'Email', cs: 'E-mail', de: 'E-Mail' }) },
        max: 20, itemLabel: { en: 'Recipient', cs: 'Příjemce', de: 'Empfänger' },
      }).label({ en: 'Send new messages to', cs: 'Nové zprávy posílat na', de: 'Neue Nachrichten senden an' })
        .help({ en: 'Everyone here gets an email when someone sends a form on the website.', cs: 'Všem zde přijde e-mail, když někdo odešle formulář na webu.', de: 'Alle hier erhalten eine E-Mail, wenn jemand ein Formular auf der Website absendet.' }),
    },
  } as any)
  ;(e as any).preset = 'formSettings'
  return e
}
