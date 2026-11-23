import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Photographer template: what its owner can write and change.
// One model for all three looks (looks.ts): a look decides how a block is drawn, never what
// it holds. Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and
// `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below and a switcher in each
// look's header: app/utils/site.ts holds the website's own words per language already.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Část mezi *hvězdičkami* vzhled zvýrazní, například kurzivou.',
  en: 'A part between *asterisks* is set apart by the look, in italics for example.',
}

// ── the whole site ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'Name, look, colours and contacts shown across the website.', cs: 'Název, vzhled, barvy a kontakty, které se ukazují na celém webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'tagline'] },
      { label: { en: 'Header', cs: 'Hlavička' }, fields: ['ctaLabel', 'ctaUrl', 'availability'] },
      { label: { en: 'Contacts', cs: 'Kontakty' }, fields: ['phone', 'email', 'address', 'addressNote', 'instagram', 'facebook', 'companyId'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Site name', cs: 'Název webu' })
      .help({ en: 'Your name or the name of your studio: the wordmark in the header and footer.', cs: 'Vaše jméno nebo název ateliéru: nápis v hlavičce a patičce.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Shown instead of the name, when you have one.', cs: 'Když ho máte, ukáže se místo názvu.' }),
    look: f.select({ options: looks.ids, default: looks.ids[0], labels: looks.labels }).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'The design of the whole website. Your content stays as it is.', cs: 'Design celého webu. Obsah zůstává, jak je.' }),
    colors: f.select({ options: looks.presetIds, default: looks.presetIds[0], labels: looks.presetLabels }).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour sets: pick one that starts with the name of your look.', cs: 'Každý vzhled má troje barvy: vyberte ty, které začínají názvem vašeho vzhledu.' }),
    tagline: f.text({ multiline: true }).optional().label({ en: 'Short description', cs: 'Krátký popis' })
      .help({ en: 'One or two sentences for the footer.', cs: 'Jedna dvě věty do patičky.' }),
    ctaLabel: f.text().optional().label({ en: 'Button in the header', cs: 'Tlačítko v hlavičce' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'The button goes to', cs: 'Tlačítko vede na' }),
    availability: f.text().optional().label({ en: 'Free dates', cs: 'Volné termíny' })
      .help({ en: 'A short sentence shown in the opening of the home page.', cs: 'Krátká věta, která se ukáže v úvodu webu.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'Email', cs: 'E-mail' }),
    address: f.text().optional().label({ en: 'Studio address', cs: 'Adresa ateliéru' }),
    addressNote: f.text().optional().label({ en: 'Note to the address', cs: 'Poznámka k adrese' })
      .help({ en: 'For example "by appointment".', cs: 'Například „po předchozí domluvě“.' }),
    instagram: f.text({ format: 'url' }).optional().label({ en: 'Instagram', cs: 'Instagram' }),
    facebook: f.text({ format: 'url' }).optional().label({ en: 'Facebook', cs: 'Facebook' }),
    companyId: f.text().optional().label({ en: 'Company number', cs: 'IČO' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── categories of the work: weddings, portraits… ──
export const Category = defineEntity('category', {
  label: { en: 'Categories', cs: 'Kategorie' },
  labelSingular: { en: 'Category', cs: 'Kategorie' },
  description: { en: 'What you photograph: albums are filed under these.', cs: 'Co fotíte: do kategorií se řadí alba.' },
  icon: 'i-lucide-folders',
  titleField: 'name',
  admin: { list: { columns: ['name'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    slug: f.slug({ from: 'name', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    description: f.text({ multiline: true }).optional().label({ en: 'Description', cs: 'Popis' })
      .help({ en: 'A sentence or two at the top of the category\'s page.', cs: 'Věta nebo dvě nahoře na stránce kategorie.' }),
    // The order: editors arrange the list by dragging ("Arrange" in the admin), the website follows.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, slug: 'slug', path: '/galerie/:slug' },
})

// ── albums: one shoot each, with its photographs ──
export const Album = defineEntity('album', {
  label: { en: 'Albums', cs: 'Alba' },
  labelSingular: { en: 'Album', cs: 'Album' },
  description: { en: 'One shoot each. Their photographs fill the gallery on the website.', cs: 'Každé album je jedno focení. Jeho fotografie plní galerii na webu.' },
  icon: 'i-lucide-images',
  titleField: 'title',
  admin: { list: { columns: ['cover', 'title', 'category', 'status', 'date'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    category: f.relation({ to: () => Category, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Category', cs: 'Kategorie' }),
    date: f.datetime({ allDay: true }).optional().label({ en: 'Date', cs: 'Datum' })
      .help({ en: 'Newer albums come first.', cs: 'Novější alba jsou dřív.' }),
    place: f.text().optional().label({ en: 'Place', cs: 'Místo' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Krátký text' }),
    cover: f.media({ accept: 'image/*' }).optional().label({ en: 'Cover photo', cs: 'Titulní fotka' })
      .help({ en: 'Without one, the first photograph is used.', cs: 'Bez ní se použije první fotografie.' }),
    photos: f.gallery({ accept: 'image/*', max: 200 }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Shown in this order. A caption is the name of the picture in the gallery.', cs: 'Ukážou se v tomto pořadí. Popisek je názvem fotky v galerii.' }),
    ...seo(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/album/:slug' },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: '/album/:slug',
    populate: ['category', 'cover', 'photos', 'ogImage'],
  },
})

// ── packages: what a shoot costs ──
// (named `pack`: `package` is a reserved word, and the entity's name becomes a variable in the generated schema)
export const Pack = defineEntity('pack', {
  label: { en: 'Packages', cs: 'Balíčky' },
  labelSingular: { en: 'Package', cs: 'Balíček' },
  description: { en: 'The price list: each package with what is in the price.', cs: 'Ceník: každý balíček s tím, co je v ceně.' },
  icon: 'i-lucide-tags',
  titleField: 'name',
  admin: { list: { columns: ['name', 'price', 'highlighted'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
    description: f.text().optional().label({ en: 'One line', cs: 'Jedna věta' }),
    includes: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }) },
      max: 12, itemLabel: { en: 'Line', cs: 'Řádek' },
    }).label({ en: 'What is in the price', cs: 'Co je v ceně' }),
    highlighted: f.boolean().label({ en: 'Highlighted', cs: 'Zvýrazněný' }),
    highlightLabel: f.text().optional().label({ en: 'Label of the highlight', cs: 'Štítek zvýraznění' })
      .help({ en: 'For example "Most often chosen".', cs: 'Například „Nejčastější volba“.' }),
    // The order: editors arrange the list by dragging ("Arrange" in the admin), the website follows.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── what clients said ──
export const Testimonial = defineEntity('testimonial', {
  label: { en: 'Testimonials', cs: 'Reference' },
  labelSingular: { en: 'Testimonial', cs: 'Reference' },
  icon: 'i-lucide-quote',
  titleField: 'name',
  admin: { list: { columns: ['name', 'occasion'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' })
      .help({ en: 'The first testimonial in the list is shown largest.', cs: 'První reference v seznamu se ukazuje největší.' }),
    occasion: f.text().optional().label({ en: 'Occasion', cs: 'Příležitost' })
      .help({ en: 'For example "wedding in Budislav".', cs: 'Například „svatba v Budislavi“.' }),
    text: f.text({ required: true, multiline: true, max: 600 }).label({ en: 'Text', cs: 'Text' }),
    // The order: editors arrange the list by dragging ("Arrange" in the admin), the website follows.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })

const hero = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The big heading with photographs and two links.', cs: 'Velký nadpis s fotografiemi a dvěma odkazy.' },
  icon: 'i-lucide-panel-top',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    images: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 3, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'One to three. Every look shows the first; the others where the look has room for them.', cs: 'Jedna až tři. První ukazuje každý vzhled, další tam, kde na ně vzhled má místo.' }),
    darkImage: f.media({ accept: 'image/*' }).label({ en: 'Photograph for dark looks', cs: 'Fotografie pro tmavé vzhledy' })
      .help({ en: 'Optional. The look Negativ lays the heading over the photograph, so a dark, calm one reads best there. Without it Negativ shows the first photograph.', cs: 'Nepovinná. Vzhled Negativ píše nadpis přes fotografii, proto se tam hodí tmavá a klidná. Bez ní ukáže Negativ první fotografii.' }),
    primaryLabel: f.text().label({ en: 'First link', cs: 'První odkaz' }),
    primaryUrl: link('The first link goes to', 'První odkaz vede na'),
    secondaryLabel: f.text().label({ en: 'Second link', cs: 'Druhý odkaz' }),
    secondaryUrl: link('The second link goes to', 'Druhý odkaz vede na'),
  },
})

const gallery = defineBlock({
  label: { en: 'Gallery by category', cs: 'Galerie podle kategorií' },
  description: { en: 'Photographs from your albums, with the categories as a filter.', cs: 'Fotografie z vašich alb, kategorie fungují jako filtr.' },
  icon: 'i-lucide-layout-grid',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    count: f.number({ int: true, min: 3, max: 30 }).label({ en: 'How many photographs', cs: 'Kolik fotografií' })
      .help({ en: 'Taken from all published albums in turn. The opening\'s photograph is left out.', cs: 'Berou se postupně ze všech zveřejněných alb. Fotka z úvodu se vynechá.' }),
    allLabel: f.text().label({ en: 'Link to all albums', cs: 'Odkaz na všechna alba' }),
    allUrl: link('The link goes to', 'Odkaz vede na'),
  },
})

const story = defineBlock({
  label: { en: 'One day', cs: 'Příběh jednoho dne' },
  description: { en: 'One shoot told in a few photographs with times.', cs: 'Jedno focení vyprávěné několika fotografiemi s časy.' },
  icon: 'i-lucide-film',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    facts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }),
        value: f.text({ required: true }).label({ en: 'Value', cs: 'Hodnota' }),
      },
      max: 5, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'Facts', cs: 'Údaje' })
      .help({ en: 'When, where, how many photographs.', cs: 'Kdy, kde, kolik fotografií.' }),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        time: f.text().label({ en: 'Time', cs: 'Čas' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 8, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Four to eight, in the order of the day.', cs: 'Čtyři až osm, v pořadí, jak den šel.' }),
    closing: f.text().label({ en: 'Closing sentence', cs: 'Věta na závěr' }),
    buttonLabel: f.text().label({ en: 'Button', cs: 'Tlačítko' }),
    buttonUrl: link('The button goes to', 'Tlačítko vede na'),
  },
})

const pricing = defineBlock({
  label: { en: 'Price list', cs: 'Ceník' },
  description: { en: 'Your packages, with a note under them.', cs: 'Vaše balíčky a poznámka pod nimi.' },
  icon: 'i-lucide-tags',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    buttonLabel: f.text().label({ en: 'Button of the highlighted package', cs: 'Tlačítko zvýrazněného balíčku' }),
    buttonUrl: link('The button goes to', 'Tlačítko vede na'),
    footnote: f.text({ multiline: true }).label({ en: 'Note under the packages', cs: 'Poznámka pod balíčky' }),
    footnoteLinkLabel: f.text().label({ en: 'Link after the note', cs: 'Odkaz za poznámkou' }),
    footnoteLinkUrl: link('The link goes to', 'Odkaz vede na'),
  },
})

const about = defineBlock({
  label: { en: 'About me', cs: 'O mně' },
  description: { en: 'A portrait, a few paragraphs and a short list of facts.', cs: 'Portrét, pár odstavců a krátký seznam údajů.' },
  icon: 'i-lucide-user-round',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
      .help({ en: 'An empty line starts a new paragraph.', cs: 'Prázdný řádek začíná nový odstavec.' }),
    facts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }),
        value: f.text({ required: true }).label({ en: 'Value', cs: 'Hodnota' }),
      },
      max: 6, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'Facts', cs: 'Údaje' }),
    signature: f.text().label({ en: 'Signature', cs: 'Podpis' }),
  },
})

const testimonials = defineBlock({
  label: { en: 'Testimonials', cs: 'Reference' },
  description: { en: 'What clients said, from Testimonials.', cs: 'Co řekli klienti, z Referencí.' },
  icon: 'i-lucide-quote',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(false),
    count: f.number({ int: true, min: 1, max: 12 }).label({ en: 'How many', cs: 'Kolik' }),
  },
})

const steps = defineBlock({
  label: { en: 'How it goes', cs: 'Postup' },
  description: { en: 'Three to five steps from the first message to the gallery.', cs: 'Tři až pět kroků od první zprávy po galerii.' },
  icon: 'i-lucide-list-ordered',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    items: f.list({
      fields: {
        title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 5, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'Steps', cs: 'Kroky' }),
  },
})

const enquiry = defineBlock({
  label: { en: 'Enquiry form', cs: 'Poptávkový formulář' },
  description: { en: 'The date request form beside your contacts.', cs: 'Formulář pro poptávku termínu vedle vašich kontaktů.' },
  icon: 'i-lucide-mail',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    consent: f.text().label({ en: 'Sentence under the form', cs: 'Věta pod formulářem' })
      .help({ en: 'The part between *asterisks* becomes the link below.', cs: 'Část mezi *hvězdičkami* se stane odkazem níže.' }),
    consentUrl: link('The sentence links to', 'Věta odkazuje na'),
  },
})

const albums = defineBlock({
  label: { en: 'All albums', cs: 'Všechna alba' },
  description: { en: 'Every published album, with the categories to choose from.', cs: 'Všechna zveřejněná alba, s kategoriemi na výběr.' },
  icon: 'i-lucide-images',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
  },
})

const text = defineBlock({
  label: { en: 'Text', cs: 'Text' },
  description: { en: 'Paragraphs, headings, lists and links.', cs: 'Odstavce, nadpisy, seznamy a odkazy.' },
  icon: 'i-lucide-text',
  fields: {
    heading: heading(false),
    body: f.richtext().label({ en: 'Text', cs: 'Text' }),
  },
})

// Pages built from blocks: title, address, status, blocks, SEO, preview.
export const Page = definePages({
  blocks: { hero, gallery, story, pricing, about, testimonials, steps, enquiry, albums, text },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    footer: { en: 'Footer menu', cs: 'Menu v patičce' },
    legal: { en: 'Small print in the footer', cs: 'Drobné odkazy v patičce' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the messages of the enquiry form below
]

// ── the enquiry form ──
export const Enquiry = defineForm('enquiry', {
  label: { en: 'Enquiries', cs: 'Poptávky' },
  labelSingular: { en: 'Enquiry', cs: 'Poptávka' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name', cs: 'Jméno' }),
    email: f.text({ required: true, format: 'email' }).label({ en: 'Email', cs: 'E-mail' }),
    kind: f.select({
      options: ['wedding', 'portrait', 'family', 'business', 'other'] as const,
      default: 'wedding',
      labels: {
        wedding: { en: 'Wedding', cs: 'Svatba' },
        portrait: { en: 'Portrait', cs: 'Portrét' },
        family: { en: 'Family', cs: 'Rodina' },
        business: { en: 'Business shoot', cs: 'Firemní focení' },
        other: { en: 'Something else', cs: 'Něco jiného' },
      },
    }).label({ en: 'Kind of shoot', cs: 'Typ focení' }),
    // The website shows a field's help inside it, as an example of what to write.
    date: f.text({ max: 200 }).optional().label({ en: 'Date', cs: 'Termín' }).help({ en: 'e.g. 12 June 2027', cs: 'např. 12. 6. 2027' }),
    message: f.text({ multiline: true, max: 5000 }).optional().label({ en: 'Message', cs: 'Zpráva' })
      .help({ en: 'Where the shoot will be, how many of you, what matters to you…', cs: 'Kde se bude fotit, kolik vás bude, co je pro vás důležité…' }),
  },
  submitLabel: { en: 'Send the enquiry', cs: 'Odeslat poptávku' },
  successMessage: { en: 'Thank you. I will reply within two working days.', cs: 'Děkuji. Ozvu se do dvou pracovních dnů.' },
})
export const FormSettings = defineFormSettings()
