import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Office template: what a small professional office (accountants, a
// law firm, architects) can write and change. One model for both looks (looks.ts): a look
// decides how a block is drawn, never what it holds. Change it here, then `pnpm db:generate`
// (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní: Šanony ho vybarví, Lhůty ho napíšou kurzivou.',
  en: 'Text between *asterisks* stands out: Binders colours it, Deadlines sets it in italics.',
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

// ── the whole office: name, contact, hours, the details a firm has to show ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The name of your office, its look and colours, contact details, office hours and company details.', cs: 'Název kanceláře, vzhled a barvy webu, kontakty, úřední hodiny a údaje o firmě.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'tagline', 'look', 'colors'] },
      { label: { en: 'Header', cs: 'Záhlaví' }, fields: ['ctaLabel', 'ctaLongLabel', 'ctaUrl'] },
      { label: { en: 'Contact details', cs: 'Kontakty' }, fields: ['phone', 'email', 'street', 'zip', 'city', 'addressNote'] },
      { label: { en: 'Office hours', cs: 'Úřední hodiny' }, fields: ['hours'] },
      { label: { en: 'Company details', cs: 'Údaje o firmě' }, fields: ['legalName', 'about', 'companyId', 'taxId', 'register', 'membership', 'insurance'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the office', cs: 'Název kanceláře' })
      .help({ en: 'Written in the header and the footer. Two names joined by “&” (“Tesař & Vondrová”) get the “&” in the brand colour in Binders.', cs: 'Píše se v záhlaví a v zápatí. Dvě jména spojená znakem „&“ (Tesař & Vondrová) dostanou ve vzhledu Šanony znak „&“ v barvě značky.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Deadlines shows it in place of the small ruler mark before the name, Binders in place of the name.', cs: 'Lhůty ho ukážou místo malého pravítka před názvem, Šanony místo názvu.' }),
    tagline: f.text().optional().label({ en: 'Line under the name', cs: 'Řádek pod názvem' })
      .help({ en: 'For example “taxes · accounts · payroll”. Deadlines sets it small under the name, Binders beside it (not on a phone).', cs: 'Například „daně · účetnictví · mzdy“. Lhůty ho napíšou drobně pod název, Šanony vedle něj (ne na telefonu).' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaLongLabel: f.text().optional().label({ en: 'Button text in the phone menu', cs: 'Text tlačítka v mobilním menu' })
      .help({ en: 'The phone has room for a longer sentence. Left empty, the header button’s text is used.', cs: 'Na telefonu je místo na delší větu. Když pole necháte prázdné, použije se text z tlačítka v záhlaví.' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' })
      .help({ en: 'Written in the header, the contact section and the footer; a tap on a phone calls it.', cs: 'Píše se v záhlaví, v kontaktu a v zápatí; klepnutí na telefonu zavolá.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    street: f.text().optional().label({ en: 'Street and number', cs: 'Ulice a číslo' }).help({ en: 'For example “Husova 28”.', cs: 'Například „Husova 28“.' }),
    zip: f.text().optional().label({ en: 'Postcode', cs: 'PSČ' }),
    city: f.text().optional().label({ en: 'Town', cs: 'Město' }),
    addressNote: f.text().optional().label({ en: 'How to find the door', cs: 'Jak najít dveře' })
      .help({ en: 'For example “first floor, green door next to the passage”. Deadlines writes it under the address.', cs: 'Například „první patro, zelené dveře vedle průjezdu“. Lhůty ho napíšou pod adresu.' }),
    hours: f.list({
      fields: {
        day: f.select({
          options: DAYS, default: 'mon',
          labels: {
            mon: { en: 'Monday', cs: 'Pondělí' }, tue: { en: 'Tuesday', cs: 'Úterý' }, wed: { en: 'Wednesday', cs: 'Středa' }, thu: { en: 'Thursday', cs: 'Čtvrtek' },
            fri: { en: 'Friday', cs: 'Pátek' }, sat: { en: 'Saturday', cs: 'Sobota' }, sun: { en: 'Sunday', cs: 'Neděle' },
          },
        }).label({ en: 'Day', cs: 'Den' }),
        from: f.text({ required: true }).label({ en: 'From', cs: 'Od' }).help({ en: 'For example “8:00”.', cs: 'Například „8:00“.' }),
        to: f.text({ required: true }).label({ en: 'To', cs: 'Do' }).help({ en: 'For example “16:30”.', cs: 'Například „16:30“.' }),
      },
      max: 7, itemLabel: { en: 'Day', cs: 'Den' },
    }).label({ en: 'Office hours', cs: 'Úřední hodiny' })
      .help({ en: 'One line per day you are open; leave out days you are closed. Deadlines draws a bar on a 7 to 18 scale for each day, Binders joins days with the same hours (“Mon–Thu”).', cs: 'Jeden řádek na každý den, kdy máte otevřeno; zavřené dny vynechejte. Lhůty nakreslí ke každému dni pruh na stupnici od 7 do 18 hodin, Šanony spojí dny se stejnou dobou („po–čt“).' }),
    legalName: f.text().optional().label({ en: 'Full name of the company', cs: 'Celý název firmy' })
      .help({ en: 'For the line at the very bottom, for example “Tesař & Vondrová, tax and accounting office s.r.o.”.', cs: 'Do řádku úplně dole, například „Tesař & Vondrová, daňová a účetní kancelář s.r.o.“.' }),
    about: f.text({ multiline: true }).optional().label({ en: 'Short description for the footer', cs: 'Krátký popis do zápatí' })
      .help({ en: 'Only Deadlines shows it, under the name in the footer.', cs: 'Ukážou ho jen Lhůty, pod názvem v zápatí.' }),
    companyId: f.text().optional().label({ en: 'Company number', cs: 'IČO' }),
    taxId: f.text().optional().label({ en: 'VAT number', cs: 'DIČ' }),
    register: f.text().optional().label({ en: 'Commercial register entry', cs: 'Spisová značka' })
      .help({ en: 'For example “C 106542, Regional Court in Brno”.', cs: 'Například „C 106542, Krajský soud v Brně“.' }),
    membership: f.text({ multiline: true }).optional().label({ en: 'Chamber membership', cs: 'Členství v komoře' })
      .help({ en: 'Who is registered with which professional chamber, with their numbers. A chamber of accountants, lawyers or architects is required to be shown on the website.', cs: 'Kdo je zapsán v které profesní komoře, s čísly. Komoru účetních, advokátů nebo architektů je potřeba na webu uvést.' }),
    insurance: f.text().optional().label({ en: 'Insurance', cs: 'Pojištění' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── the groups the price list is divided into ──
export const ServiceGroup = defineEntity('serviceGroup', {
  label: { en: 'Service groups', cs: 'Skupiny služeb' },
  labelSingular: { en: 'Service group', cs: 'Skupina služeb' },
  description: { en: 'The price list is divided into groups, each with a note on how it is charged. Drag to put them in order.', cs: 'Ceník se dělí do skupin, každá s poznámkou, jak se účtuje. Pořadí změníte přetažením.' },
  icon: 'i-lucide-folders',
  titleField: 'name',
  admin: { list: { columns: ['name', 'note'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    note: f.text().optional().label({ en: 'How it is charged', cs: 'Jak se účtuje' })
      .help({ en: 'For example “monthly flat fee by the number of documents”.', cs: 'Například „měsíční paušál podle počtu dokladů“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the services with their prices ──
export const Service = defineEntity('service', {
  label: { en: 'Services', cs: 'Služby' },
  labelSingular: { en: 'Service', cs: 'Služba' },
  description: { en: 'What you do and what it costs. Binders also shows each service as a spine on a shelf in the opening. Drag to put them in order.', cs: 'Co děláte a kolik to stojí. Šanony ukážou každou službu i jako hřbet šanonu na polici v úvodu. Pořadí změníte přetažením.' },
  icon: 'i-lucide-briefcase',
  titleField: 'name',
  admin: { list: { columns: ['name', 'group', 'price'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    shortName: f.text().optional().label({ en: 'Short name', cs: 'Krátký název' })
      .help({ en: 'The spine of a binder is narrow: a name of one to three words. Left empty, the name is used.', cs: 'Hřbet šanonu je úzký: název o jednom až třech slovech. Když pole necháte prázdné, použije se název.' }),
    group: f.relation({ to: () => ServiceGroup, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Group', cs: 'Skupina' })
      .help({ en: 'Binders gives each group its own colour.', cs: 'Šanony dají každé skupině vlastní barvu.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Description', cs: 'Popis' }),
    price: f.text().optional().label({ en: 'Price', cs: 'Cena' })
      .help({ en: 'As you want it written, for example “from 3,900 Kč”. A price that starts with “od” (from) is set on two lines on a spine.', cs: 'Tak, jak ji chcete napsat, například „od 3 900 Kč“. Cena, která začíná slovem „od“, se na hřbetu šanonu napíše na dva řádky.' }),
    priceNote: f.text().optional().label({ en: 'Under the price', cs: 'Pod cenou' })
      .help({ en: 'For example “monthly”, “per hour”, “fixed price”.', cs: 'Například „měsíčně“, „za hodinu“, „pevná cena“.' }),
    spineNote: f.text().optional().label({ en: 'Under the price on a spine', cs: 'Pod cenou na hřbetu' })
      .help({ en: 'Only for prices that do not start with “od”, and only Binders shows it: one or two words such as “per hour”.', cs: 'Jen pro ceny, které nezačínají slovem „od“, a jen Šanony ho ukážou: jedno nebo dvě slova, třeba „hodina“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['group'] },
})

// ── the people ──
export const Person = defineEntity('person', {
  label: { en: 'People', cs: 'Lidé' },
  labelSingular: { en: 'Person', cs: 'Člověk' },
  description: { en: 'The people clients deal with: a portrait, a role and a direct line. Drag to put them in order.', cs: 'Lidé, se kterými klienti jednají: portrét, role a přímá linka. Pořadí změníte přetažením.' },
  icon: 'i-lucide-users-round',
  titleField: 'name',
  admin: { list: { columns: ['photo', 'name', 'role'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }).help({ en: 'With the title: “Ing. Radek Tesař”.', cs: 'S titulem: „Ing. Radek Tesař“.' }),
    role: f.text().optional().label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “Partner · tax adviser”.', cs: 'Například „Společník · daňový poradce“.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Portrait', cs: 'Portrét' })
      .help({ en: 'A head and shoulders portrait, taller than wide (4 by 5 or 3 by 4).', cs: 'Portrét po ramena, na výšku (4 : 5 nebo 3 : 4).' }),
    text: f.text({ multiline: true }).optional().label({ en: 'What they do', cs: 'Čím se zabývá' }).help({ en: 'One or two sentences.', cs: 'Jedna nebo dvě věty.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    phone: f.text().optional().label({ en: 'Direct phone', cs: 'Přímý telefon' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo'] },
})

// ── cases from practice: each has a page of its own ──
export const CaseStudy = defineEntity('caseStudy', {
  label: { en: 'Case studies', cs: 'Případy z praxe' },
  labelSingular: { en: 'Case study', cs: 'Případ z praxe' },
  description: { en: 'A situation you solved: the problem, what you did and the result. Each case has a page of its own. Drag to put them in order.', cs: 'Situace, kterou jste vyřešili: problém, co jste udělali a výsledek. Každý případ má vlastní stránku. Pořadí změníte přetažením.' },
  icon: 'i-lucide-scale',
  titleField: 'title',
  admin: { list: { columns: ['title', 'client', 'status'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    client: f.text().optional().label({ en: 'The client', cs: 'Klient' })
      .help({ en: 'Anonymous, for example “carpentry workshop, 8 employees”. Binders shows only what stands before the first comma.', cs: 'Anonymně, například „truhlářská dílna, 8 zaměstnanců“. Šanony ukážou jen to, co stojí před první čárkou.' }),
    duration: f.text().optional().label({ en: 'How long it took', cs: 'Jak dlouho to trvalo' }).help({ en: 'For example “5 months”.', cs: 'Například „5 měsíců“.' }),
    problem: f.text({ multiline: true }).optional().label({ en: 'The problem', cs: 'Problém' }),
    solution: f.text({ multiline: true }).optional().label({ en: 'What you did', cs: 'Co jsme udělali' }),
    outcome: f.text({ multiline: true }).optional().label({ en: 'The result', cs: 'Výsledek' }).help({ en: 'A sentence or two, with the figures.', cs: 'Věta nebo dvě, s čísly.' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'Shown on the case’s own page. A wide photo works best; the list of cases does not use it.', cs: 'Zobrazí se na samostatné stránce případu. Nejlépe široká fotografie; seznam případů ji nepoužije.' }),
    body: f.richtext().optional().label({ en: 'The whole story', cs: 'Celý příběh' })
      .help({ en: 'Shown on the case’s own page, after the problem, the solution and the result.', cs: 'Zobrazí se na samostatné stránce případu, za problémem, řešením a výsledkem.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
    ...seo(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/pripad/:slug' },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: '/pripad/:slug',
    populate: ['image', 'ogImage'],
  },
})

// ── articles: each has a page of its own ──
export const Article = defineEntity('article', {
  label: { en: 'Articles', cs: 'Články' },
  labelSingular: { en: 'Article', cs: 'Článek' },
  description: { en: 'News and advice for your clients. The newest come first; each article has a page of its own.', cs: 'Novinky a rady pro klienty. Nejnovější jsou první; každý článek má vlastní stránku.' },
  icon: 'i-lucide-newspaper',
  titleField: 'title',
  admin: { list: { columns: ['title', 'date', 'status'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Titulek' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    date: f.datetime({ allDay: true }).optional().label({ en: 'Date', cs: 'Datum' }).help({ en: 'Newer articles come first.', cs: 'Novější články jsou první.' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Perex' }).help({ en: 'Two sentences for the list of articles.', cs: 'Dvě věty do seznamu článků.' }),
    body: f.richtext().optional().label({ en: 'Text', cs: 'Text' }),
    ...seo(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/clanek/:slug' },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: '/clanek/:slug',
    populate: ['ogImage'],
  },
})

// ── questions people ask before the first meeting ──
export const Question = defineEntity('question', {
  label: { en: 'Questions', cs: 'Otázky' },
  labelSingular: { en: 'Question', cs: 'Otázka' },
  description: { en: 'What clients ask before the first meeting. Drag to put them in order.', cs: 'Na co se klienti ptají před první schůzkou. Pořadí změníte přetažením.' },
  icon: 'i-lucide-circle-help',
  titleField: 'question',
  admin: { list: { columns: ['question'], orderField: 'position' } },
  fields: {
    question: f.text({ required: true }).label({ en: 'Question', cs: 'Otázka' }),
    answer: f.text({ required: true, multiline: true }).label({ en: 'Answer', cs: 'Odpověď' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the deadlines the office watches for its clients ──
export const Deadline = defineEntity('deadline', {
  label: { en: 'Deadlines', cs: 'Termíny' },
  labelSingular: { en: 'Deadline', cs: 'Termín' },
  description: { en: 'The dates your clients must not miss. The website shows the nearest ones that have not passed yet on a ruler, and a date that has passed drops off by itself.', cs: 'Data, která klienti nesmějí zmeškat. Web ukáže na pravítku nejbližší, která ještě nenastala; datum, které uplyne, z pravítka samo zmizí.' },
  icon: 'i-lucide-calendar-clock',
  titleField: 'text',
  admin: { list: { columns: ['date', 'text'] } },
  fields: {
    date: f.datetime({ allDay: true }).label({ en: 'Date', cs: 'Datum' }),
    text: f.text({ required: true }).label({ en: 'What is due', cs: 'Co je třeba' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
  .help({ en: 'Deadlines writes it small above the heading, Binders only in the opening and the contact section.', cs: 'Lhůty ho napíšou drobně nad nadpis, Šanony jen v úvodu a v kontaktu.' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).label({ en, cs })
const count = (help: { en: string; cs: string }) => f.number({ int: true, min: 0, max: 24 }).label({ en: 'How many to show', cs: 'Kolik jich ukázat' }).help(help)

const opening = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The first screen: what the office does, one button and a photo. Binders also stands the services on a shelf beside the heading.', cs: 'První obrazovka: čím se kancelář zabývá, jedno tlačítko a fotografie. Šanony vedle nadpisu postaví na polici i služby.' },
  icon: 'i-lucide-panel-top',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Binders sets each sentence on its own line and colours the part between asterisks: “Accounts in order. Taxes on time. *Prices up front.*”.', cs: 'Šanony vysází každou větu na vlastní řádek a část mezi hvězdičkami vybarví: „Účty v pořádku. Daně včas. *Ceny předem.*“.' }),
    text: text(),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    note: f.text({ multiline: true }).label({ en: 'Note beside the button', cs: 'Poznámka u tlačítka' })
      .help({ en: 'Two short lines; a new line in the field is a new line on the page.', cs: 'Dva krátké řádky; nový řádek v poli je nový řádek na stránce.' }),
    image: photo().help({ en: 'Deadlines shows it beside the heading. Binders does not use it in the opening.', cs: 'Lhůty ji ukážou vedle nadpisu. Šanony ji v úvodu nepoužijí.' }),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'Only Deadlines shows it, in small type under the photo.', cs: 'Ukážou ho jen Lhůty, drobným písmem pod fotografií.' }),
    imageCaptionNote: f.text().label({ en: 'Caption, right side', cs: 'Popisek, pravá strana' }).help({ en: 'For example the street. Only Deadlines shows it.', cs: 'Například ulice. Ukážou ho jen Lhůty.' }),
  },
})

const deadlines = defineBlock({
  label: { en: 'Upcoming deadlines', cs: 'Nejbližší termíny' },
  description: { en: 'A ruler with the nearest deadlines from the Deadlines section, counted from today.', cs: 'Pravítko s nejbližšími termíny ze sekce Termíny, počítané od dnešního dne.' },
  icon: 'i-lucide-calendar-clock',
  fields: {
    eyebrow: eyebrow().help({ en: 'Not used: the heading is the line itself.', cs: 'Nepoužívá se: nadpis je tímto řádkem.' }),
    heading: heading().help({ en: 'Deadlines writes it as a small line of capitals; Binders as a large heading.', cs: 'Lhůty ho napíšou jako drobný řádek velkých písmen, Šanony jako velký nadpis.' }),
    count: count({ en: 'At most this many deadlines, the nearest first (six in the design). Deadlines further than eleven weeks away wait.', cs: 'Nejvýš tolik termínů, nejbližší první (v předloze šest). Termíny vzdálenější než jedenáct týdnů počkají.' }),
  },
})

const photoBlock = defineBlock({
  label: { en: 'Photograph across the page', cs: 'Fotografie přes celou šířku' },
  description: { en: 'One wide photo of the office, with a caption.', cs: 'Jedna široká fotografie kanceláře s popiskem.' },
  icon: 'i-lucide-image',
  fields: {
    image: photo(),
    caption: f.text().label({ en: 'Caption', cs: 'Popisek' })
      .help({ en: 'Binders lays it on a dark bar over the photo’s corner, Deadlines sets it small under the photo.', cs: 'Šanony ho položí na tmavý pruh přes roh fotografie, Lhůty ho napíšou drobně pod ni.' }),
  },
})

const services = defineBlock({
  label: { en: 'Services and prices', cs: 'Služby a ceny' },
  description: { en: 'The price list: every service of the Services section, in its group.', cs: 'Ceník: každá služba ze sekce Služby, ve své skupině.' },
  icon: 'i-lucide-briefcase',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
  },
})

const audience = defineBlock({
  label: { en: 'Who it is for', cs: 'Pro koho' },
  description: { en: 'The kinds of clients, each with a short text and a figure.', cs: 'Druhy klientů, každý s krátkým textem a údajem.' },
  icon: 'i-lucide-users',
  fields: {
    eyebrow: eyebrow().help({ en: 'Not used by either look.', cs: 'Nepoužívá se v žádném vzhledu.' }),
    heading: heading(),
    text: text().help({ en: 'Only Deadlines shows it, beside the heading.', cs: 'Ukážou ho jen Lhůty, vedle nadpisu.' }),
    items: f.list({
      fields: {
        title: f.text({ required: true }).label({ en: 'Kind of client', cs: 'Druh klienta' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
        count: f.text().label({ en: 'Large figure', cs: 'Velké číslo' }).help({ en: 'Deadlines: how many clients of this kind you have, for example “64”.', cs: 'Lhůty: kolik takových klientů máte, například „64“.' }),
        from: f.text().label({ en: 'Price line', cs: 'Řádek s cenou' }).help({ en: 'Binders: the starting price, for example “from 1,400 Kč monthly”.', cs: 'Šanony: cena od, například „od 1 400 Kč měsíčně“.' }),
      },
      max: 6, itemLabel: { en: 'Kind of client', cs: 'Druh klienta' },
    }).label({ en: 'Kinds of clients', cs: 'Druhy klientů' }),
  },
})

const people = defineBlock({
  label: { en: 'People', cs: 'Lidé' },
  description: { en: 'Everybody from the People section with a portrait and a direct line.', cs: 'Všichni ze sekce Lidé s portrétem a přímou linkou.' },
  icon: 'i-lucide-users-round',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    image: photo('Photo of the office', 'Fotografie kanceláře').help({ en: 'Only Deadlines shows it, beside the heading.', cs: 'Ukážou ji jen Lhůty, vedle nadpisu.' }),
  },
})

const steps = defineBlock({
  label: { en: 'How it starts', cs: 'Jak začíná spolupráce' },
  description: { en: 'Three to five steps from the first call to the first month, with a photo.', cs: 'Tři až pět kroků od prvního telefonátu k prvnímu měsíci, s fotografií.' },
  icon: 'i-lucide-list-ordered',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    items: f.list({
      fields: {
        label: f.text().label({ en: 'When', cs: 'Kdy' }).help({ en: 'Deadlines: “day 0”, “within a week”. Binders numbers the steps instead.', cs: 'Lhůty: „den 0“, „do týdne“. Šanony kroky místo toho číslují.' }),
        title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 5, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'Steps', cs: 'Kroky' }),
    image: photo(),
    imageAlt: f.text().label({ en: 'What the photo shows', cs: 'Co je na fotografii' }).help({ en: 'Only when the photo has no description in the media library.', cs: 'Jen když fotografie nemá popis v knihovně médií.' }),
  },
})

const cases = defineBlock({
  label: { en: 'Case studies', cs: 'Případy z praxe' },
  description: { en: 'The cases from the Case studies section, each linking to its own page.', cs: 'Případy ze sekce Případy z praxe, každý s odkazem na vlastní stránku.' },
  icon: 'i-lucide-scale',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    count: count({ en: 'Leave it at 0 to show all of them.', cs: 'Při 0 se ukážou všechny.' }),
  },
})

const articles = defineBlock({
  label: { en: 'Articles', cs: 'Články' },
  description: { en: 'The newest articles from the Articles section, each linking to its own page.', cs: 'Nejnovější články ze sekce Články, každý s odkazem na vlastní stránku.' },
  icon: 'i-lucide-newspaper',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    count: count({ en: 'Leave it at 0 to show all of them (the page with all articles does).', cs: 'Při 0 se ukážou všechny (tak to dělá stránka se všemi články).' }),
    allLabel: f.text().label({ en: 'Text of the link to all articles', cs: 'Text odkazu na všechny články' }),
    allUrl: link('Link destination', 'Cíl odkazu'),
  },
})

const questions = defineBlock({
  label: { en: 'Questions and answers', cs: 'Časté otázky' },
  description: { en: 'The questions from the Questions section; each opens to its answer.', cs: 'Otázky ze sekce Otázky; každá se rozbalí na odpověď.' },
  icon: 'i-lucide-circle-help',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    image: photo().help({ en: 'Only Binders shows it, under the heading (not on a phone).', cs: 'Ukážou ji jen Šanony, pod nadpisem (ne na telefonu).' }),
  },
})

const contact = defineBlock({
  label: { en: 'Contact', cs: 'Kontakt' },
  description: { en: 'The enquiry form, the office hours, the address and the way there.', cs: 'Poptávkový formulář, úřední hodiny, adresa a cesta ke kanceláři.' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Deadlines: an invitation to the first meeting. Binders: the address itself, set very large.', cs: 'Lhůty: pozvání na první schůzku. Šanony: samotná adresa, vysázená velmi velkým písmem.' }),
    text: text().help({ en: 'Deadlines writes it under the heading, Binders inside the form’s card, under its own heading.', cs: 'Lhůty ho napíšou pod nadpis, Šanony do karty formuláře pod její vlastní nadpis.' }),
    formHeading: f.text().label({ en: 'Heading of the form', cs: 'Nadpis formuláře' }).help({ en: 'Only Binders shows it, on the form’s card.', cs: 'Ukážou ho jen Šanony, na kartě formuláře.' }),
    consent: f.text().label({ en: 'Sentence under the form', cs: 'Věta pod formulářem' }),
    image: photo('Photo of the house', 'Fotografie domu'),
    route: f.list({
      fields: {
        figure: f.text({ required: true }).label({ en: 'Figure', cs: 'Údaj' }).help({ en: 'For example “4 min”, “250 m”, “2 places”.', cs: 'Například „4 min“, „250 m“, „2 místa“.' }),
        text: f.text({ required: true }).label({ en: 'What it is', cs: 'Co to je' }),
      },
      max: 6, itemLabel: { en: 'Figure', cs: 'Údaj' },
    }).label({ en: 'The way to the office', cs: 'Cesta ke kanceláři' })
      .help({ en: 'Deadlines lists them all in a table beside the address. Binders sets the first three very large over the photo.', cs: 'Lhůty je vypíšou všechny v tabulce vedle adresy. Šanony první tři vysází velmi velkým písmem nad fotografií.' }),
    hoursNote: f.text().label({ en: 'Note under the office hours', cs: 'Poznámka pod úředními hodinami' }).help({ en: 'Deadlines adds the phone and the e-mail after it.', cs: 'Lhůty za ni připojí telefon a e-mail.' }),
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
  blocks: { opening, deadlines, photo: photoBlock, services, audience, people, steps, cases, articles, questions, contact, text: richText, ...customTypeBlocks() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    legal: { en: 'Documents in the footer', cs: 'Dokumenty v zápatí' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the enquiries of the form below
]

// ── the enquiry form ──
// The website draws it per look (the kit's useSiteForm). The sentence under it is worded by the
// owner in the "Contact" block.
export const Enquiry = defineForm('enquiry', {
  label: { en: 'Enquiries', cs: 'Poptávky' },
  labelSingular: { en: 'Enquiry', cs: 'Poptávka' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    email: f.text({ required: true, format: 'email' }).label({ en: 'E-mail', cs: 'E-mail' }),
    phone: f.text({ max: 60 }).optional().label({ en: 'Phone', cs: 'Telefon' }),
    // The website shows a field's help inside it, as an example of what to write.
    message: f.text({ multiline: true, max: 5000 }).optional().label({ en: 'What you need', cs: 'Co potřebujete' })
      .help({ en: 'For example: a company with four employees, we are looking for a new accountant from January.', cs: 'Například: s.r.o. se čtyřmi zaměstnanci, hledáme novou účetní od ledna.' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send enquiry', cs: 'Odeslat poptávku' },
  successMessage: { en: 'Thank you. We have your enquiry and will answer by the end of the next working day.', cs: 'Děkujeme, poptávku máme. Odpovíme nejpozději druhý pracovní den.' },
})
export const FormSettings = defineFormSettings()
