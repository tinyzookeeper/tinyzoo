import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from 'tinyzoo'
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
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou.',
  en: 'Text between *asterisks* stands out, for example in italics.',
}

// ── the whole site ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'Your website’s name, look, colours and contact details.', cs: 'Upravte název, vzhled, barvy a kontaktní údaje webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'tagline'] },
      { label: { en: 'Header', cs: 'Záhlaví' }, fields: ['ctaLabel', 'ctaUrl', 'availability'] },
      { label: { en: 'Contact details', cs: 'Kontakty' }, fields: ['phone', 'email', 'address', 'addressNote', 'instagram', 'facebook', 'companyId'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Site name', cs: 'Název webu' })
      .help({ en: 'Your name or your studio’s name. It appears in the header and footer.', cs: 'Vaše jméno nebo název ateliéru. Zobrazí se v záhlaví a zápatí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload a logo to show it in place of the name.', cs: 'Nahrajte logo a zobrazí se místo názvu.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    tagline: f.text({ multiline: true }).optional().label({ en: 'Short description', cs: 'Krátký popis' })
      .help({ en: 'One or two sentences for the footer.', cs: 'Jedna nebo dvě věty do zápatí.' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    availability: f.text().optional().label({ en: 'Free dates', cs: 'Volné termíny' })
      .help({
        en: 'A short note for visitors at the top of the home page. Negative sets parts separated by a dot ( · ) apart, as a row of dates.',
        cs: 'Krátká zpráva pro návštěvníky v úvodu webu. Negativ staví části oddělené tečkou ( · ) vedle sebe, jako řadu termínů.',
      }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    address: f.text().optional().label({ en: 'Studio address', cs: 'Adresa ateliéru' }),
    addressNote: f.text().optional().label({ en: 'Address note', cs: 'Poznámka k adrese' })
      .help({ en: 'For example, ‘by appointment’.', cs: 'Například „po předchozí domluvě“.' }),
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
  description: { en: 'Group your albums by the type of photography.', cs: 'Rozdělte alba podle toho, co fotíte.' },
  icon: 'i-lucide-folders',
  titleField: 'name',
  admin: { list: { columns: ['name'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    slug: f.slug({ from: 'name', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    description: f.text({ multiline: true }).optional().label({ en: 'Description', cs: 'Popis' })
      .help({ en: 'A sentence or two for the top of the category page.', cs: 'Jedna nebo dvě věty do úvodu stránky kategorie.' }),
    // The order: editors arrange the list by dragging ("Arrange" in the admin), the website follows.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, slug: 'slug', path: '/galerie/:slug' },
})

// ── albums: one shoot each, with its photographs ──
export const Album = defineEntity('album', {
  label: { en: 'Albums', cs: 'Alba' },
  labelSingular: { en: 'Album', cs: 'Album' },
  description: { en: 'Create an album for each shoot. The photos appear in your website’s gallery.', cs: 'Pro každé focení založte album. Fotografie se zobrazí v galerii na webu.' },
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
      .help({ en: 'Newer albums come first.', cs: 'Nejnovější alba se zobrazí jako první.' }),
    place: f.text().optional().label({ en: 'Place', cs: 'Místo' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Krátký text' }),
    cover: f.media({ accept: 'image/*' }).optional().label({ en: 'Cover photo', cs: 'Titulní fotografie' })
      .help({ en: 'If you leave this empty, the album uses its first photo as the cover.', cs: 'Pokud nevyberete titulní fotografii, použije se první z alba.' }),
    photos: f.gallery({ accept: 'image/*', max: 200 }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Drag to change the order. Captions can appear beside photos on the website.', cs: 'Pořadí změníte přetažením. Popisky se mohou zobrazit u fotografií na webu.' }),
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
  description: { en: 'List your packages, prices and what each includes.', cs: 'Uveďte ceny balíčků a co v nich zákazníci dostanou.' },
  icon: 'i-lucide-tags',
  titleField: 'name',
  admin: { list: { columns: ['name', 'price', 'highlighted'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
    description: f.text().optional().label({ en: 'Short description', cs: 'Krátký popis' }),
    includes: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }) },
      max: 12, itemLabel: { en: 'Line', cs: 'Řádek' },
    }).label({ en: 'What’s included', cs: 'Co je v ceně' }),
    highlighted: f.boolean().label({ en: 'Highlighted', cs: 'Zvýrazněný' }),
    highlightLabel: f.text().optional().label({ en: 'Highlight label', cs: 'Text štítku' })
      .help({ en: 'For example, ‘Most popular’.', cs: 'Například „Nejčastější volba“.' }),
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
      .help({ en: 'Some looks give the first testimonial more space.', cs: 'Některé vzhledy dávají víc prostoru první referenci v seznamu.' }),
    occasion: f.text().optional().label({ en: 'Occasion', cs: 'Příležitost' })
      .help({ en: 'For example, ‘Wedding in Budislav’.', cs: 'Například „svatba v Budislavi“.' }),
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
  description: { en: 'A large heading, photos and two links.', cs: 'Velký nadpis s fotografiemi a dvěma odkazy.' },
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
      .help({ en: 'Add up to three photos. Atelier uses the first, Negative can use a separate photo, and Notebook shows up to three.', cs: 'Přidejte až tři fotografie. Ateliér ukáže první, Negativ může použít vlastní a Zápisník ukáže až tři.' }),
    darkImage: f.media({ accept: 'image/*' }).label({ en: 'Photo for Negative', cs: 'Fotografie pro Negativ' })
      .help({ en: 'Negative puts the heading over this photo. Choose one with a dark, simple background, or leave this empty to use the first photo above.', cs: 'Nadpis se zobrazí přes fotografii. Vyberte snímek s tmavým pozadím, nebo pole nechte prázdné. Pak se použije první fotografie výše.' }),
    primaryLabel: f.text().label({ en: 'First link text', cs: 'Text prvního odkazu' }),
    primaryUrl: link('First link destination', 'Cíl prvního odkazu'),
    secondaryLabel: f.text().label({ en: 'Second link text', cs: 'Text druhého odkazu' }),
    secondaryUrl: link('Second link destination', 'Cíl druhého odkazu'),
  },
})

const gallery = defineBlock({
  label: { en: 'Gallery by category', cs: 'Galerie podle kategorií' },
  description: { en: 'Show photos from your albums and let visitors filter by category.', cs: 'Ukažte fotografie z alb. Návštěvníci je mohou filtrovat podle kategorií.' },
  icon: 'i-lucide-layout-grid',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    count: f.number({ int: true, min: 3, max: 30 }).label({ en: 'Number of photos', cs: 'Počet fotografií' })
      .help({ en: 'The gallery mixes photos from published albums and skips the opening photo.', cs: 'Galerie střídá fotografie ze zveřejněných alb a vynechá tu z úvodu.' }),
    allLabel: f.text().label({ en: 'Text of the link to all albums', cs: 'Text odkazu na všechna alba' }),
    allUrl: link('Link destination', 'Cíl odkazu'),
  },
})

const story = defineBlock({
  label: { en: 'Story of a day', cs: 'Příběh jednoho dne' },
  description: { en: 'Tell the story of a shoot with photos and times.', cs: 'Ukažte průběh focení na fotografiích s časy.' },
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
      .help({ en: 'For example, the date, location and number of photos.', cs: 'Třeba datum, místo a počet fotografií.' }),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        time: f.text().label({ en: 'Time', cs: 'Čas' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 8, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Add up to eight photos in the order they were taken.', cs: 'Přidejte až osm fotografií v pořadí, v jakém vznikly.' }),
    closing: f.text().label({ en: 'Closing sentence', cs: 'Věta na závěr' }),
    buttonLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    buttonUrl: link('Button destination', 'Cíl tlačítka'),
  },
})

const pricing = defineBlock({
  label: { en: 'Price list', cs: 'Ceník' },
  description: { en: 'Show your packages and add a note beneath them.', cs: 'Zobrazte balíčky a přidejte pod ně poznámku.' },
  icon: 'i-lucide-tags',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    buttonLabel: f.text().label({ en: 'Featured package button text', cs: 'Text tlačítka u zvýrazněného balíčku' }),
    buttonUrl: link('Button destination', 'Cíl tlačítka'),
    footnote: f.text({ multiline: true }).label({ en: 'Note under the packages', cs: 'Poznámka pod balíčky' }),
    footnoteLinkLabel: f.text().label({ en: 'Text of the link after the note', cs: 'Text odkazu za poznámkou' }),
    footnoteLinkUrl: link('Link destination', 'Cíl odkazu'),
  },
})

const about = defineBlock({
  label: { en: 'About me', cs: 'O mně' },
  description: { en: 'Introduce yourself in your own words and add a portrait.', cs: 'Představte se pár větami a přidejte portrét.' },
  icon: 'i-lucide-user-round',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
      .help({ en: 'Leave a blank line to start a new paragraph.', cs: 'Mezi odstavci nechte prázdný řádek.' }),
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
  description: { en: 'Show client quotes from the Testimonials section.', cs: 'Zobrazte citace klientů ze sekce Reference.' },
  icon: 'i-lucide-quote',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(false),
    count: f.number({ int: true, min: 1, max: 12 }).label({ en: 'Number to show', cs: 'Počet referencí' }),
  },
})

const steps = defineBlock({
  label: { en: 'How it works', cs: 'Postup' },
  description: { en: 'Describe how a shoot works in up to five steps, from first contact to delivery.', cs: 'Popište až v pěti krocích cestu od první zprávy po předání fotografií.' },
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
  description: { en: 'Let visitors enquire about a shoot next to your contact details.', cs: 'Vedle kontaktů ukažte formulář pro zájemce o focení.' },
  icon: 'i-lucide-mail',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    consent: f.text().label({ en: 'Sentence under the form', cs: 'Věta pod formulářem' })
      .help({ en: 'Text between *asterisks* links to the address you enter below.', cs: 'Text mezi *hvězdičkami* odkáže na adresu, kterou vyberete níže.' }),
    consentUrl: link('Link destination', 'Cíl odkazu'),
  },
})

const albums = defineBlock({
  label: { en: 'All albums', cs: 'Všechna alba' },
  description: { en: 'Show all published albums. Visitors can browse by category.', cs: 'Zobrazte všechna zveřejněná alba. Návštěvníci si mohou vybrat kategorii.' },
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
  blocks: { hero, gallery, story, pricing, about, testimonials, steps, enquiry, albums, text, ...customTypeBlocks() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    footer: { en: 'Footer menu', cs: 'Menu v zápatí' },
    legal: { en: 'Legal links in the footer', cs: 'Právní odkazy v zápatí' },
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
    email: f.text({ required: true, format: 'email' }).label({ en: 'E-mail', cs: 'E-mail' }),
    kind: f.select({
      options: ['wedding', 'portrait', 'family', 'business', 'other'] as const,
      default: 'wedding',
      labels: {
        wedding: { en: 'Wedding', cs: 'Svatba' },
        portrait: { en: 'Portrait', cs: 'Portrét' },
        family: { en: 'Family', cs: 'Rodina' },
        business: { en: 'Business photography', cs: 'Firemní focení' },
        other: { en: 'Something else', cs: 'Něco jiného' },
      },
    }).label({ en: 'Type of shoot', cs: 'Typ focení' }),
    // The website shows a field's help inside it, as an example of what to write.
    date: f.text({ max: 200 }).optional().label({ en: 'Date', cs: 'Termín' }).help({ en: 'e.g. 12 June 2027', cs: 'např. 12. 6. 2027' }),
    message: f.text({ multiline: true, max: 5000 }).optional().label({ en: 'Message', cs: 'Zpráva' })
      .help({ en: 'Where you’d like the shoot, how many people and what you have in mind…', cs: 'Kde chcete fotit, kolik vás bude a jakou máte představu…' }),
  },
  submitLabel: { en: 'Send enquiry', cs: 'Odeslat poptávku' },
  successMessage: { en: 'Thank you. Your enquiry has been sent.', cs: 'Děkuji, poptávka je odeslaná.' },
})
export const FormSettings = defineFormSettings()
