import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'
import { OWN_COLOR_FIELD } from 'tinyzoo-template-kit/looks'
import { kitEntryBlocks, kitSections } from 'tinyzoo-template-kit/sections'

// The content model of the Association template: what a club or a non-profit can write and
// change. One model for every look (looks.ts): a look decides how a block is drawn, never what
// it holds. Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and
// `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in the look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou.',
  en: 'Text between *asterisks* stands out, for example in italics.',
}

// ── the whole site: who, where, how to reach them, the year ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The name, the look and colours, the facts about the association, where you meet and how to reach you.', cs: 'Název, vzhled a barvy, údaje o spolku, kde se scházíte a jak se vám dovolat.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'ownColor'] },
      { label: { en: 'About the association', cs: 'Údaje o spolku' }, fields: ['legalName', 'about', 'companyId', 'register', 'dataBox', 'account', 'accountUrl', 'giftEmail'] },
      { label: { en: 'Where and how to reach you', cs: 'Kde a jak vás zastihnout' }, fields: ['placeName', 'address', 'directions', 'presence', 'presenceNote', 'email', 'phone'] },
      { label: { en: 'The year in twelve months', cs: 'Rok ve spolku' }, fields: ['months'] },
      { label: { en: 'Header button', cs: 'Tlačítko v záhlaví' }, fields: ['ctaLabel', 'ctaUrl'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name', cs: 'Název' })
      .help({ en: 'The short name of the association, for example “Pear Orchard”. It stands in the header and is the name of the admin.', cs: 'Krátký název spolku, například „Planá hruška“. Je v záhlaví a je to název administrace.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the drawn pear. A wide logo works best.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo nakreslené hrušky. Nejlépe se hodí logo na šířku.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes. The tints of the four seasons stay the same in all of them.', cs: 'Každý vzhled má tři barevné palety. Barvy čtyř ročních období zůstávají ve všech stejné.' }),
    // The owner's own main colour: the palette of the chosen colours follows it (templates/kit/palette.ts).
    ownColor: f.color().optional().label(OWN_COLOR_FIELD.label).help(OWN_COLOR_FIELD.help),
    legalName: f.text().optional().label({ en: 'Full name with the legal form', cs: 'Celý název s právní formou' })
      .help({ en: 'For example “Pear Orchard, z. s.”. It stands in the footer; if you leave it empty, the footer uses the name above.', cs: 'Například „Planá hruška, z. s.“. Je v zápatí; když pole necháte prázdné, použije se název výše.' }),
    about: f.text({ multiline: true }).optional().label({ en: 'Who you are, in a sentence', cs: 'Kdo jste, jednou větou' })
      .help({ en: 'Under the name in the footer.', cs: 'Pod názvem v zápatí.' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    register: f.text().optional().label({ en: 'Register entry', cs: 'Spolkový rejstřík' })
      .help({ en: 'The court and the file number, for example “Regional Court in Hradec Králové, file L 7421”.', cs: 'Soud a spisová značka, například „Krajský soud v Hradci Králové, spisová značka L 7421“.' }),
    dataBox: f.text().optional().label({ en: 'Data box', cs: 'Datová schránka' }),
    account: f.text().optional().label({ en: 'Transparent bank account', cs: 'Transparentní účet' })
      .help({ en: 'With the bank code, for example “2901847365/2010”. It stands in the giving card and in the footer.', cs: 'S kódem banky, například „2901847365/2010“. Je v kartě Darem a v zápatí.' }),
    accountUrl: f.text({ format: 'url' }).optional().label({ en: 'Link to the account statement', cs: 'Odkaz na výpis z účtu' })
      .help({ en: 'The bank’s public page of the account. The giving card links to it.', cs: 'Veřejná stránka účtu u banky. Odkazuje na ni karta Darem.' }),
    giftEmail: f.text({ format: 'email' }).optional().label({ en: 'E-mail for gift receipts', cs: 'E-mail pro potvrzení o daru' })
      .help({ en: 'Written where the “Ways to help” block mentions the receipt.', cs: 'Napíše se tam, kde blok „Jak pomoci“ mluví o potvrzení o daru.' }),
    placeName: f.text().optional().label({ en: 'Where you meet', cs: 'Kde se scházíte' })
      .help({ en: 'The name of the place, for example “The Drying Barn”.', cs: 'Název místa, například „Sušárna Na Vrších“.' }),
    address: f.text().optional().label({ en: 'Address', cs: 'Adresa' })
      .help({ en: 'The street, number, postcode and town. It stands in the contact block and in the footer.', cs: 'Ulice, číslo, PSČ a obec. Je v kontaktním bloku a v zápatí.' }),
    directions: f.text().optional().label({ en: 'How to get there', cs: 'Jak se tam dostat' })
      .help({ en: 'One or two sentences after the address.', cs: 'Jedna nebo dvě věty za adresou.' }),
    presence: f.text().optional().label({ en: 'When someone is there', cs: 'Kdy tam někdo je' })
      .help({ en: 'Set large, for example “every Thursday 16–18”.', cs: 'Napíše se velkým písmem, například „každý čtvrtek 16–18 h“.' }),
    presenceNote: f.text().optional().label({ en: 'More about it', cs: 'Víc k tomu' })
      .help({ en: 'For example “From April to October. In winter by arrangement.”', cs: 'Například „Od dubna do října. V zimě po domluvě.“' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    months: f.list({
      fields: {
        text: f.text({ required: true, max: 40 }).label({ en: 'What is done', cs: 'Co se dělá' })
          .help({ en: 'A few words in the strip of the year, for example “pruning the old orchard”.', cs: 'Pár slov v pásu roku, například „řez starého sadu“.' }),
        doing: f.text({ max: 60 }).optional().label({ en: 'The same as a sentence', cs: 'Totéž jako věta' })
          .help({ en: 'Written after the month in the opening’s label while it is that month: “November: we plant avenues”. Leave it empty to show the month alone.', cs: 'Napíše se za měsíc do štítku v úvodu, dokud ten měsíc trvá: „Listopad: sázíme aleje“. Když pole necháte prázdné, ukáže se jen měsíc.' }),
      },
      max: 12, itemLabel: { en: 'Month', cs: 'Měsíc' },
    }).label({ en: 'What is done when', cs: 'Co se kdy dělá' })
      .help({ en: 'Twelve lines, January first. The strip of the year shows them; the current month stands out in the brand colour.', cs: 'Dvanáct řádků, od ledna. Zobrazí je pás roku; aktuální měsíc vynikne barvou spolku.' }),
    ctaLabel: f.text().optional().label({ en: 'Button text', cs: 'Text tlačítka' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── projects: what the association looks after ──
export const Project = defineEntity('project', {
  label: { en: 'Projects', cs: 'Projekty' },
  labelSingular: { en: 'Project', cs: 'Projekt' },
  description: { en: 'The places and the work you do, each in the colour of its season, with this year’s result. Drag to put them in order.', cs: 'Místa a práce, o které pečujete, každá v barvě svého ročního období, s výsledkem letošního roku. Pořadí změníte přetažením.' },
  icon: 'i-lucide-sprout',
  titleField: 'title',
  admin: { list: { columns: ['title', 'season', 'period'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    season: f.select({
      options: ['winter', 'spring', 'summer', 'autumn', 'year'] as const, default: 'autumn',
      labels: { winter: { en: 'Winter', cs: 'Zima' }, spring: { en: 'Spring', cs: 'Jaro' }, summer: { en: 'Summer', cs: 'Léto' }, autumn: { en: 'Autumn', cs: 'Podzim' }, year: { en: 'All year', cs: 'Celý rok' } },
    }).label({ en: 'Season', cs: 'Roční doba' })
      .help({ en: 'The project’s card wears the tint of its season. “All year” has no tint.', cs: 'Karta projektu má barvu svého ročního období. „Celý rok“ je bez barvy.' }),
    period: f.text().optional().label({ en: 'When', cs: 'Kdy' })
      .help({ en: 'Written beside the season, for example “January to March”.', cs: 'Napíše se za roční dobu, například „leden až březen“.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
    result: f.text({ multiline: true }).optional().label({ en: 'This year', cs: 'Letos' })
      .help({ en: 'One or two sentences with the year’s result, for example “61 trees pruned, 12 apple trees planted”.', cs: 'Jedna nebo dvě věty s výsledkem letošního roku, například „zimní řez 61 stromů, dosazeno 12 jabloní“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo'] },
})

// ── events: the calendar ──
export const Event = defineEntity('event', {
  label: { en: 'Events', cs: 'Akce' },
  labelSingular: { en: 'Event', cs: 'Akce' },
  description: { en: 'Work parties, courses and meetings. The nearest one is shown large, past ones with a photo make the look back.', cs: 'Brigády, kurzy a schůze. Nejbližší akce se ukáže velká, minulé s fotografií tvoří ohlédnutí.' },
  icon: 'i-lucide-calendar-days',
  titleField: 'title',
  admin: { list: { columns: ['title', 'date', 'status'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    date: f.datetime().label({ en: 'Day and start', cs: 'Den a začátek' })
      .help({ en: 'An event is “coming” until the end of its day; after that it goes to the look back.', cs: 'Akce je „nadcházející“ do konce svého dne, potom přejde do ohlédnutí.' }),
    endTime: f.text({ max: 10 }).optional().label({ en: 'Ends at', cs: 'Končí v' })
      .help({ en: 'For example “14:00”.', cs: 'Například „14:00“.' }),
    place: f.text().optional().label({ en: 'Where', cs: 'Kde' })
      .help({ en: 'The meeting place. In the list it opens the line under the name, after it the end time is written (“, until 12:00”).', cs: 'Místo srazu. V seznamu otevírá řádek pod názvem, za ním se napíše konec („, do 12:00“).' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Krátký text' })
      .help({ en: 'One or two sentences for the list of events.', cs: 'Jedna nebo dvě věty do seznamu akcí.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Longer text', cs: 'Delší text' })
      .help({ en: 'For the large card of the nearest event and for the event’s own page. If it is empty, the short text is used.', cs: 'Do velké karty nejbližší akce a na stránku akce. Když pole necháte prázdné, použije se krátký text.' }),
    teaser: f.text().optional().label({ en: 'Line for the opening', cs: 'Řádek do úvodu' })
      .help({ en: 'The small line in the card under the opening’s photograph, for example “Bring a spade, the soup is ours.”', cs: 'Malý řádek v kartě pod fotografií v úvodu, například „Rýč s sebou, polévka je naše.“' }),
    bring: f.text().optional().label({ en: 'What to bring', cs: 'Co s sebou' })
      .help({ en: 'For example “sturdy boots, gloves”. A price can stand here too.', cs: 'Například „pevné boty, rukavice“. Může tu být i cena.' }),
    signup: f.boolean().label({ en: 'Needs a sign-up', cs: 'Vyžaduje přihlášení' }),
    signupBy: f.datetime({ allDay: true }).optional().label({ en: 'Sign up by', cs: 'Přihlásit se do' }),
    signupLabel: f.text().optional().label({ en: 'Sign-up button text', cs: 'Text tlačítka přihlášení' })
      .help({ en: 'For example “Sign up for the planting”. Empty: “Sign up”.', cs: 'Například „Přihlásit se na sázení“. Prázdné: „Přihlásit se“.' }),
    signupNote: f.text().optional().label({ en: 'Why', cs: 'Proč' })
      .help({ en: 'Written after the date: “so we know how many tools and soups to bring”.', cs: 'Napíše se za datum: „ať víme, kolik vzít nářadí a uvařit polévky“.' }),
    capacity: f.number({ int: true, min: 0 }).optional().label({ en: 'Places', cs: 'Počet míst' })
      .help({ en: 'Leave empty when the number is not limited.', cs: 'Když počet není omezený, pole nechte prázdné.' }),
    registered: f.number({ int: true, min: 0 }).optional().label({ en: 'Signed up so far', cs: 'Zatím přihlášeno' })
      .help({ en: 'You count the sign-ups and update this number. With the number of places, the list shows how many are free.', cs: 'Přihlášené počítáte vy a číslo upravujete. S počtem míst seznam ukáže, kolik jich zbývá.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'A past event with a photograph appears in the look back.', cs: 'Proběhlá akce s fotografií se ukáže v ohlédnutí.' }),
    recap: f.text({ multiline: true }).optional().label({ en: 'How it went', cs: 'Jak to dopadlo' })
      .help({ en: 'Written under the photograph in the look back, for example “23 people came. We raked the leaves…”.', cs: 'Napíše se pod fotografii v ohlédnutí, například „Přišlo 23 lidí. Shrabali jsme listí…“.' }),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/akce/:slug' },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: '/akce/:slug',
    populate: ['photo'],
  },
})

// ── news ──
export const News = defineEntity('news', {
  label: { en: 'News', cs: 'Aktuality' },
  labelSingular: { en: 'News item', cs: 'Aktualita' },
  description: { en: 'Short messages for the home page. Each has a page of its own.', cs: 'Krátké zprávy na úvodní stránku. Každá má vlastní stránku.' },
  icon: 'i-lucide-newspaper',
  titleField: 'title',
  admin: { list: { columns: ['title', 'date', 'status'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Headline', cs: 'Titulek' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    date: f.datetime({ allDay: true }).label({ en: 'Date', cs: 'Datum' })
      .help({ en: 'Newer news come first.', cs: 'Novější aktuality jsou první.' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Krátký text' })
      .help({ en: 'Two sentences for the card on the home page.', cs: 'Dvě věty do karty na úvodní stránce.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'Without a photograph the card shows the day of the month in large figures instead.', cs: 'Bez fotografie karta místo ní ukáže velké číslo dne v měsíci.' }),
    body: f.richtext().optional().label({ en: 'Text', cs: 'Text' })
      .help({ en: 'The whole message, on the page of its own.', cs: 'Celá zpráva na její vlastní stránce.' }),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/aktuality/:slug' },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: '/aktuality/:slug',
    populate: ['photo'],
  },
})

// ── documents: annual reports, accounts, statutes ──
export const Document = defineEntity('document', {
  label: { en: 'Documents', cs: 'Dokumenty' },
  labelSingular: { en: 'Document', cs: 'Dokument' },
  description: { en: 'Annual reports, financial statements, statutes and minutes, grouped by year.', cs: 'Výroční zprávy, účetní závěrky, stanovy a zápisy, seskupené podle roku.' },
  icon: 'i-lucide-file-text',
  titleField: 'title',
  admin: { list: { columns: ['title', 'year'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Name', cs: 'Název' })
      .help({ en: 'For example “Annual report”.', cs: 'Například „Výroční zpráva“.' }),
    year: f.number({ int: true, min: 1900, max: 2200 }).optional().label({ en: 'Year', cs: 'Rok' })
      .help({ en: 'Documents of one year stand in one card. Leave it empty for documents that always apply (statutes): they stand in the “Permanent” card.', cs: 'Dokumenty jednoho roku stojí v jedné kartě. U dokumentů, které platí stále (stanovy), pole nechte prázdné: stojí v kartě „Stálé“.' }),
    file: f.media({ accept: 'application/pdf' }).optional().label({ en: 'File', cs: 'Soubor' })
      .help({ en: 'The PDF to download.', cs: 'PDF ke stažení.' }),
    note: f.text().optional().label({ en: 'Note under the name', cs: 'Poznámka pod názvem' })
      .help({ en: 'The type and size of the file, for example “PDF, 2.4 MB”.', cs: 'Druh a velikost souboru, například „PDF, 2,4 MB“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' })
      .help({ en: 'The order inside a year’s card.', cs: 'Pořadí v kartě jednoho roku.' }),
  },
  content: { public: true, populate: ['file'] },
})

// ── people: the committee ──
export const Person = defineEntity('person', {
  label: { en: 'People', cs: 'Lidé' },
  labelSingular: { en: 'Person', cs: 'Člověk' },
  description: { en: 'The committee: a portrait, a role and a few words. Drag to put them in order.', cs: 'Výbor: portrét, role a pár slov. Pořadí změníte přetažením.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  admin: { list: { columns: ['name', 'role', 'volunteers'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    role: f.text().optional().label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “chair”.', cs: 'Například „předsedkyně“.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Portrait', cs: 'Portrét' })
      .help({ en: 'Cropped to 4:5 (upright).', cs: 'Ořízne se na výšku 4:5.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'A few words', cs: 'Pár slov' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    volunteers: f.boolean().label({ en: 'Takes the calls of new volunteers', cs: 'Má na starosti dobrovolníky' })
      .help({ en: 'The first person with this on gets the phone and e-mail shown in “Join by hand” and in the “Are you coming for the first time?” card.', cs: 'První člověk s touto volbou má telefon a e-mail ukázaný v kartě „Rukama“ a v kartě „Jdete poprvé?“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo'] },
})

// ── supporters ──
export const Supporter = defineEntity('supporter', {
  label: { en: 'Supporters', cs: 'Podporovatelé' },
  labelSingular: { en: 'Supporter', cs: 'Podporovatel' },
  description: { en: 'Who supports you, as plain text. Drag to put them in order.', cs: 'Kdo vás podporuje, jako prostý text. Pořadí změníte přetažením.' },
  icon: 'i-lucide-handshake',
  titleField: 'name',
  admin: { list: { columns: ['name', 'kind'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    kind: f.text().optional().label({ en: 'What kind', cs: 'Druh' }).help({ en: 'For example “town”, “foundation”, “company”.', cs: 'Například „město“, „nadace“, „firma“.' }),
    note: f.text().optional().label({ en: 'Note', cs: 'Poznámka' }).help({ en: 'What they give, for example “stakes and timber for free”.', cs: 'Co dávají, například „kůly a řezivo zdarma“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).label({ en, cs })

const opening = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The heading, a photograph, two buttons, and under the photograph the nearest event from Events. The season it is now shows in the label above the heading.', cs: 'Nadpis, fotografie, dvě tlačítka a pod fotografií nejbližší akce ze sekce Akce. Aktuální roční období se ukáže ve štítku nad nadpisem.' },
  icon: 'i-lucide-panel-top',
  fields: {
    heading: heading(),
    text: text(),
    image: photo().help({ en: 'A wide photograph, shown 5:4.', cs: 'Fotografie na šířku, zobrazí se v poměru 5:4.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Second button text', cs: 'Text druhého tlačítka' }),
    secondaryUrl: link('Second button destination', 'Cíl druhého tlačítka'),
  },
})

const year = defineBlock({
  label: { en: 'The year and projects', cs: 'Rok a projekty' },
  description: { en: 'The strip of twelve months from Site settings, then the projects from Projects, each in the tint of its season.', cs: 'Pás dvanácti měsíců z Nastavení webu a pod ním projekty ze sekce Projekty, každý v barvě svého ročního období.' },
  icon: 'i-lucide-sprout',
  fields: {
    heading: heading(),
    text: text(),
    asideHeading: f.text().label({ en: 'Last card: heading', cs: 'Poslední karta: nadpis' }).help(EMPHASIS_HELP),
    asideText: f.text({ multiline: true }).label({ en: 'Last card: text', cs: 'Poslední karta: text' })
      .help({ en: 'The small card after the projects. Leave all of it empty to leave the card out.', cs: 'Malá karta za projekty. Když ji celou necháte prázdnou, karta se nezobrazí.' }),
    asideLinkLabel: f.text().label({ en: 'Last card: link text', cs: 'Poslední karta: text odkazu' }),
    asideLinkUrl: link('Last card: link destination', 'Poslední karta: cíl odkazu'),
  },
})

const events = defineBlock({
  label: { en: 'Calendar of events', cs: 'Kalendář akcí' },
  description: { en: 'The nearest event as a large card, the coming ones by month, and a look back at past events with a photograph. All from Events.', cs: 'Nejbližší akce jako velká karta, další akce po měsících a ohlédnutí za proběhlými akcemi s fotografií. Vše ze sekce Akce.' },
  icon: 'i-lucide-calendar-days',
  fields: {
    heading: heading(),
    text: text(),
    limit: f.number({ int: true, min: 0, max: 100 }).label({ en: 'Coming events after the nearest', cs: 'Počet dalších akcí' })
      .help({ en: 'How many events after the nearest one are listed.', cs: 'Kolik akcí po té nejbližší se vypíše.' }),
    allLabel: f.text().label({ en: 'Link to all events: text', cs: 'Odkaz na všechny akce: text' })
      .help({ en: 'Shown only when there are more coming events than listed.', cs: 'Ukáže se, jen když je nadcházejících akcí víc, než se vypsalo.' }),
    allUrl: link('Link to all events: destination', 'Odkaz na všechny akce: cíl'),
    lookbackHeading: heading().label({ en: 'Look back: heading', cs: 'Ohlédnutí: nadpis' }),
    pastLimit: f.number({ int: true, min: 0, max: 100 }).label({ en: 'Past events in the look back', cs: 'Počet proběhlých akcí v ohlédnutí' })
      .help({ en: 'Only past events that have a photograph. The newest come first.', cs: 'Jen proběhlé akce s fotografií. Nejnovější jsou první.' }),
  },
})

const help = defineBlock({
  label: { en: 'Ways to help', cs: 'Jak pomoci' },
  description: { en: 'Three cards: come by hand, become a member, give a sum (with the account from Site settings), and a strip of what a sum pays for.', cs: 'Tři karty: přijít rukama, stát se členem, darovat peníze (s účtem z Nastavení webu) a pás o tom, co se za dar pořídí.' },
  icon: 'i-lucide-hand-heart',
  fields: {
    heading: heading(),
    text: text(),
    volunteerLabel: f.text().label({ en: 'By hand: line above', cs: 'Rukama: řádek nad nadpisem' }),
    volunteerHeading: f.text().label({ en: 'By hand: heading', cs: 'Rukama: nadpis' }),
    volunteerText: f.text({ multiline: true }).label({ en: 'By hand: text', cs: 'Rukama: text' })
      .help({ en: 'The name and phone of the person who takes the calls of new volunteers (from People) stand under it.', cs: 'Pod ním stojí jméno a telefon člověka, který má na starosti dobrovolníky (ze sekce Lidé).' }),
    volunteerImage: photo('By hand: photograph', 'Rukama: fotografie'),
    memberLabel: f.text().label({ en: 'Membership: line above', cs: 'Členství: řádek nad nadpisem' }),
    memberHeading: f.text().label({ en: 'Membership: heading', cs: 'Členství: nadpis' }),
    memberAmount: f.text().label({ en: 'Membership: the fee', cs: 'Členství: příspěvek' })
      .help({ en: 'Set very large, for example “300 Kč”.', cs: 'Napíše se velmi velkým písmem, například „300 Kč“.' }),
    memberUnit: f.text().label({ en: 'Membership: per what', cs: 'Členství: za co' }).help({ en: 'For example “a year”.', cs: 'Například „na rok“.' }),
    memberText: f.text({ multiline: true }).label({ en: 'Membership: text', cs: 'Členství: text' }),
    memberNote: f.text().label({ en: 'Membership: other fees', cs: 'Členství: další sazby' }).help({ en: 'For example “Students and seniors 150 Kč, a whole family 500 Kč.”', cs: 'Například „Studenti a senioři 150 Kč, celá rodina 500 Kč.“' }),
    memberButtonLabel: f.text().label({ en: 'Membership: button text', cs: 'Členství: text tlačítka' }),
    memberButtonUrl: link('Membership: button destination', 'Členství: cíl tlačítka'),
    giveLabel: f.text().label({ en: 'Giving: line above', cs: 'Dar: řádek nad nadpisem' }),
    giveHeading: f.text().label({ en: 'Giving: heading', cs: 'Dar: nadpis' }),
    qrImage: f.media({ accept: 'image/*' }).label({ en: 'Giving: payment QR code', cs: 'Dar: QR kód pro platbu' })
      .help({ en: 'Upload the QR code from your bank. Without one, a sample pattern is drawn.', cs: 'Nahrajte QR kód z vaší banky. Bez něj se nakreslí ukázkový vzor.' }),
    giveText: f.text({ multiline: true }).label({ en: 'Giving: text beside the code', cs: 'Dar: text vedle kódu' }),
    accountNote: f.text({ multiline: true }).label({ en: 'Giving: text under the account', cs: 'Dar: text pod číslem účtu' })
      .help({ en: 'The account itself is from Site settings; the link to its statement too.', cs: 'Číslo účtu je z Nastavení webu, stejně jako odkaz na výpis.' }),
    accountLinkLabel: f.text().label({ en: 'Giving: link to the statement', cs: 'Dar: text odkazu na výpis' }),
    sumsHeading: heading(false).label({ en: 'Sums: heading', cs: 'Částky: nadpis' }),
    sums: f.list({
      fields: {
        amount: f.number({ int: true, min: 0 }).label({ en: 'Sum in Kč', cs: 'Částka v Kč' }),
        text: f.text({ required: true }).label({ en: 'What it pays for', cs: 'Co se za ni pořídí' }),
      },
      max: 8, itemLabel: { en: 'Sum', cs: 'Částka' },
    }).label({ en: 'What a sum pays for', cs: 'Co se za dar pořídí' }),
    receipt: f.text({ multiline: true }).label({ en: 'Gift receipt', cs: 'Potvrzení o daru' })
      .help({ en: 'Under the sums. A part between *asterisks* is set bold; {email} is replaced by the address for receipts from Site settings, as a link.', cs: 'Pod částkami. Text mezi *hvězdičkami* se zvýrazní tučně; {email} se nahradí adresou pro potvrzení o daru z Nastavení webu jako odkaz.' }),
  },
})

const accounts = defineBlock({
  label: { en: 'Accounts and documents', cs: 'Účty a dokumenty' },
  description: { en: 'Two strips on one scale, what came in and what went out (and what was left), then documents by year from Documents and the supporters from Supporters.', cs: 'Dva pásy na jedné stupnici, co přišlo a co odešlo (a co zůstalo), pod nimi dokumenty podle roku ze sekce Dokumenty a podporovatelé ze sekce Podporovatelé.' },
  icon: 'i-lucide-chart-no-axes-column',
  fields: {
    heading: heading(),
    text: text(),
    incomeHeading: heading().label({ en: 'Income: heading', cs: 'Příjmy: nadpis' }),
    income: f.list({
      fields: {
        name: f.text({ required: true }).label({ en: 'Source', cs: 'Zdroj' }),
        amount: f.number({ int: true, min: 0 }).label({ en: 'Sum in Kč', cs: 'Částka v Kč' }),
      },
      max: 10, itemLabel: { en: 'Income', cs: 'Příjem' },
    }).label({ en: 'Income', cs: 'Příjmy' })
      .help({ en: 'Biggest first. The total is added up for you.', cs: 'Největší první. Součet se spočítá sám.' }),
    expensesHeading: heading().label({ en: 'Spending: heading', cs: 'Výdaje: nadpis' }),
    expenses: f.list({
      fields: {
        name: f.text({ required: true }).label({ en: 'What for', cs: 'Na co' }),
        amount: f.number({ int: true, min: 0 }).label({ en: 'Sum in Kč', cs: 'Částka v Kč' }),
      },
      max: 10, itemLabel: { en: 'Expense', cs: 'Výdaj' },
    }).label({ en: 'Spending', cs: 'Výdaje' })
      .help({ en: 'Biggest first. What is left of the income is shown as the last line and the last piece of the strip.', cs: 'Největší první. Co z příjmů zbylo, se ukáže jako poslední řádek a poslední kus pásu.' }),
    leftoverLabel: f.text().label({ en: 'What was left: text', cs: 'Co zbylo: text' })
      .help({ en: 'The *marked* part stands out, for example “*Left over* and carried into this year”.', cs: 'Text mezi *hvězdičkami* se zvýrazní, například „*Zůstalo* a převedli jsme do letoška“.' }),
    docsHeading: heading().label({ en: 'Documents: heading', cs: 'Dokumenty: nadpis' }),
    docYears: f.number({ int: true, min: 0, max: 50 }).label({ en: 'Years shown', cs: 'Počet zobrazených let' })
      .help({ en: 'How many of the newest years of documents are shown (the permanent ones always are). 0 shows all.', cs: 'Kolik nejnovějších let dokumentů se zobrazí (stálé dokumenty vždy). 0 zobrazí všechny.' }),
    archive: f.text().label({ en: 'Link to the archive', cs: 'Odkaz na archiv' })
      .help({ en: 'The *marked* part is the link, for example “Older years are *in the archive*.”. Shown only when older years are left out.', cs: 'Odkazem je text mezi *hvězdičkami*, například „Starší ročníky jsou *v archivu dokumentů*.“. Ukáže se, jen když jsou starší roky vynechané.' }),
    archiveUrl: link('Archive: destination', 'Archiv: cíl odkazu'),
    supportersHeading: heading(false).label({ en: 'Supporters: heading', cs: 'Podporovatelé: nadpis' }),
  },
})

const documents = defineBlock({
  label: { en: 'All documents', cs: 'Všechny dokumenty' },
  description: { en: 'Every document from Documents, by year: for the archive page.', cs: 'Všechny dokumenty ze sekce Dokumenty podle roku: pro stránku s archivem.' },
  icon: 'i-lucide-archive',
  fields: {
    heading: heading(),
    text: text(),
  },
})

const people = defineBlock({
  label: { en: 'People', cs: 'Lidé' },
  description: { en: 'The people from People with portraits, and a card for newcomers with the phone of the person who takes volunteers.', cs: 'Lidé ze sekce Lidé s portréty a karta pro nováčky s telefonem člověka, který má na starosti dobrovolníky.' },
  icon: 'i-lucide-users',
  fields: {
    heading: heading(),
    text: text(),
    helloLabel: f.text().label({ en: 'Newcomers’ card: line above', cs: 'Karta pro nováčky: řádek nad textem' }),
    helloText: f.text({ multiline: true }).label({ en: 'Newcomers’ card: text', cs: 'Karta pro nováčky: text' })
      .help({ en: 'Leave empty to leave the card out.', cs: 'Když pole necháte prázdné, karta se nezobrazí.' }),
  },
})

const news = defineBlock({
  label: { en: 'News', cs: 'Aktuality' },
  description: { en: 'The newest news from News as cards: with a photograph, or with the day of the month in large figures.', cs: 'Nejnovější zprávy ze sekce Aktuality jako karty: s fotografií, nebo s velkým číslem dne v měsíci.' },
  icon: 'i-lucide-newspaper',
  fields: {
    heading: heading(),
    count: f.number({ int: true, min: 1, max: 100 }).label({ en: 'How many to show', cs: 'Kolik zpráv ukázat' }),
    list: f.boolean().label({ en: 'As a list of all', cs: 'Jako seznam všech' })
      .help({ en: 'For a page of all news: the cards wrap into rows instead of one row to swipe.', cs: 'Pro stránku všech aktualit: karty se zalomí do řádků místo jednoho řádku k posunutí.' }),
    allLabel: f.text().label({ en: 'Link to all news: text', cs: 'Odkaz na všechny aktuality: text' }),
    allUrl: link('Link to all news: destination', 'Odkaz na všechny aktuality: cíl'),
  },
})

const contact = defineBlock({
  label: { en: 'Contact and message form', cs: 'Kontakt a formulář' },
  description: { en: 'Where you meet and how to reach you (from Site settings), and a form for sign-ups, membership, gifts and questions. The messages arrive in the admin.', cs: 'Kde se scházíte a jak vás zastihnout (z Nastavení webu) a formulář pro přihlášky, členství, dary a dotazy. Zprávy najdete v administraci.' },
  icon: 'i-lucide-mail',
  fields: {
    heading: heading(),
    text: text(),
    formHeading: f.text().label({ en: 'Form: heading', cs: 'Formulář: nadpis' }),
    formText: f.text({ multiline: true }).label({ en: 'Form: text', cs: 'Formulář: text' }),
    topics: f.list({
      fields: { name: f.text({ required: true }).label({ en: 'Topic', cs: 'Téma' }) },
      max: 8, itemLabel: { en: 'Topic', cs: 'Téma' },
    }).label({ en: 'What a message can be about', cs: 'Čeho se zpráva může týkat' })
      .help({ en: 'The choices of the form. The coming events that need a sign-up are offered first, automatically; yours follow them.', cs: 'Nabídka ve formuláři. Nejdřív se sama nabídnou nadcházející akce s přihlášením, za nimi vaše volby.' }),
    formNote: f.text().label({ en: 'Form: note under the button', cs: 'Formulář: poznámka u tlačítka' }),
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
  blocks: { opening, year, events, help, accounts, documents, people, news, contact, text: richText, ...kitEntryBlocks(), ...kitSections() },
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
  formsPlugin(), // the messages of the form below
]

// ── the message form ──
// The website draws it per look (the kit's useSiteForm). It is a sign-up for an event, a
// membership application, a question about a gift or a plain message: the topic is a choice the
// website builds from the coming events and the topics the association lists in the block.
export const Contact = defineForm('contact', {
  label: { en: 'Messages', cs: 'Zprávy' },
  labelSingular: { en: 'Message', cs: 'Zpráva' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    contact: f.text({ required: true, max: 200 }).label({ en: 'E-mail or phone', cs: 'E-mail nebo telefon' }),
    topic: f.text({ max: 300 }).optional().label({ en: 'What the message is about', cs: 'Čeho se zpráva týká' })
      .help({ en: 'An event to sign up for, membership, a gift or something else.', cs: 'Akce, na kterou se přihlašuje, členství, dar nebo něco jiného.' }),
    message: f.text({ multiline: true, max: 5000 }).optional().label({ en: 'Message', cs: 'Zpráva' })
      .help({ en: 'How many of you are coming, whether you have your own spade…', cs: 'Kolik vás přijde, jestli máte vlastní rýč…' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send message', cs: 'Odeslat zprávu' },
  successMessage: { en: 'Thank you, your message is on its way. We answer within two days.', cs: 'Děkujeme, zpráva je na cestě. Odpovídáme do dvou dnů.' },
})
export const FormSettings = defineFormSettings()
