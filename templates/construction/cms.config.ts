import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'
import { OWN_COLOR_FIELD } from 'tinyzoo-template-kit/looks'
import { kitEntryBlocks, kitSections } from 'tinyzoo-template-kit/sections'

// The content model of the Builders and architects template: what the firm can write and
// change. One model for all three looks (looks.ts): a look decides how a block is drawn, never
// what it holds. Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client`
// and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní. Vzhled Harmonogram ho vybarví barvou webu.',
  en: 'Text between *asterisks* stands out. The Schedule look sets it in the colour of the site.',
}

// ── the whole site: who, where, how to reach them ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The firm’s name, contact details, opening hours, company details, the look and the colours.', cs: 'Název firmy, kontakty, otevírací doba, firemní údaje, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'ownColor'] },
      { label: { en: 'Contact', cs: 'Kontakt' }, fields: ['phone', 'email', 'street', 'postcode', 'town', 'hours', 'hoursShort'] },
      { label: { en: 'Header', cs: 'Záhlaví' }, fields: ['ctaLabel', 'ctaUrl', 'menuNotes'] },
      { label: { en: 'Company details', cs: 'Firemní údaje' }, fields: ['legalName', 'companyId', 'vatId', 'registry'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the firm', cs: 'Název firmy' })
      .help({ en: 'The name in the header and the footer, for example “Novak Builders”.', cs: 'Název v záhlaví a v zápatí, například „Stavby Novák“.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own mark to show it beside the name in the header in place of the drawn one.', cs: 'Nahrajte vlastní značku a v záhlaví se zobrazí vedle názvu místo nakreslené.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    // The owner's own main colour: the palette of the chosen colours follows it (templates/kit/palette.ts).
    ownColor: f.color().optional().label(OWN_COLOR_FIELD.label).help(OWN_COLOR_FIELD.help),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' })
      .help({ en: 'The number in the header, the opening and the contacts, for example “123 456 701”.', cs: 'Číslo v záhlaví, v úvodu a v kontaktech, například „123 456 701“.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    street: f.text().optional().label({ en: 'Street and number', cs: 'Ulice a číslo' }),
    postcode: f.text().optional().label({ en: 'Postcode', cs: 'PSČ' }),
    town: f.text().optional().label({ en: 'Town', cs: 'Město' }),
    hours: f.list({
      fields: {
        days: f.text({ required: true }).label({ en: 'Days', cs: 'Dny' }).help({ en: 'For example “Mon–Thu”.', cs: 'Například „Po–čt“.' }),
        time: f.text({ required: true }).label({ en: 'Hours', cs: 'Hodiny' }).help({ en: 'For example “7.00–16.00”.', cs: 'Například „7.00–16.00“.' }),
      },
      max: 7, itemLabel: { en: 'Row', cs: 'Řádek' },
    }).label({ en: 'Opening hours', cs: 'Otevírací doba' })
      .help({ en: 'One row per group of days. They stand in the contacts at the end of the page.', cs: 'Jeden řádek na skupinu dní. Najdete je v kontaktech na konci stránky.' }),
    hoursShort: f.text().optional().label({ en: 'Opening hours in one line', cs: 'Otevírací doba v jednom řádku' })
      .help({ en: 'A short version for beside the phone number, for example “Mon–Thu 7–16, Fri 7–14”.', cs: 'Krátká verze k telefonnímu číslu, například „po–čt 7–16, pá 7–14“.' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    menuNotes: f.list({
      fields: {
        link: f.text({ required: true, format: 'link' }).label({ en: 'Menu link', cs: 'Odkaz v menu' }).help({ en: 'The same address the menu link has, for example /#realizace.', cs: 'Stejná adresa, jakou má odkaz v menu, například /#realizace.' }),
        note: f.text({ required: true }).label({ en: 'Note', cs: 'Poznámka' }).help({ en: 'For example “96 projects”.', cs: 'Například „96 staveb“.' }),
      },
      max: 8, itemLabel: { en: 'Note', cs: 'Poznámka' },
    }).label({ en: 'Notes in the phone menu', cs: 'Poznámky v menu na telefonu' })
      .help({ en: 'A small note beside a link in the full-screen menu of a phone. The Drawing and Schedule looks show them, Brickwork does not.', cs: 'Malá poznámka u odkazu v celoobrazovkovém menu na telefonu. Vzhledy Výkres a Harmonogram je ukážou, Zdivo ne.' }),
    legalName: f.text().optional().label({ en: 'Legal name', cs: 'Právní název' }).help({ en: 'For example “Novak Builders Ltd.”. It stands in the footer.', cs: 'Například „Stavby Novák s.r.o.“. Stojí v zápatí.' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    vatId: f.text().optional().label({ en: 'VAT number (DIČ)', cs: 'DIČ' }),
    registry: f.text({ multiline: true }).optional().label({ en: 'Entry in the register', cs: 'Zápis v rejstříku' })
      .help({ en: 'The sentence about the commercial register, under the name in the footer.', cs: 'Věta o zápisu v obchodním rejstříku, pod názvem v zápatí.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── the projects: finished ones and the ones under construction ──
export const Project = defineEntity('project', {
  label: { en: 'Projects', cs: 'Realizace' },
  labelSingular: { en: 'Project', cs: 'Realizace' },
  description: { en: 'Finished builds, each with a page of its own, and the builds you are working on now. Drag to put them in order.', cs: 'Hotové stavby, každá s vlastní stránkou, a stavby, které právě děláte. Pořadí změníte přetažením.' },
  icon: 'i-lucide-house',
  titleField: 'name',
  admin: { list: { columns: ['name', 'kind', 'state', 'year', 'featured', 'status'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }).help({ en: 'For example “House in Libice”.', cs: 'Například „Dům v Libici nad Doubravou“.' }),
    slug: f.slug({ from: 'name', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    state: f.select({
      options: ['done', 'building'] as const, default: 'done',
      labels: { done: { en: 'Finished', cs: 'Hotovo' }, building: { en: 'Under construction', cs: 'Právě se staví' } },
    }).label({ en: 'Progress', cs: 'Průběh' })
      .help({ en: 'A build under construction stands in the “Under construction” section with its progress; a finished one in the projects.', cs: 'Stavba, která se právě dělá, stojí v sekci „Právě stavíme“ s průběhem, hotová mezi realizacemi.' }),
    kind: f.select({
      options: ['new', 'renovation', 'extension', 'roof'] as const, default: 'new',
      labels: { new: { en: 'New build', cs: 'Novostavba' }, renovation: { en: 'Renovation', cs: 'Rekonstrukce' }, extension: { en: 'Extension', cs: 'Přístavba' }, roof: { en: 'Roof', cs: 'Střecha' } },
    }).label({ en: 'Kind of job', cs: 'Druh stavby' }).help({ en: 'Visitors filter the projects by it.', cs: 'Podle něj návštěvníci třídí realizace.' }),
    place: f.text().optional().label({ en: 'Village or town', cs: 'Obec' }),
    year: f.number({ int: true, min: 1900, max: 2100 }).optional().label({ en: 'Year finished', cs: 'Rok dokončení' }),
    area: f.number({ int: true, min: 0 }).optional().label({ en: 'Area in m²', cs: 'Plocha v m²' }),
    areaMeasure: f.select({
      options: ['usable', 'roof'] as const, default: 'usable',
      labels: { usable: { en: 'Usable floor area', cs: 'Užitná plocha' }, roof: { en: 'Roof area', cs: 'Plocha střechy' } },
    }).label({ en: 'What the area measures', cs: 'Co plocha měří' }),
    layout: f.text().optional().label({ en: 'Layout, in a few words', cs: 'Dispozice, pár slovy' })
      .help({ en: 'For example “4+kk · single-storey”. The Drawing look sets it beside the area under the photo.', cs: 'Například „4+kk · přízemní“. Vzhled Výkres ji napíše vedle plochy pod fotografii.' }),
    weeks: f.number({ int: true, min: 1 }).optional().label({ en: 'Length of the build in weeks', cs: 'Délka stavby v týdnech' })
      .help({ en: 'Shown as weeks up to eight of them, as months above. The Schedule look draws it as a bar. For a build under construction this is its planned length.', cs: 'Do osmi týdnů se napíše v týdnech, delší v měsících. Vzhled Harmonogram ji nakreslí jako pruh. U stavby, která se právě dělá, je to plánovaná délka.' }),
    contractWeeks: f.number({ int: true, min: 1 }).optional().label({ en: 'Length in the contract, in weeks', cs: 'Délka ve smlouvě v týdnech' })
      .help({ en: 'Optional. The Schedule look sets it beside the real length as two bars.', cs: 'Volitelné. Vzhled Harmonogram ji vedle skutečné délky nakreslí jako dva pruhy.' }),
    system: f.select({
      options: ['masonry', 'timber', 'other'] as const, default: 'masonry',
      labels: { masonry: { en: 'Masonry', cs: 'Zděný' }, timber: { en: 'Timber frame', cs: 'Dřevostavba' }, other: { en: 'Other (the note below says what)', cs: 'Jiný (zapíšete níže)' } },
    }).label({ en: 'Construction system', cs: 'Konstrukční systém' }),
    systemNote: f.text().optional().label({ en: 'Note to the system', cs: 'Poznámka k systému' })
      .help({ en: 'For example “brick 44 cm”. With “Other” it is the system’s name, for example “new roof truss”.', cs: 'Například „cihla 44 cm“. U systému „Jiný“ je to jeho název, například „nový krov“.' }),
    priceFrom: f.number({ int: true, min: 0 }).optional().label({ en: 'Price from, in Kč', cs: 'Cena od v Kč' }),
    priceTo: f.number({ int: true, min: 0 }).optional().label({ en: 'Price to, in Kč', cs: 'Cena do v Kč' })
      .help({ en: 'Leave both empty to show no price. Millions are written as “6.6–7 mil. Kč”.', cs: 'Obě pole nechte prázdná, a cena se nezobrazí. Miliony se napíšou jako „6,6–7 mil. Kč“.' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' })
      .help({ en: 'A paragraph about the build: what was built, how it went. It stands on the project’s page and beside the project highlighted on the home page.', cs: 'Odstavec o stavbě: co se stavělo a jak to šlo. Stojí na stránce stavby a u stavby vybrané na úvod.' }),
    parameters: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Parameter', cs: 'Parametr' }).help({ en: 'For example “Heating”.', cs: 'Například „Vytápění“.' }),
        value: f.text({ required: true }).label({ en: 'Value', cs: 'Hodnota' }).help({ en: 'For example “heat pump, underfloor”.', cs: 'Například „tepelné čerpadlo, podlahové“.' }),
      },
      max: 12, itemLabel: { en: 'Parameter', cs: 'Parametr' },
    }).label({ en: 'More parameters', cs: 'Další parametry' })
      .help({ en: 'They follow the year, the area, the length, the system and the price in the table of the project.', cs: 'Následují po roce, ploše, délce, systému a ceně v tabulce o stavbě.' }),
    photos: f.gallery({ accept: 'image/*', max: 60 }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'The first is the photo of the card. The home page shows the second and the third beside it when the project is highlighted. Drag to change the order; the caption is written under the photo.', cs: 'První je fotografie na kartě. Když je stavba vybraná na úvod, vedle ní se ukážou druhá a třetí. Pořadí změníte přetažením, popisek se napíše pod fotografii.' }),
    quote: f.text({ multiline: true }).optional().label({ en: 'Words of the client', cs: 'Věta klienta' }),
    quoteAuthor: f.text().optional().label({ en: 'Who said it', cs: 'Kdo to řekl' }),
    quotePlace: f.text().optional().label({ en: 'Where they live', cs: 'Kde bydlí' }),
    featured: f.boolean().label({ en: 'Highlight on the home page', cs: 'Vybrat na úvod' })
      .help({ en: 'The first highlighted finished project stands large in the “Projects” section. Turn it on for one.', cs: 'První vybraná hotová stavba stojí v sekci „Realizace“ velká. Zapněte ji u jedné.' }),
    startDate: f.datetime({ allDay: true }).optional().label({ en: 'Start of the build', cs: 'Zahájení stavby' })
      .help({ en: 'For a build under construction. The week it is in is counted from this day.', cs: 'U stavby, která se právě dělá. Od tohoto dne se počítá, v kterém týdnu je.' }),
    currentStage: f.text().optional().label({ en: 'Stage it is in', cs: 'Etapa, ve které je' }).help({ en: 'For example “shell”.', cs: 'Například „hrubá stavba“.' }),
    handoverDate: f.datetime({ allDay: true }).optional().label({ en: 'Handover by the contract', cs: 'Předání podle smlouvy' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
    ...seo(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/realizace/:slug' },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: '/realizace/:slug',
    populate: ['photos', 'ogImage'],
  },
})

// ── what the firm builds, and what is in the price ──
export const Service = defineEntity('service', {
  label: { en: 'Services', cs: 'Služby' },
  labelSingular: { en: 'Service', cs: 'Služba' },
  description: { en: 'Each kind of work with what is in the price and what is not. Drag to put them in order.', cs: 'Každý druh práce s tím, co je a co není v ceně. Pořadí změníte přetažením.' },
  icon: 'i-lucide-hammer',
  titleField: 'name',
  admin: { list: { columns: ['name', 'price', 'unit'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Krátký text' }),
    included: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Item', cs: 'Položka' }) },
      max: 12, itemLabel: { en: 'Item', cs: 'Položka' },
    }).label({ en: 'In the price', cs: 'V ceně' }),
    excluded: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Item', cs: 'Položka' }) },
      max: 12, itemLabel: { en: 'Item', cs: 'Položka' },
    }).label({ en: 'Not in the price', cs: 'Není v ceně' }),
    price: f.text().optional().label({ en: 'Price', cs: 'Cena' })
      .help({ en: 'For example “52 000 Kč” or “after a survey”. Drawing writes it large with the unit under it; Schedule and Brickwork write “from” in front of it in one line, so put “from” in it if you want it.', cs: 'Například „52 000 Kč“ nebo „po průzkumu“. Výkres ji napíše velkým písmem s jednotkou pod ní, Harmonogram a Zdivo ji napíšou v jednom řádku s jednotkou za ní. Slovo „od“ si do ní napište sami.' }),
    unit: f.text().optional().label({ en: 'What the price is for', cs: 'Za co cena platí' }).help({ en: 'For example “per m² of floor area”.', cs: 'Například „za m² užitné plochy“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the people ──
export const Person = defineEntity('person', {
  label: { en: 'People', cs: 'Lidé' },
  labelSingular: { en: 'Person', cs: 'Člověk' },
  description: { en: 'The owner and the site managers: the people a client talks to. The first one is the owner.', cs: 'Majitel a stavbyvedoucí: lidé, se kterými klient mluví. První je majitel.' },
  icon: 'i-lucide-hard-hat',
  titleField: 'name',
  admin: { list: { columns: ['name', 'role', 'phone'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    role: f.text().optional().label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “Site manager, new builds”.', cs: 'Například „Stavbyvedoucí, novostavby“.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' }).help({ en: 'A portrait works best.', cs: 'Nejlépe na výšku.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }).help({ en: 'One or two sentences.', cs: 'Jedna až dvě věty.' }),
    phone: f.text().optional().label({ en: 'Direct phone', cs: 'Přímý telefon' }).help({ en: 'The Schedule look shows it under each person.', cs: 'Vzhled Harmonogram ho ukáže pod každým člověkem.' }),
    quote: f.text({ multiline: true }).optional().label({ en: 'Words in the first person', cs: 'Věta v první osobě' }).help({ en: 'The Brickwork look sets the first person’s words large beside the portrait.', cs: 'Vzhled Zdivo napíše větu prvního člověka velkým písmem vedle portrétu.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo'] },
})

// ── what clients say ──
export const Testimonial = defineEntity('testimonial', {
  label: { en: 'Clients’ words', cs: 'Reference' },
  labelSingular: { en: 'Reference', cs: 'Reference' },
  description: { en: 'What people who live in your houses say. The first one stands largest.', cs: 'Co říkají lidé, kteří bydlí ve vašich domech. První stojí největší.' },
  icon: 'i-lucide-quote',
  titleField: 'name',
  admin: { list: { columns: ['name', 'place', 'built'], orderField: 'position' } },
  fields: {
    text: f.text({ required: true, multiline: true }).label({ en: 'Words', cs: 'Text' }),
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    place: f.text().optional().label({ en: 'Village or town', cs: 'Obec' }),
    built: f.text().optional().label({ en: 'What was built', cs: 'Co se stavělo' }).help({ en: 'For example “timber house 2024”.', cs: 'Například „dřevostavba 2024“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── where the firm builds ──
export const Town = defineEntity('town', {
  label: { en: 'Area', cs: 'Oblast' },
  labelSingular: { en: 'Town', cs: 'Město' },
  description: { en: 'The towns you build in, with their distance. The seat of the firm comes first.', cs: 'Města, kde stavíte, se vzdáleností. Sídlo firmy je první.' },
  icon: 'i-lucide-map-pin',
  titleField: 'name',
  admin: { list: { columns: ['name', 'km', 'seat'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    shortName: f.text().optional().label({ en: 'Short name', cs: 'Zkrácený název' }).help({ en: 'For example “Havl. Brod”. The Brickwork look writes the towns on narrow bricks; without a short name it takes the name.', cs: 'Například „Havl. Brod“. Vzhled Zdivo píše města na úzké cihly; bez zkráceného názvu vezme název.' }),
    km: f.number({ int: true, min: 0 }).label({ en: 'Distance in km', cs: 'Vzdálenost v km' }),
    seat: f.boolean().label({ en: 'Seat of the firm', cs: 'Sídlo firmy' }).help({ en: 'It shows the note below instead of the distance.', cs: 'Místo vzdálenosti ukáže poznámku níže.' }),
    note: f.text().optional().label({ en: 'Note', cs: 'Poznámka' }).help({ en: 'For the seat, for example “we are based here”.', cs: 'U sídla, například „tady sídlíme“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).optional().label({ en, cs })

const hero = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'What the firm does, in one sentence, a photograph and the way to an enquiry. The phone number and the hours come from Site settings.', cs: 'Čím se firma zabývá jednou větou, fotografie a cesta k poptávce. Telefon a hodiny se berou z Nastavení webu.' },
  icon: 'i-lucide-house',
  fields: {
    eyebrow: eyebrow().help({ en: 'For example “Builders · Chotěboř · since 2008”.', cs: 'Například „Stavební firma · Chotěboř · od roku 2008“.' }),
    heading: heading(),
    lead: f.text({ multiline: true }).label({ en: 'Large sentence', cs: 'Velká věta' })
      .help({ en: 'The Schedule look sets it large under the heading; the other looks write it as a paragraph before the text.', cs: 'Vzhled Harmonogram ji napíše velkým písmem pod nadpis, ostatní vzhledy jako odstavec před textem.' }),
    text: text(),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
    caption: f.text().label({ en: 'Caption', cs: 'Popisek' })
      .help({ en: 'Written with the photo: Drawing under it as a dimension line, Schedule on its corner, Brickwork over its corner.', cs: 'Napíše se k fotografii: Výkres pod ni jako kótu, Harmonogram do jejího rohu, Zdivo přes její roh.' }),
    captionShort: f.text().label({ en: 'Caption on a phone', cs: 'Popisek na telefonu' })
      .help({ en: 'A shorter caption for the Drawing look on a narrow screen. Leave it empty to use the caption.', cs: 'Kratší popisek pro vzhled Výkres na úzké obrazovce. Když ho nevyplníte, použije se popisek.' }),
    note: f.text().label({ en: 'Note beside the photo', cs: 'Poznámka u fotografie' })
      .help({ en: 'Only the Drawing look writes it, upright beside the photo as a dimension, for example “10 months of building”.', cs: 'Napíše ji jen vzhled Výkres, svisle vedle fotografie jako kótu, například „10 měsíců stavby“.' }),
  },
})

const facts = defineBlock({
  label: { en: 'Facts', cs: 'Fakta' },
  description: { en: 'Four to seven figures a client asks about: the guarantee, the crews, the insurance. Drawing sets them as the title block of a drawing, Schedule on a light slab, Brickwork as bricks.', cs: 'Čtyři až sedm čísel, na která se klient ptá: záruka, čety, pojištění. Výkres je sází jako popisové pole výkresu, Harmonogram na světlou desku, Zdivo jako cihly.' },
  icon: 'i-lucide-list-checks',
  fields: {
    heading: heading(false).help({ en: 'Optional. Schedule opens its slab with it; the other looks write it above the facts.', cs: 'Volitelný. Harmonogram jím otevírá světlou desku, ostatní vzhledy ho napíšou nad fakta.' }),
    text: text(),
    items: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Label', cs: 'Označení' }).help({ en: 'For example “Guarantee”. Brickwork does not write it.', cs: 'Například „Záruka“. Zdivo ho nepíše.' }),
        figure: f.text({ required: true }).label({ en: 'Figure', cs: 'Číslo' }).help({ en: 'For example “5 years”.', cs: 'Například „5 let“.' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 8, itemLabel: { en: 'Fact', cs: 'Fakt' },
    }).label({ en: 'Facts', cs: 'Fakta' }),
    ctaLabel: f.text().label({ en: 'Brick with a link: text', cs: 'Cihla s odkazem: text' })
      .help({ en: 'Only Brickwork writes it, as a dark brick among the facts, for example “Offer in 3 weeks”.', cs: 'Napíše ji jen Zdivo, jako tmavou cihlu mezi fakty, například „Nabídka do 3 týdnů“.' }),
    ctaUrl: link('Brick with a link: destination', 'Cihla s odkazem: cíl'),
  },
})

const building = defineBlock({
  label: { en: 'Under construction', cs: 'Právě stavíme' },
  description: { en: 'The projects marked “Under construction”, each with the week it is in and the handover date from the contract.', cs: 'Stavby označené „Právě se staví“ s týdnem, ve kterém jsou, a termínem předání ze smlouvy.' },
  icon: 'i-lucide-hard-hat',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
  },
})

const projects = defineBlock({
  label: { en: 'Projects', cs: 'Realizace' },
  description: { en: 'The finished projects: one large, the others as cards with a filter by kind. Each has a page of its own.', cs: 'Hotové stavby: jedna velká, ostatní jako karty s filtrem podle druhu. Každá má vlastní stránku.' },
  icon: 'i-lucide-images',
  fields: {
    eyebrow: eyebrow().help({ en: 'For example “96 houses and 240 renovations and roofs since 2008”.', cs: 'Například „96 domů a 240 rekonstrukcí a střech od roku 2008“.' }),
    heading: heading(),
    text: text(),
    showFeatured: f.boolean({ default: true }).label({ en: 'Show the highlighted project large', cs: 'Ukázat vybranou stavbu velkou' })
      .help({ en: 'The project marked “Highlight on the home page”. Turn it off on a page that lists all projects.', cs: 'Stavba označená „Vybrat na úvod“. Na stránce, která ukazuje všechny stavby, ji vypněte.' }),
    featuredLabel: f.text().label({ en: 'Line above the highlighted project', cs: 'Řádek nad vybranou stavbou' }).help({ en: 'For example “Last handed over”. The kind of job follows it.', cs: 'Například „Naposledy předáno“. Za ním následuje druh stavby.' }),
    moreHeading: f.text().label({ en: 'Heading of the other projects', cs: 'Nadpis ostatních staveb' }).help({ en: 'For example “More builds”. Leave it empty to write none.', cs: 'Například „Další stavby“. Když ho nevyplníte, nenapíše se žádný.' }),
    limit: f.number({ int: true, min: 0 }).optional().label({ en: 'How many other projects', cs: 'Kolik dalších staveb' })
      .help({ en: 'Leave it empty to show all of them, as a page that lists the whole archive does.', cs: 'Když pole nevyplníte, ukážou se všechny, jako na stránce s celým archivem.' }),
    filter: f.boolean({ default: true }).label({ en: 'Filter by kind', cs: 'Filtr podle druhu' }),
    archiveLabel: f.text().label({ en: 'Link to the archive: text', cs: 'Odkaz na archiv: text' }).help({ en: 'For example “Browse the archive”.', cs: 'Například „Projít archiv“.' }),
    archiveTitle: f.text({ multiline: true }).label({ en: 'Link to the archive: large words', cs: 'Odkaz na archiv: velká slova' })
      .help({ en: 'For example “All 96 houses”. Line breaks stay where you put them. Drawing and Schedule set it large on a tile among the cards, Brickwork in a link under the cards on a phone.', cs: 'Například „Všech 96 domů“. Konce řádků zůstanou tam, kam je dáte. Výkres a Harmonogram je napíšou velké na dlaždici mezi kartami, Zdivo v odkazu pod kartami na telefonu.' }),
    archiveUrl: link('Link to the archive: destination', 'Odkaz na archiv: cíl'),
    figure: f.text().label({ en: 'Brick with a figure: the figure', cs: 'Cihla s číslem: číslo' }).help({ en: 'Only Brickwork writes it, for example “96”.', cs: 'Napíše ji jen Zdivo, například „96“.' }),
    figureText: f.text().label({ en: 'Brick with a figure: words', cs: 'Cihla s číslem: slova' }).help({ en: 'For example “houses handed over since 2008”.', cs: 'Například „domů jsme předali od roku 2008“.' }),
    scaleWeeks: f.number({ int: true, min: 1 }).optional().label({ en: 'Scale of the bars in weeks', cs: 'Stupnice pruhů v týdnech' })
      .help({ en: 'Only Schedule draws the bars; they all share this scale so a roof and a house can be compared. Empty means 48.', cs: 'Pruhy kreslí jen Harmonogram; všechny mají stejnou stupnici, takže lze porovnat střechu a dům. Prázdné pole znamená 48.' }),
  },
})

const services = defineBlock({
  label: { en: 'Services and prices', cs: 'Služby a ceny' },
  description: { en: 'The services of the Services section, each with what is in the price and what is not.', cs: 'Služby ze sekce Služby, každá s tím, co je a co není v ceně.' },
  icon: 'i-lucide-hammer',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    note: f.text().label({ en: 'Note under the services', cs: 'Poznámka pod službami' }).help({ en: 'For example “Prices are without VAT”.', cs: 'Například „Ceny jsou bez DPH“.' }),
  },
})

const process = defineBlock({
  label: { en: 'How a build goes', cs: 'Jak stavba probíhá' },
  description: { en: 'The steps before the build, the stages of it with their lengths in weeks, and the steps after. Drawing sets them as dimension lines and a section of a house, Schedule as bars on a week grid, Brickwork as a house that grows from the footing up.', cs: 'Kroky před stavbou, etapy stavby s délkou v týdnech a kroky po ní. Výkres je sází jako kóty a řez domem, Harmonogram jako pruhy na týdenní mřížce, Zdivo jako dům, který roste od základů.' },
  icon: 'i-lucide-calendar-range',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    steps: f.list({
      fields: {
        phase: f.select({
          options: ['before', 'build', 'after'] as const, default: 'build',
          labels: { before: { en: 'Before the build', cs: 'Před stavbou' }, build: { en: 'The build', cs: 'Stavba' }, after: { en: 'After the build', cs: 'Po stavbě' } },
        }).label({ en: 'When', cs: 'Kdy' }),
        name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
        duration: f.text().label({ en: 'Time it takes, in words', cs: 'Doba trvání slovy' })
          .help({ en: 'For example “within 7 days”. A stage of the build gets its length from the weeks below when this is empty.', cs: 'Například „do 7 dnů“. Etapa stavby, u které je pole prázdné, vezme délku z týdnů níže.' }),
        weeks: f.number({ int: true, min: 0 }).optional().label({ en: 'Weeks (stages of the build)', cs: 'Týdny (etapy stavby)' })
          .help({ en: 'The stages of the build are laid one after another; their weeks add up to the length of the whole build.', cs: 'Etapy stavby se kladou za sebou; jejich týdny se sčítají do délky celé stavby.' }),
        payment: f.number({ int: true, min: 0, max: 100 }).optional().label({ en: 'Payment after it, in %', cs: 'Platba po ní v %' })
          .help({ en: 'Schedule marks it on the grid at the end of the stage.', cs: 'Harmonogram ji označí na mřížce na konci etapy.' }),
      },
      max: 24, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'Steps', cs: 'Kroky' })
      .help({ en: 'In order. After the build, Brickwork draws the first step as the handover and the last as the roof of the house.', cs: 'Popořadě. Po stavbě Zdivo nakreslí první krok jako předání a poslední jako střechu domu.' }),
    totalLabel: f.text().label({ en: 'Words after the total length', cs: 'Slova za celkovou délkou' }).help({ en: 'For example “from the digging to the final approval”, after “38 weeks”.', cs: 'Například „od výkopů po kolaudaci“, za „38 týdnů“.' }),
    inspectionEvery: f.number({ int: true, min: 1 }).optional().label({ en: 'Inspection every … weeks', cs: 'Kontrolní den každých … týdnů' })
      .help({ en: 'Schedule marks the days on the grid.', cs: 'Harmonogram dny označí na mřížce.' }),
    inspectionTitle: f.text().label({ en: 'Inspections: title', cs: 'Kontrolní dny: nadpis' }),
    inspectionText: f.text({ multiline: true }).label({ en: 'Inspections: text', cs: 'Kontrolní dny: text' }),
    paymentsTitle: f.text().label({ en: 'Payments: title', cs: 'Platby: nadpis' }),
    paymentsText: f.text({ multiline: true }).label({ en: 'Payments: text', cs: 'Platby: text' }),
  },
})

const team = defineBlock({
  label: { en: 'People', cs: 'Lidé' },
  description: { en: 'The people of the People section, each with a photograph and a few words.', cs: 'Lidé ze sekce Lidé, každý s fotografií a pár slovy.' },
  icon: 'i-lucide-hard-hat',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    note: f.text({ multiline: true }).label({ en: 'About the rest of the crew', cs: 'O ostatních z party' })
      .help({ en: 'For example “And twelve more you meet on the site”. Brickwork sets it on its own brick.', cs: 'Například „A dalších dvanáct, které potkáte na stavbě“. Zdivo ji napíše na vlastní cihlu.' }),
  },
})

const testimonials = defineBlock({
  label: { en: 'Clients’ words', cs: 'Reference' },
  description: { en: 'The words from the Clients’ words section. The first stands largest.', cs: 'Slova ze sekce Reference. První stojí největší.' },
  icon: 'i-lucide-quote',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
  },
})

const enquiry = defineBlock({
  label: { en: 'Enquiry form', cs: 'Poptávkový formulář' },
  description: { en: 'What happens after an enquiry, the phone number and the form. The enquiries arrive in the admin.', cs: 'Co se stane po poptávce, telefon a formulář. Poptávky najdete v administraci.' },
  icon: 'i-lucide-mail',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    steps: f.list({
      fields: {
        text: f.text({ required: true }).label({ en: 'What happens', cs: 'Co se stane' }),
        when: f.text({ required: true }).label({ en: 'When', cs: 'Kdy' }).help({ en: 'For example “within 2 days”.', cs: 'Například „do 2 dnů“.' }),
      },
      max: 5, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'What happens next', cs: 'Co bude po odeslání' }),
    callLabel: f.text().label({ en: 'Line above the phone number', cs: 'Řádek nad telefonem' }).help({ en: 'For example “Rather call?”.', cs: 'Například „Raději zavoláte?“.' }),
    signature: f.text().label({ en: 'Signature', cs: 'Podpis' }).help({ en: 'Only Brickwork writes it, in italics under the text, for example the owner’s name.', cs: 'Napíše ji jen Zdivo, kurzivou pod text, například jméno majitele.' }),
    consent: f.text().label({ en: 'Sentence under the form', cs: 'Věta pod formulářem' }),
    kinds: f.list({
      fields: { name: f.text({ required: true }).label({ en: 'Kind of work', cs: 'Druh práce' }) },
      max: 10, itemLabel: { en: 'Kind of work', cs: 'Druh práce' },
    }).label({ en: 'What they can choose to build', cs: 'Co mohou chtít stavět' })
      .help({ en: 'Leave the list empty and the form does not ask.', cs: 'Když seznam necháte prázdný, formulář se neptá.' }),
    starts: f.list({
      fields: { name: f.text({ required: true }).label({ en: 'Time', cs: 'Doba' }) },
      max: 8, itemLabel: { en: 'Time', cs: 'Doba' },
    }).label({ en: 'When they can choose to start', cs: 'Kdy mohou chtít začít' })
      .help({ en: 'For example “In spring 2027”. Leave the list empty and the form does not ask.', cs: 'Například „Na jaře 2027“. Když seznam necháte prázdný, formulář se neptá.' }),
  },
})

const contact = defineBlock({
  label: { en: 'Contact and area', cs: 'Kontakt a oblast' },
  description: { en: 'The office from Site settings and the towns you build in, from the Area section.', cs: 'Kancelář z Nastavení webu a města, kde stavíte, ze sekce Oblast.' },
  icon: 'i-lucide-map-pin',
  fields: {
    officeEyebrow: f.text().label({ en: 'Office: line above the heading', cs: 'Kancelář: řádek nad nadpisem' }),
    officeHeading: f.text({ required: true }).label({ en: 'Office: heading', cs: 'Kancelář: nadpis' })
      .help({ en: 'For example “Where to find us”. Schedule sets the address in its place; if you write the street here, it does not repeat it below.', cs: 'Například „Kde nás najdete“. Harmonogram na jeho místo napíše adresu; když sem napíšete ulici, nezopakuje ji níže.' }),
    officeNote: f.text({ multiline: true }).label({ en: 'Office: note', cs: 'Kancelář: poznámka' }),
    regionEyebrow: f.text().label({ en: 'Area: line above the heading', cs: 'Oblast: řádek nad nadpisem' }),
    regionHeading: f.text({ required: true }).label({ en: 'Area: heading', cs: 'Oblast: nadpis' }),
    regionText: f.text({ multiline: true }).label({ en: 'Area: text', cs: 'Oblast: text' }),
    otherPlaces: f.text({ multiline: true }).label({ en: 'Other villages', cs: 'Další obce' }).help({ en: 'A sentence about the villages between the towns.', cs: 'Věta o obcích mezi městy.' }),
    rangeKm: f.number({ int: true, min: 1 }).optional().label({ en: 'How far you go, in km', cs: 'Jak daleko jezdíte, v km' })
      .help({ en: 'The end of the scale on which the towns stand. Empty means the farthest town.', cs: 'Konec stupnice, na které stojí města. Prázdné pole znamená nejvzdálenější město.' }),
  },
})

const richText = defineBlock({
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
  blocks: { hero, facts, building, projects, services, process, team, testimonials, enquiry, contact, text: richText, ...kitEntryBlocks(), ...kitSections() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    legal: { en: 'Links in the footer', cs: 'Odkazy v zápatí' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the enquiries of the form below
]

// ── the enquiry form ──
// The website draws it per look (the kit's useSiteForm). Two of its questions are worded by the
// firm in the "Enquiry form" block: what to build and when to start.
export const Enquiry = defineForm('enquiry', {
  label: { en: 'Enquiries', cs: 'Poptávky' },
  labelSingular: { en: 'Enquiry', cs: 'Poptávka' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    phone: f.text({ required: true, max: 60 }).label({ en: 'Phone', cs: 'Telefon' }),
    email: f.text({ max: 200 }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    place: f.text({ max: 200 }).optional().label({ en: 'Place of the build (village)', cs: 'Místo stavby (obec)' }).help({ en: 'e.g. Maleč', cs: 'např. Maleč' }),
    kind: f.text({ max: 200 }).optional().label({ en: 'What to build', cs: 'Co chcete stavět' }),
    start: f.text({ max: 200 }).optional().label({ en: 'When to start', cs: 'Kdy chcete začít' }),
    permit: f.select({
      options: ['both', 'project', 'none'] as const, default: 'both',
      labels: { both: { en: 'I have the project and the permit', cs: 'Mám projekt i povolení' }, project: { en: 'I have only the project', cs: 'Mám jen projekt' }, none: { en: 'I have nothing yet', cs: 'Zatím nemám nic' } },
    }).label({ en: 'Project and building permit', cs: 'Projekt a stavební povolení' }),
    message: f.text({ multiline: true, max: 5000 }).optional().label({ en: 'Message', cs: 'Zpráva' })
      .help({ en: 'Size of the house, the plot, what you already have…', cs: 'Velikost domu, pozemek, co už máte hotové…' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send enquiry', cs: 'Odeslat poptávku' },
  successMessage: { en: 'Thank you, we have your enquiry. We will call you within two working days.', cs: 'Děkujeme, poptávku máme. Zavoláme vám do dvou pracovních dnů.' },
})
export const FormSettings = defineFormSettings()
