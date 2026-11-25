import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Shop template: what the shopkeeper can write and change. One model
// for all three looks (looks.ts): a look decides how a block is drawn, never what it holds.
// It is a shop with a door, not an online shop: goods are shown with their prices and nothing
// is sold on the website. A visitor asks or has something put aside, and pays at the counter.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou.',
  en: 'Text between *asterisks* stands out, for example in italics.',
}

// The days of the week, in the order the opening hours are written.
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

// The icons a service can wear (Lucide's names; only Na háčku draws them).
const ICONS = ['key-round', 'scissors', 'hammer', 'calendar-days', 'ruler', 'truck', 'wrench', 'package', 'paintbrush', 'shovel', 'lightbulb', 'gift'] as const

// ── the whole shop: name, address, hours, contacts ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'Your shop’s name, address, opening hours, contacts, look and colours.', cs: 'Název obchodu, adresa, otevírací doba, kontakty, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'tagline'] },
      { label: { en: 'Where and when', cs: 'Kde a kdy' }, fields: ['address', 'postalCode', 'town', 'locationNote', 'hours', 'hoursNote'] },
      { label: { en: 'Contacts', cs: 'Kontakty' }, fields: ['phone', 'mobile', 'email', 'ctaLabel', 'ctaUrl'] },
      { label: { en: 'Business details', cs: 'Provozovatel' }, fields: ['operator', 'companyId', 'vatId', 'register'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Shop name', cs: 'Název obchodu' })
      .help({ en: 'It stands in the header and the footer of every page. Shopfront sets it large on the fascia board.', cs: 'Stojí v záhlaví a v zápatí každé stránky. Vzhled Portál ho vysází velkými písmeny na štít nad výlohou.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload a logo to show it in the header in place of the name (Shopfront), or beside it (Shelf, On the Hook).', cs: 'Nahrajte logo a zobrazí se v záhlaví místo názvu (Portál), nebo vedle něj (Regál, Na háčku).' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    tagline: f.text().optional().label({ en: 'What the shop is', cs: 'Druh obchodu' })
      .help({ en: 'Two or three words with a slash between them, for example “Household goods / Hardware”. Shopfront sets the parts left and right of its name board, Shelf writes them beside the name.', cs: 'Dvě tři slova oddělená lomítkem, například „Domácí potřeby / Železářství“. Portál je napíše po stranách štítu se jménem, Regál vedle názvu.' }),
    address: f.text().optional().label({ en: 'Street and number', cs: 'Ulice a číslo' })
      .help({ en: 'For example “Wide Street 58”.', cs: 'Například „Široká 58“.' }),
    postalCode: f.text().optional().label({ en: 'Postcode', cs: 'PSČ' }),
    town: f.text().optional().label({ en: 'Town', cs: 'Město' }),
    locationNote: f.text().optional().label({ en: 'Where exactly', cs: 'Upřesnění polohy' })
      .help({ en: 'A sentence for people looking for the door, for example “Opposite the chemist’s, two minutes from the square.”', cs: 'Věta pro ty, kdo hledají dveře, například „Naproti lékárně, dvě minuty z náměstí.“' }),
    hours: f.list({
      fields: {
        day: f.select({
          options: DAYS, default: 'mon',
          labels: {
            mon: { en: 'Monday', cs: 'Pondělí' }, tue: { en: 'Tuesday', cs: 'Úterý' }, wed: { en: 'Wednesday', cs: 'Středa' }, thu: { en: 'Thursday', cs: 'Čtvrtek' },
            fri: { en: 'Friday', cs: 'Pátek' }, sat: { en: 'Saturday', cs: 'Sobota' }, sun: { en: 'Sunday', cs: 'Neděle' },
          },
        }).label({ en: 'Day', cs: 'Den' }),
        from: f.text({ required: true, max: 5 }).label({ en: 'Opens', cs: 'Otevíráte' }).help({ en: 'For example 7:30.', cs: 'Například 7:30.' }),
        to: f.text({ required: true, max: 5 }).label({ en: 'Closes', cs: 'Zavíráte' }).help({ en: 'For example 17:00.', cs: 'Například 17:00.' }),
      },
      max: 21, itemLabel: { en: 'Opening hours', cs: 'Otevírací doba' },
    }).label({ en: 'Opening hours', cs: 'Otevírací doba' })
      .help({ en: 'One row for each stretch you are open. A day you leave out is closed; a day with a lunch break has two rows. The website works out “Open now” and today’s hours from these.', cs: 'Jeden řádek pro každý úsek, kdy máte otevřeno. Den, který vynecháte, je zavřený; den s polední pauzou má dva řádky. Z nich web počítá „Otevřeno“ a dnešní hodiny.' }),
    hoursNote: f.text().optional().label({ en: 'Note to the hours', cs: 'Poznámka k otevírací době' })
      .help({ en: 'Holidays, stocktaking, a day you are closed.', cs: 'Svátky, inventura, den, kdy máte zavřeno.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    mobile: f.text().optional().label({ en: 'Mobile for texts and WhatsApp', cs: 'Mobil pro SMS a WhatsApp' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' })
      .help({ en: 'Shelf and On the Hook show it as a button beside the menu; Shopfront has the phone number there instead.', cs: 'Regál a Na háčku ho ukážou jako tlačítko vedle menu; Portál tam má telefonní číslo.' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    operator: f.text().optional().label({ en: 'Operator', cs: 'Provozovatel' })
      .help({ en: 'The name in the footer and in the copyright line.', cs: 'Jméno v zápatí a v řádku s copyrightem.' }),
    companyId: f.text().optional().label({ en: 'Company number', cs: 'IČO' }),
    vatId: f.text().optional().label({ en: 'VAT number', cs: 'DIČ' }),
    register: f.text().optional().label({ en: 'Entered in the register', cs: 'Zápis v rejstříku' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── the departments of the shop ──
export const Range = defineEntity('range', {
  label: { en: 'Departments', cs: 'Sortiment' },
  labelSingular: { en: 'Department', cs: 'Oddělení' },
  description: { en: 'What you sell, by department, with the price range. Drag to put them in order.', cs: 'Co prodáváte, po odděleních, s rozpětím cen. Pořadí změníte přetažením.' },
  icon: 'i-lucide-store',
  titleField: 'name',
  admin: { list: { columns: ['name', 'priceFrom', 'priceTo'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'Any shape. Shelf keeps it as it is, Shopfront cuts it to 4:3 and On the Hook to a circle.', cs: 'Libovolného tvaru. Regál ji nechá, jak je, Portál ji ořízne na 4:3 a Na háčku na kruh.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'In your own words', cs: 'Vašimi slovy' })
      .help({ en: 'One or two sentences in the shopkeeper’s voice. Leave out the quotation marks: the website adds them.', cs: 'Jedna dvě věty hlasem prodavače. Uvozovky nepište, web je doplní.' }),
    makers: f.text().optional().label({ en: 'Makers and brands', cs: 'Značky a výrobci' })
      .help({ en: 'Plain text, as you want it written.', cs: 'Prostý text, tak, jak ho chcete napsat.' }),
    priceFrom: f.number({ int: true, min: 0 }).optional().label({ en: 'Prices from (Kč)', cs: 'Ceny od (Kč)' }),
    priceTo: f.number({ int: true, min: 0 }).optional().label({ en: 'Prices to (Kč)', cs: 'Ceny do (Kč)' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['image'] },
})

// ── the goods in the window this week ──
export const Product = defineEntity('product', {
  label: { en: 'Featured products', cs: 'Vybrané zboží' },
  labelSingular: { en: 'Product', cs: 'Zboží' },
  description: { en: 'What stands in the window this week, with its price. Nothing is sold on the website: visitors ask, or have it put aside.', cs: 'Co je tento týden ve výloze, s cenou. Na webu se nic neprodává: zákazníci se zeptají nebo si zboží nechají odložit.' },
  icon: 'i-lucide-package',
  titleField: 'name',
  admin: { list: { columns: ['name', 'price', 'tag'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'Shown square. For a photograph that shows several things in a row, say below which part to show.', cs: 'Zobrazí se čtvercově. Když fotografie ukazuje několik věcí vedle sebe, níže řeknete, kterou část ukázat.' }),
    cropX: f.number({ int: false, min: 0, max: 100 }).optional().label({ en: 'Part to show: from the left (%)', cs: 'Ukázat část: zleva (%)' })
      .help({ en: 'Where the middle of the thing is, from the left edge of the photograph. Leave the three empty to show the whole photograph.', cs: 'Kde je střed věci od levého okraje fotografie. Nechte všechna tři pole prázdná a ukáže se celá fotografie.' }),
    cropY: f.number({ int: false, min: 0, max: 100 }).optional().label({ en: 'Part to show: from the top (%)', cs: 'Ukázat část: shora (%)' }),
    zoom: f.number({ min: 50, max: 400 }).optional().label({ en: 'Part to show: how close (%)', cs: 'Ukázat část: přiblížení (%)' })
      .help({ en: '100 shows a third of the photograph’s width, a higher number comes closer.', cs: '100 ukáže třetinu šířky fotografie, vyšší číslo přiblíží.' }),
    price: f.number({ int: true, min: 0 }).optional().label({ en: 'Price (Kč)', cs: 'Cena (Kč)' }),
    tag: f.text({ max: 40 }).optional().label({ en: 'Label', cs: 'Štítek' })
      .help({ en: 'A few words on the photograph, for example “Just arrived”, “Last piece”, “Gift tip”. Shopfront writes it above the name.', cs: 'Pár slov na fotografii, například „Právě dorazilo“, „Poslední kus“, „Tip na dárek“. Portál ho napíše nad název.' }),
    tagKind: f.select({
      options: ['new', 'last', 'gift', 'order'] as const, default: 'new',
      labels: { new: { en: 'Just arrived', cs: 'Právě dorazilo' }, last: { en: 'Last piece', cs: 'Poslední kus' }, gift: { en: 'Gift tip', cs: 'Tip na dárek' }, order: { en: 'On order', cs: 'Na objednávku' } },
    }).label({ en: 'Kind of label', cs: 'Druh štítku' })
      .help({ en: 'The colour the label wears: Shelf and On the Hook dress these four kinds differently. Shopfront writes every label alike.', cs: 'V jaké barvě štítek je: Regál a Na háčku tyto čtyři druhy oblékají různě. Portál píše všechny štítky stejně.' }),
    note: f.text().optional().label({ en: 'Note', cs: 'Poznámka' })
      .help({ en: 'Availability in a sentence: “In stock.”', cs: 'Dostupnost jednou větou: „Skladem.“' }),
    holdLabel: f.text({ max: 20 }).optional().label({ en: 'Second button', cs: 'Druhé tlačítko' })
      .help({ en: 'The first button asks whether you have it. The second says “Put aside” unless you write another word, for example “Order”.', cs: 'První tlačítko se ptá, zda to máte. Druhé říká „Odložit“, dokud nenapíšete jiné slovo, třeba „Objednat“.' }),
    showUntil: f.datetime({ allDay: true }).optional().label({ en: 'Show until', cs: 'Zobrazit do' })
      .help({ en: 'After this day the product drops out of the window by itself. Leave empty to keep it.', cs: 'Po tomto dni zboží z výlohy samo zmizí. Nechte prázdné, aby zůstalo.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['image'] },
})

// ── what you do at the counter ──
export const Service = defineEntity('service', {
  label: { en: 'Services', cs: 'Služby' },
  labelSingular: { en: 'Service', cs: 'Služba' },
  description: { en: 'Key cutting, sharpening, hire: the price list. Drag to put it in order.', cs: 'Klíče, broušení, půjčovna: ceník. Pořadí změníte přetažením.' },
  icon: 'i-lucide-key-round',
  titleField: 'name',
  admin: { list: { columns: ['name', 'price'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
    price: f.text().optional().label({ en: 'Price', cs: 'Cena' })
      .help({ en: 'As you want it written: “from 60 Kč”, “included in the goods”.', cs: 'Tak, jak ji chcete napsat: „od 60 Kč“, „v ceně zboží“.' }),
    icon: f.select({
      options: ICONS, default: 'wrench',
      labels: {
        'key-round': { en: 'Key', cs: 'Klíč' }, 'scissors': { en: 'Scissors', cs: 'Nůžky' }, 'hammer': { en: 'Hammer', cs: 'Kladivo' }, 'calendar-days': { en: 'Calendar', cs: 'Kalendář' },
        'ruler': { en: 'Ruler', cs: 'Metr' }, 'truck': { en: 'Van', cs: 'Dodávka' }, 'wrench': { en: 'Spanner', cs: 'Klíč na šrouby' }, 'package': { en: 'Parcel', cs: 'Balík' },
        'paintbrush': { en: 'Brush', cs: 'Štětec' }, 'shovel': { en: 'Spade', cs: 'Rýč' }, 'lightbulb': { en: 'Light bulb', cs: 'Žárovka' }, 'gift': { en: 'Gift', cs: 'Dárek' },
      },
    }).label({ en: 'Icon', cs: 'Ikona' })
      .help({ en: 'On the Hook draws it in a circle before the name; the other looks do not show it.', cs: 'Na háčku ji nakreslí v kolečku před názvem; ostatní vzhledy ji nezobrazují.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── news from the shop ──
export const News = defineEntity('news', {
  label: { en: 'News', cs: 'Novinky' },
  labelSingular: { en: 'News item', cs: 'Novinka' },
  description: { en: 'What is new in the shop: a delivery, a day you are closed. The newest come first.', cs: 'Co je v krámě nového: dodávka, den, kdy máte zavřeno. Nejnovější jsou první.' },
  icon: 'i-lucide-newspaper',
  titleField: 'title',
  admin: { list: { columns: ['date', 'title'] } },
  fields: {
    date: f.datetime({ allDay: true }).label({ en: 'Date', cs: 'Datum' }),
    title: f.text({ required: true }).label({ en: 'Headline', cs: 'Titulek' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
  },
  content: { public: true },
})

// ── the people behind the counter ──
export const Person = defineEntity('person', {
  label: { en: 'Behind the counter', cs: 'Za pultem' },
  labelSingular: { en: 'Person', cs: 'Člověk' },
  description: { en: 'The people customers meet. Drag to put them in order.', cs: 'Lidé, které zákazníci potkají. Pořadí změníte přetažením.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  admin: { list: { columns: ['name', 'role'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    role: f.text().optional().label({ en: 'Role', cs: 'Role' })
      .help({ en: 'For example “owner, behind the counter since 1996”.', cs: 'Například „majitel, za pultem od roku 1996“.' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'A portrait, 4:5 works best.', cs: 'Portrét, nejlépe 4:5.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'A few words', cs: 'Pár slov' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['image'] },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Part>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).optional().label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).label({ en, cs })

const intro = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'A photograph of the shop, a heading and two buttons, with today’s hours, the address and the phone from Site settings and the “Open now” sign.', cs: 'Fotografie krámu, nadpis a dvě tlačítka, s dnešními hodinami, adresou a telefonem z Nastavení webu a cedulkou „Otevřeno“.' },
  icon: 'i-lucide-door-open',
  fields: {
    eyebrow: eyebrow().help({ en: 'Shelf writes it above the heading, the parts between slashes apart; On the Hook as a pill; Shopfront does not show it.', cs: 'Regál ji napíše nad nadpis, části mezi lomítky odděleně; Na háčku v kapslí; Portál ji nezobrazuje.' }),
    heading: heading(),
    text: text(),
    image: photo('Photograph of the shop', 'Fotografie krámu')
      .help({ en: 'A view into the shop works best. Shopfront shows it as the window behind its glazing bars.', cs: 'Nejlépe pohled do prodejny. Portál ji ukáže jako výlohu za okenními příčkami.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Second button text', cs: 'Text druhého tlačítka' }),
    secondaryUrl: link('Second button destination', 'Cíl druhého tlačítka'),
    phoneNote: f.text().label({ en: 'Line under the phone number', cs: 'Řádek pod telefonním číslem' })
      .help({ en: 'Only Shopfront shows it, in its row of three panels under the window.', cs: 'Ukáže ji jen Portál, v řadě tří panelů pod výlohou.' }),
  },
})

const ranges = defineBlock({
  label: { en: 'Departments', cs: 'Sortiment' },
  description: { en: 'The departments of the shop with their price ranges, from the Departments section.', cs: 'Oddělení krámu s rozpětím cen, ze sekce Sortiment.' },
  icon: 'i-lucide-store',
  fields: {
    eyebrow: eyebrow().help({ en: 'Shelf does not show it.', cs: 'Regál ji nezobrazuje.' }),
    heading: heading().help({ en: 'A slash in the heading is set apart by Shelf: “Departments / six of them”.', cs: 'Lomítko v nadpisu Regál graficky oddělí: „Sortiment / šest oddělení“.' }),
    text: text(),
  },
})

const picks = defineBlock({
  label: { en: 'Featured products', cs: 'Vybrané zboží' },
  description: { en: 'What is in the window this week, from the Featured products section. “Ask” and “Put aside” fill in the enquiry form.', cs: 'Co je tento týden ve výloze, ze sekce Vybrané zboží. Tlačítka „Zeptat se“ a „Odložit“ vyplní dotazový formulář.' },
  icon: 'i-lucide-package',
  fields: {
    eyebrow: eyebrow().help({ en: 'Only Shopfront shows it.', cs: 'Ukáže ji jen Portál.' }),
    heading: heading(),
    text: text(),
    count: f.number({ int: true, min: 1, max: 24 }).label({ en: 'How many to show', cs: 'Kolik jich ukázat' })
      .help({ en: 'The first products in the order of the section, without those whose “show until” day has passed.', cs: 'Prvních několik zboží podle pořadí v sekci, bez těch, kterým uplynulo „zobrazit do“.' }),
    emptyTitle: f.text().label({ en: 'The empty place: heading', cs: 'Prázdné místo: nadpis' })
      .help({ en: 'Only Shelf has it: the last place on the shelf is empty and leads to the enquiry form.', cs: 'Má ho jen Regál: poslední místo v regálu je prázdné a vede k dotazovému formuláři.' }),
    emptyText: f.text({ multiline: true }).label({ en: 'The empty place: text', cs: 'Prázdné místo: text' }),
  },
})

const services = defineBlock({
  label: { en: 'Services and price list', cs: 'Služby s ceníkem' },
  description: { en: 'The services from the Services section, with their prices, beside a photograph of the counter.', cs: 'Služby ze sekce Služby s cenami, vedle fotografie pultu.' },
  icon: 'i-lucide-key-round',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    image: photo('Photograph of the counter', 'Fotografie pultu'),
  },
})

const news = defineBlock({
  label: { en: 'News', cs: 'Novinky' },
  description: { en: 'The latest news from the News section.', cs: 'Nejnovější zprávy ze sekce Novinky.' },
  icon: 'i-lucide-newspaper',
  fields: {
    eyebrow: eyebrow().help({ en: 'Shelf does not show it.', cs: 'Regál ji nezobrazuje.' }),
    heading: heading(),
    count: f.number({ int: true, min: 0, max: 48 }).label({ en: 'How many to show', cs: 'Kolik jich ukázat' })
      .help({ en: '0 shows all of them (for a page with all the news).', cs: '0 ukáže všechny (pro stránku se všemi novinkami).' }),
    moreLabel: f.text().label({ en: 'Link to older news: text', cs: 'Odkaz na starší zprávy: text' }),
    moreUrl: link('Link to older news: destination', 'Odkaz na starší zprávy: cíl'),
  },
})

const people = defineBlock({
  label: { en: 'Behind the counter', cs: 'Za pultem' },
  description: { en: 'The shop’s story and the people from the Behind the counter section.', cs: 'Příběh krámu a lidé ze sekce Za pultem.' },
  icon: 'i-lucide-users',
  fields: {
    eyebrow: eyebrow().help({ en: 'Shelf does not show it.', cs: 'Regál ji nezobrazuje.' }),
    heading: heading(),
    text: text(),
    quote: f.text().label({ en: 'A sentence in your voice', cs: 'Věta vaším hlasem' })
      .help({ en: 'Shopfront and On the Hook set it apart; Shelf shows it only in the shop’s panel below. Leave out the quotation marks.', cs: 'Portál a Na háčku ji vyzdvihnou; Regál ji ukáže jen v panelu krámu níže. Uvozovky nepište.' }),
    shopImage: photo('Photograph of the shop (Shelf)', 'Fotografie krámu (Regál)')
      .help({ en: 'Only Shelf has a panel for the shop itself, standing beside the people.', cs: 'Jen Regál má vedle lidí panel pro samotný krám.' }),
    shopTitle: f.text().label({ en: 'Shop panel: name', cs: 'Panel krámu: název' }),
    shopRail: f.text().label({ en: 'Shop panel: short line', cs: 'Panel krámu: krátký řádek' })
      .help({ en: 'For example “since 1992”.', cs: 'Například „od roku 1992“.' }),
    shopText: f.text({ multiline: true }).label({ en: 'Shop panel: text', cs: 'Panel krámu: text' }),
  },
})

const ask = defineBlock({
  label: { en: 'Enquiry and gift vouchers', cs: 'Dotaz a poukazy' },
  description: { en: 'The enquiry form (the Enquiries form), your phone and e-mail from Site settings, and the gift vouchers. The enquiries arrive in the admin.', cs: 'Dotazový formulář (formulář Dotazy), telefon a e-mail z Nastavení webu a dárkové poukazy. Dotazy najdete v administraci.' },
  icon: 'i-lucide-mail-question',
  fields: {
    eyebrow: eyebrow().help({ en: 'On the Hook does not show it.', cs: 'Na háčku ji nezobrazuje.' }),
    heading: heading(),
    text: text(),
    formHeading: f.text().label({ en: 'Heading of the form', cs: 'Nadpis formuláře' })
      .help({ en: 'On the Hook has none: the heading above is the form’s.', cs: 'Na háčku ho nemá: nadpis výše je nadpisem formuláře.' }),
    formText: f.text({ multiline: true }).label({ en: 'Line with the form', cs: 'Řádek u formuláře' })
      .help({ en: 'Shopfront writes it above the fields, Shelf under the button, On the Hook does not show it.', cs: 'Portál ho napíše nad políčka, Regál pod tlačítko, Na háčku ho nezobrazuje.' }),
    voucherLabel: f.text().label({ en: 'Voucher: name', cs: 'Poukaz: název' }),
    voucherValues: f.text().label({ en: 'Voucher: values', cs: 'Poukaz: hodnoty' })
      .help({ en: 'For example “300, 500 and 1 000 Kč”.', cs: 'Například „300, 500 a 1 000 Kč“.' }),
    voucherValidity: f.text().label({ en: 'Voucher: validity', cs: 'Poukaz: platnost' })
      .help({ en: 'For example “valid for a year”. Only Shelf writes it in the voucher’s header.', cs: 'Například „platí rok“. V záhlaví poukazu ji napíše jen Regál.' }),
    voucherText: f.text({ multiline: true }).label({ en: 'Voucher: text', cs: 'Poukaz: text' }),
  },
})

const where = defineBlock({
  label: { en: 'Where and when', cs: 'Kde a kdy' },
  description: { en: 'The opening hours, the address and the way there from Site settings, a photograph of the front and a drawn sketch of the street.', cs: 'Otevírací doba, adresa a cesta z Nastavení webu, fotografie průčelí a nakreslený plánek ulice.' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow().help({ en: 'Shelf does not show it.', cs: 'Regál ji nezobrazuje.' }),
    heading: heading(),
    image: photo('Photograph of the front', 'Fotografie průčelí'),
    ways: f.list({
      fields: {
        icon: f.select({
          options: ['car', 'bike', 'footprints', 'bus', 'train', 'map-pin'] as const, default: 'car',
          labels: { 'car': { en: 'Car', cs: 'Auto' }, 'bike': { en: 'Bicycle', cs: 'Kolo' }, 'footprints': { en: 'On foot', cs: 'Pěšky' }, 'bus': { en: 'Bus', cs: 'Autobus' }, 'train': { en: 'Train', cs: 'Vlak' }, 'map-pin': { en: 'Pin', cs: 'Špendlík' } },
        }).label({ en: 'Icon', cs: 'Ikona' }).help({ en: 'Only On the Hook draws it.', cs: 'Nakreslí ji jen Na háčku.' }),
        label: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }).help({ en: 'For example “By car”.', cs: 'Například „Autem“.' }),
        title: f.text().label({ en: 'Bold line', cs: 'Tučný řádek' }).help({ en: 'For example “Car park by the walls, 150 m”. Shopfront does not show it.', cs: 'Například „Parkoviště u hradeb, 150 m“. Portál ji nezobrazuje.' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 3, itemLabel: { en: 'Way', cs: 'Cesta' },
    }).label({ en: 'How to get here', cs: 'Jak se k nám dostat' })
      .help({ en: 'The address itself stands first, from Site settings. Add the way by car and by bike.', cs: 'Jako první stojí samotná adresa z Nastavení webu. Přidejte cestu autem a na kole.' }),
    landmark: f.text().label({ en: 'Sketch: landmark', cs: 'Plánek: orientační bod' }).help({ en: 'The square or the corner you walk from, for example “Town Square”.', cs: 'Náměstí nebo roh, odkud se jde, například „Resselovo náměstí“.' }),
    walk: f.text().label({ en: 'Sketch: how long on foot', cs: 'Plánek: jak dlouho pěšky' }).help({ en: 'For example “2 minutes on foot”.', cs: 'Například „2 minuty pěšky“.' }),
    parking: f.text().label({ en: 'Sketch: car park', cs: 'Plánek: parkoviště' }).help({ en: 'Its name without the word “car park”, for example “Na Valech”.', cs: 'Jeho název bez slova „parkoviště“, například „Na Valech“.' }),
    parkingDistance: f.text().label({ en: 'Sketch: distance to the car park', cs: 'Plánek: vzdálenost k parkovišti' }).help({ en: 'For example “150 m”.', cs: 'Například „150 m“.' }),
    across: f.text().label({ en: 'Sketch: opposite what', cs: 'Plánek: naproti čemu' }).help({ en: 'For example “opposite the chemist’s”.', cs: 'Například „naproti lékárně“.' }),
    opposite: f.text().label({ en: 'Sketch: the building opposite', cs: 'Plánek: budova naproti' }).help({ en: 'One word, for example “Chemist”. Only Shelf and On the Hook label it.', cs: 'Jedno slovo, například „Lékárna“. Popíšou ji jen Regál a Na háčku.' }),
    sideStreet: f.text().label({ en: 'Sketch: the side street', cs: 'Plánek: boční ulice' }),
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
  blocks: { intro, ranges, picks, services, news, people, ask, where, text: richText, ...customTypeBlocks() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    footer: { en: 'Links in the footer', cs: 'Odkazy „Na webu“ v zápatí' },
    legal: { en: 'Legal links under the footer', cs: 'Odkazy pod zápatím' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the enquiries of the form below
]

// ── the enquiry form ──
// The website draws it per look (the kit's useSiteForm). “Ask” and “Put aside” on a product
// fill in the message and tick the last box.
export const Enquiry = defineForm('enquiry', {
  label: { en: 'Enquiries', cs: 'Dotazy' },
  labelSingular: { en: 'Enquiry', cs: 'Dotaz' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name', cs: 'Jméno' }).help({ en: 'Jane Smith', cs: 'Jana Nováková' }),
    contact: f.text({ required: true, max: 200 }).label({ en: 'Phone or e-mail', cs: 'Telefon nebo e-mail' }).help({ en: '603 123 456', cs: '603 123 456' }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'What you are looking for', cs: 'Co sháníte' })
      .help({ en: 'For example wood screws 4×40, about a hundred. Or a lid for a jar, 82 mm across.', cs: 'Např. vruty 4×40 do dřeva, asi sto kusů. Nebo víčko na sklenici, průměr 82 mm.' }),
    hold: f.boolean().label({ en: 'Put it aside for me if you have it', cs: 'Pokud to máte, rovnou mi to odložte' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send enquiry', cs: 'Odeslat dotaz' },
  successMessage: { en: 'Sent, we will be in touch.', cs: 'Odesláno, ozveme se.' },
})
export const FormSettings = defineFormSettings()
