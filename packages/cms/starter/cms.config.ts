import {
  defineBlock, defineEntity, defineLocales, defineNavigation,
  definePages, defineRedirects, defineSingleton, eq, f, seo,
} from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'

// The content model of the website: what editors can write and change. Change it
// here, then `pnpm db:generate` (review the SQL) and `pnpm db:migrate`.

// Czech first; English is a translation of the fields marked .localized().
export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

// ── the whole site ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'Name, contacts and opening hours shown across the website.', cs: 'Název, kontakty a otevírací doba, které se ukazují na celém webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Site name', cs: 'Název webu' }),
    tagline: f.text().optional().localized().label({ en: 'Tagline', cs: 'Slogan' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'Email', cs: 'E-mail' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    address: f.text({ multiline: true }).optional().label({ en: 'Address', cs: 'Adresa' }),
    openingHours: f.list({
      fields: {
        days: f.text({ required: true }).label({ en: 'Days', cs: 'Dny' }),
        hours: f.text().label({ en: 'Hours', cs: 'Hodiny' }),
      },
      max: 14,
      itemLabel: { en: 'Opening hours', cs: 'Otevírací doba' },
    }).label({ en: 'Opening hours', cs: 'Otevírací doba' }),
    ...seo({ localized: true }),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── page building blocks: each is drawn by components/global/Block<Type>.vue ──
const hero = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'A big heading with a picture and a button.', cs: 'Velký nadpis s obrázkem a tlačítkem.' },
  icon: 'i-lucide-panel-top',
  fields: {
    heading: f.text({ required: true }).label({ en: 'Heading', cs: 'Nadpis' }),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    image: f.media({ accept: 'image/*' }).label({ en: 'Picture', cs: 'Obrázek' }),
    buttonLabel: f.text().label({ en: 'Button', cs: 'Tlačítko' }),
    buttonUrl: f.text({ format: 'link' }).label({ en: 'Button goes to', cs: 'Tlačítko vede na' }),
  },
})
const text = defineBlock({
  label: { en: 'Text', cs: 'Text' },
  description: { en: 'Paragraphs, headings, lists and links.', cs: 'Odstavce, nadpisy, seznamy a odkazy.' },
  icon: 'i-lucide-text',
  fields: { body: f.richtext().label({ en: 'Text', cs: 'Text' }) },
})
const image = defineBlock({
  label: { en: 'Picture', cs: 'Obrázek' },
  description: { en: 'One picture with a caption.', cs: 'Jeden obrázek s popiskem.' },
  icon: 'i-lucide-image',
  fields: {
    image: f.media({ accept: 'image/*' }).label({ en: 'Picture', cs: 'Obrázek' }),
    caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
  },
})
const cta = defineBlock({
  label: { en: 'Call to action', cs: 'Výzva' },
  description: { en: 'A short invitation with a button.', cs: 'Krátká výzva s tlačítkem.' },
  icon: 'i-lucide-megaphone',
  fields: {
    heading: f.text({ required: true }).label({ en: 'Heading', cs: 'Nadpis' }),
    buttonLabel: f.text({ required: true }).label({ en: 'Button', cs: 'Tlačítko' }),
    buttonUrl: f.text({ required: true, format: 'link' }).label({ en: 'Button goes to', cs: 'Tlačítko vede na' }),
  },
})
const contact = defineBlock({
  label: { en: 'Contact form', cs: 'Kontaktní formulář' },
  description: { en: 'The contact form, with a heading.', cs: 'Kontaktní formulář s nadpisem.' },
  icon: 'i-lucide-mail',
  fields: { heading: f.text().label({ en: 'Heading', cs: 'Nadpis' }) },
})

// Pages built from blocks: title, address, status, blocks, SEO, preview. `tree: true` lets
// pages sit under pages (/o-nas/tym): editors arrange them as a tree, moving a page leaves
// redirects (Redirect below), and the website gets breadcrumbs and the tree for navigation.
// Leave it out for flat pages (/o-nas).
export const Page = definePages({ blocks: { hero, text, image, cta, contact }, localized: true, tree: true })

// ── news ──
export const News = defineEntity('news', {
  label: { en: 'News', cs: 'Aktuality' },
  labelSingular: { en: 'News item', cs: 'Aktualita' },
  icon: 'i-lucide-newspaper',
  titleField: 'title',
  admin: { list: { columns: ['cover', 'title', 'status', 'publishedAt'] } },
  fields: {
    title: f.text({ required: true }).localized().label({ en: 'Title', cs: 'Název' }),
    slug: f.slug({ from: 'title', unique: true }).localized().label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    publishedAt: f.datetime().optional().label({ en: 'Publish date', cs: 'Datum zveřejnění' }),
    cover: f.media({ accept: 'image/*' }).optional().label({ en: 'Cover photo', cs: 'Úvodní fotka' }),
    perex: f.text({ multiline: true, max: 300 }).optional().localized().label({ en: 'Summary', cs: 'Perex' }),
    body: f.richtext().localized().label({ en: 'Text', cs: 'Text' }),
    ...seo({ localized: true }),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', dateField: 'publishedAt', preview: { cs: '/aktuality/:slug', en: '/news/:slug' } },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: { cs: '/aktuality/:slug', en: '/news/:slug' },
    populate: ['cover', 'ogImage'],
  },
})

// ── menus, redirects, forms ──
export const Navigation = defineNavigation({ localized: true })
export const Redirect = defineRedirects()

// Plugins add features with their own admin pages, routes and tables: Forms here.
export const plugins = [formsPlugin()]

export const ContactForm = defineForm('contactForm', {
  label: { en: 'Contact form', cs: 'Kontaktní formulář' },
  labelSingular: { en: 'Message', cs: 'Zpráva' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Your name', cs: 'Vaše jméno' }),
    email: f.text({ required: true, format: 'email' }).label({ en: 'Email', cs: 'E-mail' }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'Message', cs: 'Zpráva' }),
  },
  successMessage: { en: 'Thank you, we will reply soon.', cs: 'Děkujeme, brzy se ozveme.' },
})
export const FormSettings = defineFormSettings()
