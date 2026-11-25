import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Accommodation template: what a guesthouse can write and change. One
// model for both looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou.',
  en: 'Text between *asterisks* stands out, for example in italics.',
}

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const
const MONTH_LABELS = {
  '1': { en: 'January', cs: 'Leden' }, '2': { en: 'February', cs: 'Únor' }, '3': { en: 'March', cs: 'Březen' }, '4': { en: 'April', cs: 'Duben' },
  '5': { en: 'May', cs: 'Květen' }, '6': { en: 'June', cs: 'Červen' }, '7': { en: 'July', cs: 'Červenec' }, '8': { en: 'August', cs: 'Srpen' },
  '9': { en: 'September', cs: 'Září' }, '10': { en: 'October', cs: 'Říjen' }, '11': { en: 'November', cs: 'Listopad' }, '12': { en: 'December', cs: 'Prosinec' },
}

// ── the whole site: who, where, how to reach them ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'Your name, address, contacts, arrival times, the look and the colours.', cs: 'Název ubytování, adresa, kontakty, časy příjezdu, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'tagline', 'look', 'colors'] },
      { label: { en: 'Contacts', cs: 'Kontakty' }, fields: ['phone', 'email', 'arrival', 'departure'] },
      { label: { en: 'Where you are', cs: 'Kde stojíte' }, fields: ['address', 'postalTown', 'altitude', 'coordinates', 'maps'] },
      { label: { en: 'Header and footer', cs: 'Záhlaví a zápatí' }, fields: ['ctaLabel', 'ctaUrl', 'about', 'operator', 'companyId'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name', cs: 'Název' })
      .help({ en: 'The name of the guesthouse, short, for example “Vřesovka”. It stands in the header and the footer.', cs: 'Název ubytování, stručně, například „Vřesovka“. Stojí v záhlaví i v zápatí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the name.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo názvu.' }),
    tagline: f.text().optional().label({ en: 'Line beside the name', cs: 'Řádek vedle názvu' })
      .help({ en: 'A few words after the name in the header, for example “guesthouse · Orlické hory”. Shown on wide screens only.', cs: 'Pár slov za názvem v záhlaví, například „penzion · Orlické hory“. Zobrazí se jen na širokých obrazovkách.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' })
      .help({ en: 'Shown in the header, in the footer and next to the enquiry form.', cs: 'Zobrazí se v záhlaví, v zápatí a u poptávkového formuláře.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    arrival: f.text().optional().label({ en: 'Arrival', cs: 'Příjezd' })
      .help({ en: 'As you want it written, for example “15–19 h”.', cs: 'Tak, jak ho chcete napsat, například „15–19 h“.' }),
    departure: f.text().optional().label({ en: 'Departure', cs: 'Odjezd' })
      .help({ en: 'For example “by 10 h”.', cs: 'Například „do 10 h“.' }),
    address: f.text().optional().label({ en: 'Address', cs: 'Adresa' })
      .help({ en: 'Street and number, or the village and its number.', cs: 'Ulice a číslo, nebo obec a číslo popisné.' }),
    postalTown: f.text().optional().label({ en: 'Postcode and post office', cs: 'PSČ a pošta' })
      .help({ en: 'For example “517 61 Rokytnice v Orlických horách”.', cs: 'Například „517 61 Rokytnice v Orlických horách“.' }),
    altitude: f.text().optional().label({ en: 'Altitude', cs: 'Nadmořská výška' })
      .help({ en: 'For example “720 m”. Shown beside the address in the “Getting here” section.', cs: 'Například „720 m“. Zobrazí se u adresy v části „Jak se k nám dostanete“.' }),
    coordinates: f.text().optional().label({ en: 'Coordinates', cs: 'Souřadnice' })
      .help({ en: 'For example “50.2096N, 16.4563E”.', cs: 'Například „50.2096N, 16.4563E“.' }),
    maps: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Text', cs: 'Text' }).help({ en: 'For example “Mapy.cz”.', cs: 'Například „Mapy.cz“.' }),
        url: f.text({ format: 'url' }).label({ en: 'Link', cs: 'Odkaz' }),
      },
      max: 4, itemLabel: { en: 'Map', cs: 'Mapa' },
    }).label({ en: 'Links to maps', cs: 'Odkazy do map' })
      .help({ en: 'Shown beside the address in the “Getting here” section.', cs: 'Zobrazí se u adresy v části „Jak se k nám dostanete“.' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    about: f.text({ multiline: true }).optional().label({ en: 'Few words about the house', cs: 'Pár slov o domě' })
      .help({ en: 'One or two sentences under the name in the footer.', cs: 'Jedna nebo dvě věty pod názvem v zápatí.' }),
    operator: f.text().optional().label({ en: 'Operator', cs: 'Provozovatel' })
      .help({ en: 'The person or company that runs the guesthouse, with its address.', cs: 'Osoba nebo firma, která ubytování provozuje, s adresou.' }),
    companyId: f.text().optional().label({ en: 'Company number', cs: 'IČO' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── rooms and apartments, each with a page of its own ──
export const Room = defineEntity('room', {
  label: { en: 'Rooms', cs: 'Pokoje' },
  labelSingular: { en: 'Room', cs: 'Pokoj' },
  description: { en: 'Rooms and apartments. Each has a page of its own, /pokoj/…. The prices are in the Prices section.', cs: 'Pokoje a apartmány. Každý má vlastní stránku /pokoj/… Ceny najdete v sekci Ceny pokojů.' },
  icon: 'i-lucide-bed-double',
  titleField: 'name',
  admin: { list: { columns: ['name', 'kind', 'beds', 'area'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' })
      .help({ en: 'Only the name, for example “Jeřabina”. The website adds “Room” or “Apartment” by the type.', cs: 'Jen jméno, například „Jeřabina“. Slovo „Pokoj“ nebo „Apartmán“ web doplní podle typu.' }),
    slug: f.slug({ from: 'name', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    kind: f.select({
      options: ['room', 'apartment'] as const, default: 'room',
      labels: { room: { en: 'Room', cs: 'Pokoj' }, apartment: { en: 'Apartment', cs: 'Apartmán' } },
    }).label({ en: 'Type', cs: 'Typ' }),
    floor: f.select({
      options: ['attic', 'upper', 'ground'] as const, default: 'upper',
      labels: { attic: { en: 'Attic', cs: 'Podkroví' }, upper: { en: 'First floor', cs: '1. patro' }, ground: { en: 'Ground floor', cs: 'Přízemí' } },
    }).label({ en: 'Floor', cs: 'Patro' }),
    beds: f.number({ int: true, min: 1 }).label({ en: 'Beds', cs: 'Počet lůžek' }),
    area: f.number({ int: true, min: 1 }).optional().label({ en: 'Area in m²', cs: 'Plocha v m²' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Krátký text' })
      .help({ en: 'A sentence or two for the room’s card. All Year shows it as written; From the Door shows it with the equipment beneath.', cs: 'Věta nebo dvě na kartu pokoje. Vzhled Celý rok ji ukáže tak, jak je; Ode dveří pod ní přidá vybavení.' }),
    description: f.text({ multiline: true }).optional().label({ en: 'Longer text', cs: 'Delší popis' })
      .help({ en: 'For the room’s own page. An empty line starts a new paragraph. Leave it empty to show the short text.', cs: 'Pro vlastní stránku pokoje. Prázdný řádek začne nový odstavec. Když pole necháte prázdné, ukáže se krátký text.' }),
    equipment: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Item', cs: 'Položka' }) },
      max: 16, itemLabel: { en: 'Item', cs: 'Položka' },
    }).label({ en: 'Equipment', cs: 'Vybavení' })
      .help({ en: 'Short items, for example “shower” or “Wi-Fi”. From the Door shows them as pills on the card, both looks list them on the room’s page.', cs: 'Krátké položky, například „sprcha“ nebo „Wi-Fi“. Ode dveří je ukáže jako štítky na kartě, oba vzhledy je vypíšou na stránce pokoje.' }),
    gallery: f.gallery({ accept: 'image/*', max: 30 }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'The first photo is the one on the card; the card also counts the photos. Drag to change the order.', cs: 'První fotografie je ta na kartě pokoje, karta fotografie i spočítá. Pořadí změníte přetažením.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
    ...seo(),
  },
  content: { public: true, slug: 'slug', path: '/pokoj/:slug', populate: ['gallery', 'ogImage'] },
})

// ── seasons: the year in parts with different prices ──
export const Season = defineEntity('season', {
  label: { en: 'Seasons', cs: 'Sezóny' },
  labelSingular: { en: 'Season', cs: 'Sezóna' },
  description: { en: 'The parts of the year with their own prices. They draw the ribbon of twelve months, the price table and the “from” prices.', cs: 'Části roku s vlastními cenami. Podle nich se kreslí pás dvanácti měsíců, ceník a ceny „od“.' },
  icon: 'i-lucide-calendar-range',
  titleField: 'name',
  admin: { list: { columns: ['name', 'tone', 'minNights'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }).help({ en: 'For example “Main season”.', cs: 'Například „Hlavní sezóna“.' }),
    shortName: f.text().optional().label({ en: 'Short name', cs: 'Zkrácený název' })
      .help({ en: 'For narrow places, such as a room’s card: “Main”. Leave it empty to use the name.', cs: 'Pro úzká místa, třeba kartu pokoje: „Hlavní“. Když pole necháte prázdné, použije se název.' }),
    tone: f.select({
      options: ['off', 'main', 'special'] as const, default: 'off',
      labels: { off: { en: 'Off season (quiet)', cs: 'Mimo sezónu (tlumená)' }, main: { en: 'Main season (the brand colour)', cs: 'Hlavní sezóna (barva značky)' }, special: { en: 'Special days (Christmas)', cs: 'Zvláštní dny (Vánoce)' } },
    }).label({ en: 'Colour on the ribbon', cs: 'Barva v pásu roku' })
      .help({ en: 'How the season is coloured wherever the year is drawn.', cs: 'Jak se sezóna zabarví všude, kde se kreslí rok.' }),
    minNights: f.number({ int: true, min: 1 }).optional().label({ en: 'Shortest stay (nights)', cs: 'Nejkratší pobyt (noci)' }),
    ranges: f.list({
      fields: {
        from: f.datetime({ allDay: true }).label({ en: 'From', cs: 'Od' }).help({ en: 'Only the day and the month count; the year does not matter.', cs: 'Počítá se jen den a měsíc, na roce nezáleží.' }),
        to: f.datetime({ allDay: true }).label({ en: 'To', cs: 'Do' }).help({ en: 'The last day. A range may run over New Year (20. 12. – 1. 1.).', cs: 'Poslední den. Rozmezí smí přejít přes Silvestra (20. 12. – 1. 1.).' }),
        label: f.text().label({ en: 'Name on the ribbon', cs: 'Popisek v pásu' }).help({ en: 'For example “Winter”. All Year writes it on the ribbon, before the name of the season.', cs: 'Například „Zima“. Vzhled Celý rok jej napíše do pásu před název sezóny.' }),
      },
      max: 6, itemLabel: { en: 'Range', cs: 'Rozmezí' },
    }).label({ en: 'When it is', cs: 'Kdy platí' })
      .help({ en: 'One range, or several when the season has two parts (winter and summer). Together the seasons should cover the whole year.', cs: 'Jedno rozmezí, nebo víc, když má sezóna dvě části (zima a léto). Dohromady mají sezóny pokrýt celý rok.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the price of one room in one season ──
export const RoomPrice = defineEntity('roomPrice', {
  label: { en: 'Prices', cs: 'Ceny pokojů' },
  labelSingular: { en: 'Price', cs: 'Cena' },
  description: { en: 'One row for each room in each season: the price of a night with breakfast, for the whole room.', cs: 'Jeden řádek pro každý pokoj v každé sezóně: cena za noc se snídaní za celý pokoj.' },
  icon: 'i-lucide-banknote',
  titleField: 'label',
  admin: { list: { columns: ['label', 'amount'] } },
  fields: {
    label: f.text({ required: true }).label({ en: 'Name in the list', cs: 'Název v seznamu' })
      .help({ en: 'Only for your own list, for example “Jeřabina · Off season”. It does not show on the website.', cs: 'Jen pro váš seznam, například „Jeřabina · Mimo sezónu“. Na webu se nezobrazí.' }),
    room: f.relation({ to: () => Room, kind: 'many-to-one', required: true, onDelete: 'cascade' }).label({ en: 'Room', cs: 'Pokoj' }),
    season: f.relation({ to: () => Season, kind: 'many-to-one', required: true, onDelete: 'cascade' }).label({ en: 'Season', cs: 'Sezóna' }),
    amount: f.number({ int: true, min: 0 }).label({ en: 'Price per night in Kč', cs: 'Cena za noc v Kč' })
      .help({ en: 'The cheapest of a room’s prices is shown as “from”.', cs: 'Nejnižší z cen pokoje se na webu ukáže jako „od“.' }),
  },
  content: { public: true, populate: ['room', 'season'] },
})

// ── what the house offers ──
export const Feature = defineEntity('feature', {
  label: { en: 'In the house', cs: 'V domě' },
  labelSingular: { en: 'Feature', cs: 'Vybavení domu' },
  description: { en: 'What the house offers: the sauna, the dining room, the garden.', cs: 'Co dům nabízí: saunu, jídelnu, zahradu.' },
  icon: 'i-lucide-house',
  titleField: 'name',
  admin: { list: { columns: ['name', 'where'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
    where: f.text().optional().label({ en: 'Where', cs: 'Kde' })
      .help({ en: 'The distance from the rooms: “14 steps”, “20 m”, “everywhere”. From the Door shows it beside the name; All Year does not.', cs: 'Vzdálenost od pokojů: „14 schodů“, „20 m“, „všude“. Ode dveří ji ukáže vedle názvu, Celý rok ne.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── things to do nearby ──
export const Trip = defineEntity('trip', {
  label: { en: 'Trips', cs: 'Výlety' },
  labelSingular: { en: 'Trip', cs: 'Výlet' },
  description: { en: 'Tips for days out, with the distance from the door and the time of the year they suit.', cs: 'Tipy na výlety, se vzdáleností od dveří a obdobím, kdy se hodí.' },
  icon: 'i-lucide-mountain',
  titleField: 'name',
  admin: { list: { columns: ['name', 'distance'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    distance: f.text({ required: true, max: 20 }).label({ en: 'Distance', cs: 'Vzdálenost' }).help({ en: 'For example “600 m” or “3,5 km”.', cs: 'Například „600 m“ nebo „3,5 km“.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
    spring: f.boolean().label({ en: 'Spring', cs: 'Jaro' }).help({ en: 'The four seasons drive the filter above the list and the pills of From the Door. All four on means “all year”.', cs: 'Čtyři roční období řídí filtr nad seznamem a štítky ve vzhledu Ode dveří. Všechna čtyři znamenají „celý rok“.' }),
    summer: f.boolean().label({ en: 'Summer', cs: 'Léto' }),
    autumn: f.boolean().label({ en: 'Autumn', cs: 'Podzim' }),
    winter: f.boolean().label({ en: 'Winter', cs: 'Zima' }),
    fromMonth: f.select({ options: MONTHS, labels: MONTH_LABELS }).optional().label({ en: 'First month', cs: 'První měsíc' })
      .help({ en: 'All Year draws the months the trip suits as a small year. Leave both months empty for all year; a trip may run over New Year (December to March).', cs: 'Vzhled Celý rok kreslí měsíce, kdy se výlet hodí, jako malý rok. Když necháte oba měsíce prázdné, platí celý rok; výlet smí přejít přes Silvestra (prosinec až březen).' }),
    toMonth: f.select({ options: MONTHS, labels: MONTH_LABELS }).optional().label({ en: 'Last month', cs: 'Poslední měsíc' }),
    tag: f.text().optional().label({ en: 'Extra tag', cs: 'Doplňující štítek' })
      .help({ en: 'For example “when it rains” or “by bike”. From the Door shows it as a pill.', cs: 'Například „když prší“ nebo „na kole“. Ode dveří ho ukáže jako štítek.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── what guests wrote ──
export const Review = defineEntity('review', {
  label: { en: 'Reviews', cs: 'Recenze' },
  labelSingular: { en: 'Review', cs: 'Recenze' },
  description: { en: 'What guests said, with their name, the month of the stay and the room.', cs: 'Co hosté napsali, se jménem, měsícem pobytu a pokojem.' },
  icon: 'i-lucide-quote',
  titleField: 'name',
  admin: { list: { columns: ['name', 'town', 'stayed'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    town: f.text().optional().label({ en: 'Town', cs: 'Město' }),
    stayed: f.datetime({ allDay: true }).optional().label({ en: 'Month of the stay', cs: 'Měsíc pobytu' })
      .help({ en: 'Any day of that month. All Year also marks the month on a small year.', cs: 'Libovolný den toho měsíce. Vzhled Celý rok měsíc označí i na malém roce.' }),
    room: f.relation({ to: () => Room, kind: 'many-to-one', onDelete: 'set null' }).label({ en: 'Room', cs: 'Pokoj' }),
    text: f.text({ required: true, multiline: true, max: 700 }).label({ en: 'Text', cs: 'Text' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['room'] },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).label({ en, cs })

const opening = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The heading, a photo of the house and a short form that starts an enquiry.', cs: 'Nadpis, fotografie domu a krátký formulář, kterým host začne poptávku.' },
  icon: 'i-lucide-panel-top',
  fields: {
    eyebrow: eyebrow().help({ en: 'For example “Říčky, 720 m above the sea”.', cs: 'Například „Říčky v Orlických horách · 720 m n. m.“.' }),
    heading: f.text({ required: true }).label({ en: 'Heading', cs: 'Nadpis' })
      .help({ en: 'The first sentence between *asterisks* stands on a line of its own in From the Door; All Year writes the heading in one run.', cs: 'První věta mezi *hvězdičkami* stojí ve vzhledu Ode dveří na samostatném řádku; Celý rok píše nadpis vcelku.' }),
    text: text(),
    distances: f.list({
      fields: {
        value: f.text({ required: true, max: 20 }).label({ en: 'Distance', cs: 'Vzdálenost' }).help({ en: 'For example “600 m”.', cs: 'Například „600 m“.' }),
        label: f.text({ required: true }).label({ en: 'To where', cs: 'Kam' }).help({ en: 'For example “to the ski slope”.', cs: 'Například „na sjezdovku“.' }),
      },
      max: 4, itemLabel: { en: 'Distance', cs: 'Vzdálenost' },
    }).label({ en: 'Distances from the door', cs: 'Vzdálenosti ode dveří' })
      .help({ en: 'From the Door shows up to three under the heading; All Year does not show them.', cs: 'Ode dveří ukáže až tři pod nadpisem; Celý rok je neukáže.' }),
    image: photo('Photo of the house', 'Fotografie domu'),
    secondImage: photo('Second photo', 'Druhá fotografie')
      .help({ en: 'From the Door tucks it into the corner of the first one, on wide screens. All Year does not use it.', cs: 'Ode dveří ji na širokých obrazovkách položí do rohu první fotografie. Celý rok ji nepoužije.' }),
    quickButton: f.text().label({ en: 'Button of the short form', cs: 'Tlačítko krátkého formuláře' }).help({ en: 'For example “Check availability”. It carries the dates and the guests to the enquiry form below.', cs: 'Například „Zjistit, zda je volno“. Přenese termín a počet hostů do poptávkového formuláře níže.' }),
    quickNote: f.text().label({ en: 'Line under the short form', cs: 'Řádek pod krátkým formulářem' }),
  },
})

const year = defineBlock({
  label: { en: 'The year', cs: 'Rok a sezóny' },
  description: { en: 'The seasons of the year with their dates, the shortest stay and the price from. All Year draws them as a ribbon of twelve months with today marked.', cs: 'Sezóny roku s daty, nejkratším pobytem a cenou od. Celý rok je nakreslí jako pás dvanácti měsíců s označeným dneškem.' },
  icon: 'i-lucide-calendar-range',
  fields: {
    heading: heading(),
    text: text().help({ en: 'An empty line starts a new paragraph.', cs: 'Prázdný řádek začne nový odstavec.' }),
  },
})

const rooms = defineBlock({
  label: { en: 'Rooms', cs: 'Pokoje' },
  description: { en: 'The rooms and apartments from the Rooms section, each leading to its own page.', cs: 'Pokoje a apartmány ze sekce Pokoje, každý odkazuje na svou stránku.' },
  icon: 'i-lucide-bed-double',
  fields: {
    heading: heading(),
    text: text(),
  },
})

const prices = defineBlock({
  label: { en: 'Prices', cs: 'Ceník' },
  description: { en: 'The table of rooms by season, what is included, the extra charges and what is good to know.', cs: 'Tabulka pokojů podle sezón, co je v ceně, příplatky a co je dobré vědět.' },
  icon: 'i-lucide-banknote',
  fields: {
    heading: heading(),
    text: text(),
    includedHeading: f.text().label({ en: 'Heading of what is included', cs: 'Nadpis „v ceně“' }),
    included: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }),
        text: f.text().label({ en: 'Detail', cs: 'Podrobnost' }),
      },
      max: 12, itemLabel: { en: 'Item', cs: 'Položka' },
    }).label({ en: 'What is included', cs: 'Co je v ceně' }),
    extrasHeading: f.text().label({ en: 'Heading of the extra charges', cs: 'Nadpis příplatků' }),
    extras: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }),
        note: f.text().label({ en: 'Small note', cs: 'Malá poznámka' }).help({ en: 'For example “(18+)”.', cs: 'Například „(18+)“.' }),
        price: f.text({ required: true }).label({ en: 'Price', cs: 'Cena' }).help({ en: 'As you want it written: “150 Kč / night”.', cs: 'Tak, jak ji chcete napsat: „150 Kč / noc“.' }),
      },
      max: 12, itemLabel: { en: 'Charge', cs: 'Příplatek' },
    }).label({ en: 'Extra charges', cs: 'Příplatky' }),
    notesHeading: f.text().label({ en: 'Heading of the notes', cs: 'Nadpis poznámek' })
      .help({ en: 'All Year puts the notes in a third column under this heading; From the Door writes them as one paragraph beneath, without a heading.', cs: 'Celý rok dá poznámky do třetího sloupce pod tento nadpis; Ode dveří je napíše pod ceník jako jeden odstavec, bez nadpisu.' }),
    notes: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }) },
      max: 8, itemLabel: { en: 'Line', cs: 'Řádek' },
    }).label({ en: 'Good to know', cs: 'Dobré vědět' }),
  },
})

const house = defineBlock({
  label: { en: 'In the house', cs: 'V domě' },
  description: { en: 'What the house offers, from the In the house section, beside a photograph.', cs: 'Co dům nabízí, ze sekce V domě, vedle fotografie.' },
  icon: 'i-lucide-house',
  fields: {
    heading: heading(),
    text: text().help({ en: 'A line under the heading. All Year does not show it.', cs: 'Řádek pod nadpisem. Celý rok ho neukáže.' }),
    image: photo(),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'All Year writes it under the photo.', cs: 'Celý rok ho napíše pod fotografii.' }),
  },
})

const trips = defineBlock({
  label: { en: 'Trips', cs: 'Výlety' },
  description: { en: 'The tips from the Trips section, with a filter by season.', cs: 'Tipy ze sekce Výlety, s filtrem podle ročního období.' },
  icon: 'i-lucide-mountain',
  fields: {
    heading: heading(),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 3, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'All Year shows the first one, tall, with its caption; From the Door shows all of them in a row above the list.', cs: 'Celý rok ukáže první, na výšku, s popiskem; Ode dveří je ukáže všechny v řadě nad seznamem.' }),
  },
})

const reviews = defineBlock({
  label: { en: 'Reviews', cs: 'Recenze' },
  description: { en: 'What guests wrote, from the Reviews section.', cs: 'Co hosté napsali, ze sekce Recenze.' },
  icon: 'i-lucide-quote',
  fields: { heading: heading() },
})

const gallery = defineBlock({
  label: { en: 'Photographs', cs: 'Fotografie' },
  description: { en: 'Photos of the house and the countryside, with a link to the whole gallery.', cs: 'Fotografie domu a okolí s odkazem na celou galerii.' },
  icon: 'i-lucide-images',
  fields: {
    heading: heading(),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 24, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Drag to change the order. All Year lays them out as a mosaic that repeats after six photos; From the Door shows them in a row to swipe, with captions.', cs: 'Pořadí změníte přetažením. Celý rok je rozloží do mozaiky, která se po šesti fotografiích opakuje; Ode dveří je ukáže v řadě k posouvání, s popisky.' }),
    moreLabel: f.text().label({ en: 'Link to the whole gallery', cs: 'Text odkazu na celou galerii' }),
    moreUrl: link('Destination of that link', 'Cíl odkazu na galerii').optional(),
    moreCount: f.number({ int: true, min: 0 }).optional().label({ en: 'Number of photos in the whole gallery', cs: 'Počet fotografií v celé galerii' })
      .help({ en: 'Written in the link (All Year) or on the last tile (From the Door).', cs: 'Napíše se do odkazu (Celý rok) nebo na poslední dlaždici (Ode dveří).' }),
  },
})

const hosts = defineBlock({
  label: { en: 'Hosts', cs: 'Hostitelé' },
  description: { en: 'A photo of you and a few words about who looks after the guests.', cs: 'Vaše fotografie a pár slov o tom, kdo se o hosty stará.' },
  icon: 'i-lucide-users',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    lead: f.text({ multiline: true }).label({ en: 'First paragraph', cs: 'První odstavec' }).help({ en: 'Set larger.', cs: 'Vysází se větším písmem.' }),
    text: text(),
    image: photo(),
    ctaLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }).help({ en: 'From the Door shows it beside your phone number. All Year shows your arrival, departure and phone instead.', cs: 'Ode dveří ho ukáže vedle telefonu. Celý rok místo toho ukáže příjezd, odjezd a telefon.' }),
    ctaUrl: link('Button destination', 'Cíl tlačítka').optional(),
  },
})

const directions = defineBlock({
  label: { en: 'Getting here', cs: 'Jak se k nám dostat' },
  description: { en: 'The address with the altitude and links to maps from Site settings, and the way here by car and by train and bus.', cs: 'Adresa s nadmořskou výškou a odkazy do map z Nastavení webu a cesta autem, vlakem a autobusem.' },
  icon: 'i-lucide-map-pin',
  fields: {
    heading: heading(),
    placeLabel: f.text().label({ en: 'Line above the address', cs: 'Řádek nad adresou' }).help({ en: 'For example “Where we stand”.', cs: 'Například „Kde stojíme“.' }),
    facts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }),
        value: f.text({ required: true }).label({ en: 'Value', cs: 'Hodnota' }),
      },
      max: 4, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'More facts about the place', cs: 'Další údaje o místě' })
      .help({ en: 'They stand between the altitude and the coordinates, which come from Site settings.', cs: 'Stojí mezi nadmořskou výškou a souřadnicemi, které jsou v Nastavení webu.' }),
    carHeading: f.text().label({ en: 'Heading of the car route', cs: 'Nadpis cesty autem' }),
    carRoutes: f.list({
      fields: {
        place: f.text({ required: true }).label({ en: 'Place', cs: 'Místo' }),
        distance: f.text().label({ en: 'Distance', cs: 'Vzdálenost' }),
        time: f.text().label({ en: 'Time', cs: 'Čas' }).help({ en: 'All Year writes it after the distance.', cs: 'Celý rok ho napíše za vzdálenost.' }),
        note: f.text().label({ en: 'Note', cs: 'Poznámka' }).help({ en: 'From the Door writes it under the place.', cs: 'Ode dveří ji napíše pod místo.' }),
      },
      max: 8, itemLabel: { en: 'Place', cs: 'Místo' },
    }).label({ en: 'Distances by car', cs: 'Vzdálenosti autem' })
      .help({ en: 'All Year lists them as rows; From the Door as stops on a thin line, in this order, ending at your door.', cs: 'Celý rok je vypíše jako řádky; Ode dveří jako zastávky na tenké lince, v tomto pořadí, končící u vašich dveří.' }),
    carNote: f.text({ multiline: true }).label({ en: 'The last stretch by car', cs: 'Poslední úsek autem' }).help({ en: 'A paragraph under the list (All Year) or beside the last stop (From the Door).', cs: 'Odstavec pod seznamem (Celý rok) nebo u poslední zastávky (Ode dveří).' }),
    trainHeading: f.text().label({ en: 'Heading of the train and bus', cs: 'Nadpis vlaku a autobusu' }),
    trainSteps: f.list({
      fields: {
        title: f.text({ required: true }).label({ en: 'Step', cs: 'Krok' }),
        value: f.text().label({ en: 'Time or distance', cs: 'Čas nebo vzdálenost' }),
        note: f.text().label({ en: 'Note', cs: 'Poznámka' }),
      },
      max: 8, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'By train and bus', cs: 'Vlakem a autobusem' }),
    trainNote: f.text({ multiline: true }).label({ en: 'The last stretch on foot', cs: 'Poslední úsek pěšky' }).help({ en: 'Written beside the last stop in From the Door; All Year leaves it out (put it in the last step).', cs: 'Ode dveří ho napíše u poslední zastávky; Celý rok ho vynechá (napište ho do posledního kroku).' }),
  },
})

const enquiry = defineBlock({
  label: { en: 'Enquiry form', cs: 'Poptávka' },
  description: { en: 'The form guests send to ask whether a date is free. The enquiries arrive in the admin.', cs: 'Formulář, kterým se hosté ptají, zda je termín volný. Poptávky najdete v administraci.' },
  icon: 'i-lucide-mail-check',
  fields: {
    heading: heading(),
    text: text(),
    steps: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }) },
      max: 5, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'What happens next', cs: 'Co bude dál' }),
    callLabel: f.text().label({ en: 'Line before the phone', cs: 'Řádek před telefonem' }).help({ en: 'For example “Rather call?”. The phone comes from Site settings.', cs: 'Například „Raději voláte?“. Telefon je v Nastavení webu.' }),
    adviceLabel: f.text().label({ en: 'Choice for “advise me”', cs: 'Volba „poraďte mi“' }).help({ en: 'The room question’s first choice, for guests who do not know yet.', cs: 'První volba u otázky na pokoj, pro hosty, kteří ještě nevědí.' }),
    moreRooms: f.list({
      fields: { name: f.text({ required: true }).label({ en: 'Choice', cs: 'Volba' }) },
      max: 4, itemLabel: { en: 'Choice', cs: 'Volba' },
    }).label({ en: 'More choices', cs: 'Další volby' })
      .help({ en: 'Besides the rooms, for example “Whole house · 15 beds”. All Year offers them in the list of rooms; From the Door as pills.', cs: 'Kromě pokojů třeba „Celý dům · 15 lůžek“. Celý rok je nabídne v seznamu pokojů, Ode dveří jako štítky.' }),
    consentUrl: link('Page with the privacy notice', 'Stránka s ochranou osobních údajů').optional(),
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
  blocks: { opening, year, rooms, prices, house, trips, reviews, gallery, hosts, directions, enquiry, text: richText, ...customTypeBlocks() },
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
// The website draws it per look (the kit's useSiteForm). The room's choices are the guesthouse's
// own rooms (the form takes the name as text); the guest's dates are written as they would on
// paper, not picked, as the designs do.
export const Enquiry = defineForm('enquiry', {
  label: { en: 'Enquiries', cs: 'Poptávky' },
  labelSingular: { en: 'Enquiry', cs: 'Poptávka' },
  fields: {
    arrival: f.text({ required: true, max: 40 }).label({ en: 'Arrival', cs: 'Příjezd' }).help({ en: 'For example 12. 2. 2027', cs: 'Například 12. 2. 2027' }),
    departure: f.text({ required: true, max: 40 }).label({ en: 'Departure', cs: 'Odjezd' }).help({ en: 'For example 15. 2. 2027', cs: 'Například 15. 2. 2027' }),
    adults: f.select({ options: ['1', '2', '3', '4', '5', '6'] as const, default: '2' }).label({ en: 'Adults', cs: 'Dospělí' }),
    children: f.select({ options: ['0', '1', '2', '3', '4'] as const, default: '0' }).label({ en: 'Children', cs: 'Děti' }),
    room: f.text({ max: 200 }).optional().label({ en: 'Room', cs: 'Pokoj' }),
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    phone: f.text({ max: 60 }).optional().label({ en: 'Phone', cs: 'Telefon' }),
    email: f.text({ required: true, format: 'email', max: 200 }).label({ en: 'E-mail', cs: 'E-mail' }),
    message: f.text({ multiline: true, max: 5000 }).optional().label({ en: 'Note', cs: 'Poznámka' })
      .help({ en: 'A dog, a cot, a later arrival, dinner…', cs: 'Pes, dětská postýlka, pozdější příjezd, večeře…' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send a non-binding enquiry', cs: 'Odeslat nezávaznou poptávku' },
  successMessage: { en: 'Thank you, we have your enquiry. We will write to you the same day.', cs: 'Děkujeme, poptávku máme. Ozveme se vám ještě týž den.' },
})
export const FormSettings = defineFormSettings()
