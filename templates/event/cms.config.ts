import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'
import { OWN_COLOR_FIELD } from 'tinyzoo-template-kit/looks'
import { kitEntryBlocks } from 'tinyzoo-template-kit/sections'

// The content model of the Event template: what the organisers of a race or a festival can
// write and change. One model for both looks (looks.ts): a look decides how a block is drawn,
// never what it holds. Change it here, then `pnpm db:generate` (review the SQL),
// `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní.',
  en: 'Text between *asterisks* stands out.',
}

// The icons a practical-information card can carry (the website draws them from the Lucide set).
export const INFO_ICONS = ['parking', 'locker', 'refreshments', 'bus', 'train', 'toilet', 'medic', 'tent', 'info', 'bike', 'food', 'camera'] as const
const INFO_ICON_LABELS = {
  parking: { en: 'Parking', cs: 'Parkování' }, locker: { en: 'Changing rooms', cs: 'Šatny' }, refreshments: { en: 'Refreshments', cs: 'Občerstvení' },
  bus: { en: 'Bus', cs: 'Autobus' }, train: { en: 'Train', cs: 'Vlak' }, toilet: { en: 'Toilets', cs: 'Toalety' }, medic: { en: 'First aid', cs: 'Zdravotník' },
  tent: { en: 'Tent', cs: 'Stan' }, info: { en: 'Information', cs: 'Informace' }, bike: { en: 'Bicycle', cs: 'Kolo' }, food: { en: 'Food', cs: 'Jídlo' }, camera: { en: 'Photos', cs: 'Fotografie' },
}

// ── the whole site: the event, when, where, who runs it ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The name of the event, its date, the place, the organiser, the look and the colours.', cs: 'Název akce, datum, místo, pořadatel, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'ownColor', 'edition', 'tagline'] },
      { label: { en: 'When and where', cs: 'Kdy a kde' }, fields: ['date', 'registrationCloses', 'venueName', 'venueArea', 'address', 'coordinates', 'mapUrl'] },
      { label: { en: 'Registration', cs: 'Přihlášky' }, fields: ['ctaLabel', 'ctaUrl'] },
      { label: { en: 'Organiser', cs: 'Pořadatel' }, fields: ['organizerName', 'organizerAbout', 'contactName', 'contactRole', 'phone', 'email', 'companyId', 'social'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the event', cs: 'Název akce' })
      .help({ en: 'It opens the website and stands in the header and the footer. Soutisk breaks it after the first word.', cs: 'Otevírá web a stojí v záhlaví a zápatí. Vzhled Soutisk ho za prvním slovem zalomí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the name.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo názvu.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    // The owner's own main colour: the palette of the chosen colours follows it (templates/kit/palette.ts).
    ownColor: f.color().optional().label(OWN_COLOR_FIELD.label).help(OWN_COLOR_FIELD.help),
    edition: f.number({ int: true, min: 1 }).optional().label({ en: 'Edition', cs: 'Ročník' })
      .help({ en: 'For example 14. Race Clock writes it beside the name in the header, with the year of the date below.', cs: 'Například 14. Časomíra ho napíše v záhlaví za název, spolu s rokem z data akce.' }),
    tagline: f.text({ multiline: true }).optional().label({ en: 'Description for the footer', cs: 'Popis do zápatí' })
      .help({ en: 'One or two sentences under the name in the footer.', cs: 'Jedna nebo dvě věty pod názvem v zápatí.' }),
    date: f.datetime().optional().label({ en: 'Day and time of the start', cs: 'Den a čas startu' })
      .help({ en: 'The countdown runs to this moment, and the day is written from it. A day after the start the opening swaps the countdown and the registration for the results and the photographs.', cs: 'Odpočet běží do tohoto okamžiku a podle něj se píše datum. Den po startu úvod vymění odpočet a přihlášení za výsledky a fotky.' }),
    registrationCloses: f.datetime().optional().label({ en: 'Registration closes', cs: 'Přihlášky končí' })
      .help({ en: 'From this moment the website says registration is closed and the buttons stop leading to the form. Leave it empty to keep registration open until the start.', cs: 'Od tohoto okamžiku web píše, že jsou přihlášky uzavřeny, a tlačítka už nevedou k přihlášce. Když pole necháte prázdné, přihlášky se berou až do startu.' }),
    venueName: f.text().optional().label({ en: 'Place', cs: 'Místo' })
      .help({ en: 'The village or town, for example “Borová Lhota”.', cs: 'Obec nebo město, například „Borová Lhota“.' }),
    venueArea: f.text().optional().label({ en: 'Where it is, in a few words', cs: 'Kde to je, pár slovy' })
      .help({ en: 'Written after the place, for example “near Žďár nad Sázavou”.', cs: 'Píše se za místem, například „u Žďáru nad Sázavou“.' }),
    address: f.text().optional().label({ en: 'Address', cs: 'Adresa' }),
    coordinates: f.text().optional().label({ en: 'Coordinates', cs: 'Souřadnice' })
      .help({ en: 'Race Clock writes them under the address; Overprint leaves them out.', cs: 'Časomíra je napíše pod adresu, Soutisk je vynechá.' }),
    mapUrl: f.text({ format: 'url' }).optional().label({ en: 'Link to a map', cs: 'Odkaz do mapy' }),
    ctaLabel: f.text().optional().label({ en: 'Registration button text', cs: 'Text tlačítka přihlášky' })
      .help({ en: 'For example “Sign up”. It stands in the header, the opening and the closing call.', cs: 'Například „Přihlásit se“. Stojí v záhlaví, v úvodu a na závěr stránky.' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Where registration is', cs: 'Kde je přihláška' })
      .help({ en: 'The address of your registration system. A route without its own address leads here.', cs: 'Adresa vašeho přihlašovacího systému. Trasa bez vlastní adresy vede sem.' }),
    organizerName: f.text().optional().label({ en: 'Organiser', cs: 'Pořadatel' }),
    organizerAbout: f.text({ multiline: true }).optional().label({ en: 'About the organiser', cs: 'O pořadateli' }),
    contactName: f.text().optional().label({ en: 'Contact person', cs: 'Kontaktní osoba' }),
    contactRole: f.text().optional().label({ en: 'Their role', cs: 'Její role' }).help({ en: 'For example “race director”.', cs: 'Například „ředitel závodu“.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    social: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
        url: f.text({ format: 'url', required: true }).label({ en: 'Address', cs: 'Adresa' }),
      },
      max: 6, itemLabel: { en: 'Link', cs: 'Odkaz' },
    }).label({ en: 'Social networks', cs: 'Sociální sítě' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── the routes (for a festival: stages or tracks) ──
export const Track = defineEntity('track', {
  label: { en: 'Routes', cs: 'Trasy' },
  labelSingular: { en: 'Route', cs: 'Trasa' },
  description: { en: 'The distances people can run or ride, with the profile, the start, the entry fee and the places left. Drag to put them in order.', cs: 'Trasy, které se dají zdolat: s profilem, startem, startovným a volnými místy. Pořadí změníte přetažením.' },
  icon: 'i-lucide-mountain',
  titleField: 'name',
  admin: { list: { columns: ['name', 'length', 'startTime', 'free'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }).help({ en: 'For example “Three hills”.', cs: 'Například „Tři vrchy“.' }),
    figure: f.text({ required: true, max: 12 }).label({ en: 'Big figure', cs: 'Velké číslo' })
      .help({ en: 'The distance as a whole number, for example “24”. Race Clock lights it up, Overprint writes “km” after it.', cs: 'Vzdálenost celým číslem, například „24“. Časomíra ho rozsvítí, Soutisk za něj napíše „km“.' }),
    figureNote: f.text({ max: 30 }).optional().label({ en: 'After the big figure (Race Clock)', cs: 'Za velkým číslem (Časomíra)' })
      .help({ en: 'For example “,1 km”. Without it Race Clock writes “km”.', cs: 'Například „,1 km“. Bez ní Časomíra napíše „km“.' }),
    length: f.text({ max: 30 }).label({ en: 'Distance, short', cs: 'Délka, krátce' })
      .help({ en: 'For example “24 km” or “up to 1 km”. It stands under the name in the fee table.', cs: 'Například „24 km“ nebo „do 1 km“. Stojí pod názvem v tabulce startovného.' }),
    exactLength: f.text({ max: 30 }).optional().label({ en: 'Distance, exact (Overprint)', cs: 'Délka přesně (Soutisk)' })
      .help({ en: 'For example “24.1 km”. Overprint writes it among the figures of the route; empty, it uses the short one.', cs: 'Například „24,1 km“. Soutisk ji napíše mezi údaje o trase; když pole necháte prázdné, použije se krátká délka.' }),
    description: f.text({ multiline: true }).optional().label({ en: 'Short description', cs: 'Krátký popis' }),
    elevation: f.text({ max: 30 }).optional().label({ en: 'Elevation gain', cs: 'Převýšení' }).help({ en: 'For example “+610 m”.', cs: 'Například „+610 m“.' }),
    startTime: f.text({ max: 20 }).optional().label({ en: 'Start', cs: 'Start' }).help({ en: 'For example “10:00”.', cs: 'Například „10:00“.' }),
    capacity: f.number({ int: true, min: 0 }).optional().label({ en: 'Places in all', cs: 'Míst celkem' }),
    free: f.number({ int: true, min: 0 }).optional().label({ en: 'Places left', cs: 'Volných míst' })
      .help({ en: 'You change it by hand. The bars of places taken and the totals on the page follow it.', cs: 'Měníte ho ručně. Pruhy obsazených míst a součty na stránce se podle něj řídí.' }),
    prices: f.list({
      fields: { price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }) },
      max: 6, itemLabel: { en: 'Price', cs: 'Cena' },
    }).label({ en: 'Entry fee', cs: 'Startovné' })
      .help({ en: 'One price for each period of the Entry fee section, in the same order. The one that holds today is the entry fee “now”.', cs: 'Jedna cena pro každé období ze sekce Startovné, ve stejném pořadí. Ta, která platí dnes, je startovné „teď“.' }),
    profile: f.text({ multiline: true }).optional().label({ en: 'Elevation profile', cs: 'Výškový profil' })
      .help({ en: 'One point per line: the kilometre and the metres above sea level, for example “4.5 724”. All routes are drawn at the same scale.', cs: 'Jeden bod na řádek: kilometr a nadmořská výška v metrech, například „4,5 724“. Všechny trasy se kreslí ve stejném měřítku.' }),
    peaks: f.list({
      fields: {
        km: f.number({ int: false, min: 0 }).label({ en: 'Kilometre', cs: 'Kilometr' }),
        height: f.number({ int: true, min: 0 }).optional().label({ en: 'Height in metres', cs: 'Výška v metrech' }),
        label: f.text({ max: 20 }).optional().label({ en: 'Word instead of the height', cs: 'Slovo místo výšky' }).help({ en: 'For example “flat” on a route without a peak.', cs: 'Například „rovina“ u trasy bez vrcholu.' }),
      },
      max: 5, itemLabel: { en: 'Peak', cs: 'Vrchol' },
    }).label({ en: 'Marked peaks (Race Clock)', cs: 'Označené vrcholy (Časomíra)' })
      .help({ en: 'Race Clock writes the height at the kilometre on the profile; the highest one stands out.', cs: 'Časomíra napíše výšku u kilometru na profilu, nejvyšší vrchol zvýrazní.' }),
    forChildren: f.boolean().label({ en: 'A children’s race', cs: 'Dětský závod' })
      .help({ en: 'Its price is left out of “from 250 Kč” in the opening.', cs: 'Jeho cena se nepočítá do „od 250 Kč“ v úvodu.' }),
    registerLabel: f.text({ max: 60 }).optional().label({ en: 'Text of the sign-up link', cs: 'Text odkazu na přihlášku' })
      .help({ en: 'For example “Sign up for 24 km”. Empty: “Sign up”.', cs: 'Například „Přihlásit se na 24 km“. Prázdné: „Přihlásit se“.' }),
    registerUrl: f.text({ format: 'link' }).optional().label({ en: 'Where to sign up', cs: 'Kam se přihlásit' })
      .help({ en: 'Empty: the registration address of Site settings.', cs: 'Prázdné: adresa přihlášky z Nastavení webu.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the periods of the entry fee: winter, spring, on the spot ──
export const FeePeriod = defineEntity('feePeriod', {
  label: { en: 'Entry fee periods', cs: 'Období startovného' },
  labelSingular: { en: 'Period', cs: 'Období' },
  description: { en: 'The columns of the fee table. The period that holds on the day a visitor opens the page is the current one. The prices are on each route.', cs: 'Sloupce tabulky startovného. Období, které platí v den, kdy někdo stránku otevře, je to aktuální. Ceny jsou u každé trasy.' },
  icon: 'i-lucide-calendar-range',
  titleField: 'name',
  admin: { list: { columns: ['name', 'validUntil'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }).help({ en: 'For example “winter”, “spring” or “on the spot”.', cs: 'Například „zimní“, „jarní“ nebo „na místě“.' }),
    validUntil: f.datetime({ allDay: true }).optional().label({ en: 'Valid until', cs: 'Platí do' })
      .help({ en: 'The last day of the period. Leave it empty for the last one (“on the spot”): the table then writes the day of the start above its name.', cs: 'Poslední den období. U posledního („na místě“) pole nechte prázdné: tabulka pak nad jeho název napíše den startu.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the programme of the day ──
export const ProgramItem = defineEntity('programItem', {
  label: { en: 'Programme', cs: 'Program' },
  labelSingular: { en: 'Programme item', cs: 'Bod programu' },
  description: { en: 'What happens when. Drag to put the items in order.', cs: 'Co se kdy děje. Pořadí změníte přetažením.' },
  icon: 'i-lucide-clock',
  titleField: 'title',
  admin: { list: { columns: ['time', 'title', 'place', 'highlight'], orderField: 'position' } },
  fields: {
    time: f.text({ required: true, max: 20 }).label({ en: 'Time', cs: 'Čas' }).help({ en: 'As you want it written, for example “10:00”.', cs: 'Tak, jak ho chcete napsat, například „10:00“.' }),
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
    place: f.text().optional().label({ en: 'Where', cs: 'Kde' }).help({ en: 'For example “the podium”.', cs: 'Například „pódium“.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
    highlight: f.select({
      options: ['none', 'start', 'ceremony'] as const, default: 'none',
      labels: { none: { en: 'Plain', cs: 'Běžný' }, start: { en: 'A start', cs: 'Start' }, ceremony: { en: 'A ceremony', cs: 'Vyhlášení' } },
    }).label({ en: 'Kind', cs: 'Druh' })
      .help({ en: 'A start is lit in the colour of the look; a ceremony is marked in Overprint.', cs: 'Start se zvýrazní barvou vzhledu; vyhlášení označí Soutisk.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── results: the winners of each route and category, year by year ──
export const Result = defineEntity('result', {
  label: { en: 'Results', cs: 'Výsledky' },
  labelSingular: { en: 'Result', cs: 'Výsledek' },
  description: { en: 'The winners of a year. The home page shows the first place of every category of the year named in the block; the results page shows every row.', cs: 'Vítězové jednotlivých ročníků. Úvodní stránka ukáže první místo každé kategorie roku z bloku, stránka výsledků všechny řádky.' },
  icon: 'i-lucide-trophy',
  titleField: 'name',
  admin: { list: { columns: ['year', 'track', 'category', 'place', 'name', 'time'], orderField: 'position' } },
  fields: {
    year: f.number({ int: true, min: 1900 }).label({ en: 'Year', cs: 'Rok' }),
    track: f.relation({ to: () => Track, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Route', cs: 'Trasa' }),
    category: f.text({ required: true, max: 40 }).label({ en: 'Category', cs: 'Kategorie' }).help({ en: 'For example “Men” or “Women”. Race Clock writes its first letter in a column.', cs: 'Například „Muži“ nebo „Ženy“. Časomíra napíše první písmeno do sloupce.' }),
    place: f.number({ int: true, min: 1 }).label({ en: 'Place', cs: 'Pořadí' }),
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    club: f.text().optional().label({ en: 'Club', cs: 'Oddíl' }),
    time: f.text({ required: true, max: 20 }).label({ en: 'Time', cs: 'Čas' }).help({ en: 'For example “1:44:38”.', cs: 'Například „1:44:38“.' }),
    record: f.boolean().label({ en: 'Course record', cs: 'Traťový rekord' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }).help({ en: 'The order of the categories on the page follows it.', cs: 'Podle něj se na stránce řadí kategorie.' }),
  },
  content: { public: true, populate: ['track'] },
})

// ── news from the organiser, each with a page of its own ──
export const NewsItem = defineEntity('newsItem', {
  label: { en: 'News', cs: 'Aktuality' },
  labelSingular: { en: 'News item', cs: 'Aktualita' },
  description: { en: 'Announcements from the organiser. The newest come first.', cs: 'Hlášení pořadatele. Nejnovější jsou první.' },
  icon: 'i-lucide-megaphone',
  titleField: 'title',
  admin: { list: { columns: ['title', 'date'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Titulek' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    date: f.datetime({ allDay: true }).label({ en: 'Date', cs: 'Datum' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Perex' }),
    body: f.richtext().optional().label({ en: 'Text', cs: 'Text' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' }),
    ...seo(),
  },
  content: { public: true, slug: 'slug', path: '/aktuality/:slug', populate: ['image', 'ogImage'] },
})

// ── partners and sponsors ──
export const Partner = defineEntity('partner', {
  label: { en: 'Partners', cs: 'Partneři' },
  labelSingular: { en: 'Partner', cs: 'Partner' },
  description: { en: 'Sponsors and supporters, set in type (no logos needed).', cs: 'Sponzoři a podporovatelé, vysázení písmem (logo není potřeba).' },
  icon: 'i-lucide-handshake',
  titleField: 'name',
  admin: { list: { columns: ['name', 'level'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    level: f.select({
      options: ['main', 'partner', 'supporter'] as const, default: 'partner',
      labels: { main: { en: 'Main partner', cs: 'Hlavní partner' }, partner: { en: 'Partner', cs: 'Partner' }, supporter: { en: 'Supporter', cs: 'Podporuje' } },
    }).label({ en: 'Level', cs: 'Úroveň' }),
    url: f.text({ format: 'link' }).optional().label({ en: 'Link', cs: 'Odkaz' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── questions and answers ──
export const Question = defineEntity('question', {
  label: { en: 'Questions', cs: 'Otázky' },
  labelSingular: { en: 'Question', cs: 'Otázka' },
  description: { en: 'What people ask before they sign up.', cs: 'Na co se lidé ptají, než se přihlásí.' },
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

// ── the numbered points of the venue's plan ──
export const VenuePoint = defineEntity('venuePoint', {
  label: { en: 'Points on the plan', cs: 'Místa v areálu' },
  labelSingular: { en: 'Point', cs: 'Místo' },
  description: { en: 'The numbered list beside the plan. The numbers follow the order; the position puts each one on the plan.', cs: 'Číslovaný seznam u plánu. Čísla se řídí pořadím, poloha místo umístí na plán.' },
  icon: 'i-lucide-map-pin',
  titleField: 'name',
  admin: { list: { columns: ['name', 'note'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    note: f.text().optional().label({ en: 'Where exactly', cs: 'Kde přesně' }),
    x: f.number({ int: false, min: 0, max: 100 }).optional().label({ en: 'Position across, in %', cs: 'Poloha zleva, v %' }),
    y: f.number({ int: false, min: 0, max: 100 }).optional().label({ en: 'Position down, in %', cs: 'Poloha shora, v %' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' })
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).optional().label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).optional().label({ en, cs })
const links = (en: string, cs: string, max = 4) => f.list({
  fields: { label: f.text({ required: true }).label({ en: 'Text', cs: 'Text' }), url: f.text({ format: 'link', required: true }).label({ en: 'Destination', cs: 'Cíl' }) },
  max, itemLabel: { en: 'Link', cs: 'Odkaz' },
}).label({ en, cs })

const opening = defineBlock({
  label: { en: 'Opening with the countdown', cs: 'Úvod s odpočtem' },
  description: { en: 'The name, the day and the place from Site settings, the countdown to the start and the registration button. After the start it shows the results and the photographs instead.', cs: 'Název, datum a místo z Nastavení webu, odpočet do startu a tlačítko přihlášky. Po startu místo nich ukáže výsledky a fotky.' },
  icon: 'i-lucide-timer',
  fields: {
    eyebrow: eyebrow().help({ en: 'For example “14th edition · trail run”.', cs: 'Například „14. ročník · terénní běh“.' }),
    lead: f.text({ multiline: true }).label({ en: 'Lead (Race Clock)', cs: 'Úvodní věta (Časomíra)' })
      .help({ en: 'Race Clock writes it under the name; Overprint writes the day and the place there instead.', cs: 'Časomíra ji napíše pod název; Soutisk tam napíše datum a místo.' }),
    image: photo('Photograph (Overprint)', 'Fotografie (Soutisk)')
      .help({ en: 'Overprint shows it in a circle beside the name, like a rising sun. Race Clock uses it when the next field is empty.', cs: 'Soutisk ji ukáže v kruhu vedle názvu jako vycházející slunce. Časomíra ji použije, když je následující pole prázdné.' }),
    darkImage: photo('Photograph for Race Clock', 'Fotografie pro Časomíru')
      .help({ en: 'Race Clock opens with this photograph across the whole width, under the name. Choose one made in low light.', cs: 'Časomíra jí otevře stránku přes celou šířku pod názvem. Vyberte fotografii pořízenou za šera.' }),
    countdownLabel: f.text().label({ en: 'Line above the countdown', cs: 'Řádek nad odpočtem' }).help({ en: 'For example “Start in”.', cs: 'Například „Start za“.' }),
    secondaryLabel: f.text().label({ en: 'Second button text', cs: 'Text druhého tlačítka' }),
    secondaryUrl: link('Second button destination', 'Cíl druhého tlačítka'),
  },
})

const routes = defineBlock({
  label: { en: 'Routes', cs: 'Trasy' },
  description: { en: 'The routes from the Routes section with profiles, figures and places left.', cs: 'Trasy ze sekce Trasy s profily, údaji a volnými místy.' },
  icon: 'i-lucide-mountain',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help(EMPHASIS_HELP),
    text: text(),
    links: links('Links under the routes', 'Odkazy pod trasami').help({ en: 'For example the GPX files and the printable map.', cs: 'Například soubory GPX a mapa k tisku.' }),
  },
})

const programme = defineBlock({
  label: { en: 'Programme', cs: 'Program' },
  description: { en: 'The items of the Programme section in order, with a photograph.', cs: 'Body ze sekce Program popořadě, s fotografií.' },
  icon: 'i-lucide-clock',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    photos: f.list({
      fields: { image: photo(), caption: f.text().label({ en: 'Caption', cs: 'Popisek' }) },
      max: 2, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Race Clock shows the first one with its caption, Overprint the last one.', cs: 'Časomíra ukáže první i s popiskem, Soutisk poslední.' }),
  },
})

const fees = defineBlock({
  label: { en: 'Entry fees', cs: 'Startovné' },
  description: { en: 'A table of the prices of every route in every period, with today’s column highlighted.', cs: 'Tabulka cen každé trasy v každém období, s dnešním sloupcem zvýrazněným.' },
  icon: 'i-lucide-ticket',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    pricesNote: f.text().label({ en: 'Note on the currency (Race Clock)', cs: 'Poznámka k měně (Časomíra)' }).help({ en: 'For example “Prices are in crowns.” Race Clock writes it before what is included.', cs: 'Například „Ceny jsou v korunách.“ Časomíra ji napíše před to, co je v ceně.' }),
    includedTitle: f.text().label({ en: 'Title of what is included', cs: 'Nadpis k tomu, co je v ceně' }),
    included: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }) },
      max: 8, itemLabel: { en: 'Line', cs: 'Řádek' },
    }).label({ en: 'What is included', cs: 'Co je v ceně' })
      .help({ en: 'Overprint writes a list with ticks; Race Clock joins the lines into one sentence.', cs: 'Soutisk napíše seznam s fajfkami, Časomíra řádky spojí do jedné věty.' }),
    notes: f.list({
      fields: { text: f.text({ required: true, multiline: true }).label({ en: 'Text', cs: 'Text' }) },
      max: 4, itemLabel: { en: 'Note', cs: 'Poznámka' },
    }).label({ en: 'Notes under the table', cs: 'Poznámky pod tabulkou' }),
  },
})

const results = defineBlock({
  label: { en: 'Results', cs: 'Výsledky' },
  description: { en: 'The winners of one year from the Results section, or every row of it.', cs: 'Vítězové jednoho roku ze sekce Výsledky, nebo všechny její řádky.' },
  icon: 'i-lucide-trophy',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    year: f.number({ int: true, min: 1900 }).label({ en: 'Year shown', cs: 'Zobrazený rok' }),
    all: f.boolean().label({ en: 'Every row, not only the winners', cs: 'Všechny řádky, ne jen vítězové' })
      .help({ en: 'Turn it on for a page of full results.', cs: 'Zapněte pro stránku s kompletními výsledky.' }),
    image: photo().help({ en: 'Race Clock shows it beside the list.', cs: 'Časomíra ji ukáže vedle seznamu.' }),
    links: links('Links under the results', 'Odkazy pod výsledky', 4)
      .help({ en: 'The first one is a button, the others are links.', cs: 'První je tlačítko, ostatní jsou odkazy.' }),
  },
})

const gallery = defineBlock({
  label: { en: 'Photographs', cs: 'Fotografie' },
  description: { en: 'Photographs of the last edition: a strip to swipe in Race Clock, a collage in Overprint.', cs: 'Fotografie z loňského ročníku: v Časomíře pás k posouvání, v Soutisku koláž.' },
  icon: 'i-lucide-images',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    linkLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'For example “All photos, 214”.', cs: 'Například „Celá galerie, 214 fotek“.' }),
    linkUrl: link('Link destination', 'Cíl odkazu'),
    photos: f.list({
      fields: { image: photo(), caption: f.text().label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'Race Clock writes it under the photograph.', cs: 'Časomíra ho napíše pod fotografii.' }) },
      max: 24, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Drag to change the order. Race Clock shows all of them in a strip; Overprint lays the first seven out in a collage.', cs: 'Pořadí změníte přetažením. Časomíra je ukáže všechny v pásu, Soutisk prvních sedm rozloží do koláže.' }),
    credit: f.text().label({ en: 'Credit', cs: 'Autor fotografií' }).help({ en: 'For example “Photos: Jan Bureš”.', cs: 'Například „Foto: Jan Bureš“.' }),
  },
})

const practical = defineBlock({
  label: { en: 'Practical information', cs: 'Praktické informace' },
  description: { en: 'Parking, changing rooms, refreshments, the bus: short cards, and the rules in brief.', cs: 'Parkování, šatny, občerstvení, autobus: krátké karty, a pravidla ve zkratce.' },
  icon: 'i-lucide-info',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    items: f.list({
      fields: {
        icon: f.select({ options: INFO_ICONS, default: 'info', labels: INFO_ICON_LABELS }).label({ en: 'Icon', cs: 'Ikona' }),
        title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 8, itemLabel: { en: 'Card', cs: 'Karta' },
    }).label({ en: 'Cards', cs: 'Karty' })
      .help({ en: 'Race Clock writes four in a row, without the icon; Overprint draws the first four with their icons beside the photograph.', cs: 'Časomíra jich napíše čtyři vedle sebe, bez ikony; Soutisk první čtyři nakreslí s ikonami vedle fotografie.' }),
    image: photo(),
    rulesTitle: f.text().label({ en: 'Title of the rules', cs: 'Nadpis pravidel' }),
    rules: f.list({
      fields: { text: f.text({ required: true, multiline: true }).label({ en: 'Rule', cs: 'Pravidlo' }) },
      max: 8, itemLabel: { en: 'Rule', cs: 'Pravidlo' },
    }).label({ en: 'Rules in brief', cs: 'Pravidla ve zkratce' }),
    rulesLabel: f.text().label({ en: 'Link to the full rules, text', cs: 'Odkaz na celé propozice, text' }),
    rulesUrl: link('Link to the full rules, destination', 'Odkaz na celé propozice, cíl'),
  },
})

const venue = defineBlock({
  label: { en: 'Venue and plan', cs: 'Areál a plán' },
  description: { en: 'The address from Site settings, the numbered points from the Points on the plan section and a plan.', cs: 'Adresa z Nastavení webu, číslovaná místa ze sekce Místa v areálu a plán.' },
  icon: 'i-lucide-map',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    plan: photo('Plan of the venue', 'Plán areálu')
      .help({ en: 'Your own plan or map. The numbered points lie over it at the positions you set. Empty: the sample drawing, if it is switched on.', cs: 'Váš plán nebo mapa. Číslovaná místa na ní leží tam, kam je umístíte. Prázdné: ukázkový výkres, je-li zapnutý.' }),
    samplePlan: f.boolean().label({ en: 'Draw the sample plan', cs: 'Nakreslit ukázkový plán' })
      .help({ en: 'A schematic drawing of a village sports ground in the colours of the look. Turn it off and upload your own plan.', cs: 'Schématický výkres vesnického sportovního areálu v barvách vzhledu. Vypněte ho a nahrajte vlastní plán.' }),
    linkLabel: f.text().label({ en: 'Map link text', cs: 'Text odkazu do mapy' }),
  },
})

const news = defineBlock({
  label: { en: 'News', cs: 'Aktuality' },
  description: { en: 'The newest items of the News section.', cs: 'Nejnovější položky ze sekce Aktuality.' },
  icon: 'i-lucide-megaphone',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    count: f.number({ int: true, min: 0 }).label({ en: 'How many to show', cs: 'Kolik jich ukázat' }).help({ en: '0 shows all of them.', cs: '0 ukáže všechny.' }),
    linkLabel: f.text().label({ en: 'Link to all news, text', cs: 'Odkaz na všechny aktuality, text' }),
    linkUrl: link('Link to all news, destination', 'Odkaz na všechny aktuality, cíl'),
  },
})

const faq = defineBlock({
  label: { en: 'Questions and answers', cs: 'Časté otázky' },
  description: { en: 'The questions from the Questions section.', cs: 'Otázky ze sekce Otázky.' },
  icon: 'i-lucide-circle-help',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: f.text({ multiline: true }).label({ en: 'Text (Overprint)', cs: 'Text (Soutisk)' })
      .help({ en: 'Overprint writes it beside the questions. Text between *asterisks* becomes a link to the phone number.', cs: 'Soutisk ho napíše vedle otázek. Text mezi *hvězdičkami* se změní v odkaz na telefonní číslo.' }),
  },
})

const partners = defineBlock({
  label: { en: 'Partners and organiser', cs: 'Partneři a pořadatel' },
  description: { en: 'The partners from the Partners section and the organiser from Site settings with the contact details.', cs: 'Partneři ze sekce Partneři a pořadatel z Nastavení webu s kontakty.' },
  icon: 'i-lucide-handshake',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Race Clock does not show it, but it is there for screen readers and search engines.', cs: 'Časomíra ho nezobrazí, je tu pro čtečky a vyhledávače.' }),
    image: photo().help({ en: 'Overprint shows it above the organiser’s card.', cs: 'Soutisk ji ukáže nad kartou pořadatele.' }),
    mainLabel: f.text().label({ en: 'Label of the main partner', cs: 'Označení hlavního partnera' }),
    partnerLabel: f.text().label({ en: 'Label of the partners', cs: 'Označení partnerů' }),
    supporterLabel: f.text().label({ en: 'Label of the supporters', cs: 'Označení podporovatelů' }),
    organizerLabel: f.text().label({ en: 'Label above the organiser', cs: 'Označení nad pořadatelem' }),
  },
})

const closing = defineBlock({
  label: { en: 'Closing call', cs: 'Závěrečná výzva' },
  description: { en: 'The last word before the footer: the places that are left and the registration button.', cs: 'Poslední slovo před zápatím: volná místa a tlačítko přihlášky.' },
  icon: 'i-lucide-flag',
  fields: {
    label: f.text().label({ en: 'Line above (Race Clock)', cs: 'Řádek nad číslem (Časomíra)' }),
    heading: f.text({ required: true, multiline: true }).label({ en: 'Heading', cs: 'Nadpis' })
      .help({ en: 'Race Clock writes it beside the number of places left, and keeps a line break; “{total}” becomes the number of all places.', cs: 'Časomíra ho napíše vedle počtu volných míst a zachová zalomení řádku; „{total}“ se změní na počet všech míst.' }),
    text: f.text({ multiline: true }).label({ en: 'Text (Overprint)', cs: 'Text (Soutisk)' }),
    note: f.text().label({ en: 'Line under the button (Race Clock)', cs: 'Řádek pod tlačítkem (Časomíra)' }),
  },
})

const contact = defineBlock({
  label: { en: 'Contact form', cs: 'Kontaktní formulář' },
  description: { en: 'The organiser’s contact details from Site settings and a form. The messages arrive in the admin.', cs: 'Kontakty pořadatele z Nastavení webu a formulář. Zprávy najdete v administraci.' },
  icon: 'i-lucide-mail',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
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
  blocks: { opening, routes, programme, fees, results, gallery, practical, venue, news, faq, partners, closing, contact, text: richText, ...kitEntryBlocks() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    race: { en: 'Footer: the race', cs: 'Zápatí: závod' },
    years: { en: 'Footer: past editions', cs: 'Zápatí: ročníky' },
    legal: { en: 'Links in the footer', cs: 'Odkazy v zápatí' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the messages of the form below
]

// ── the contact form ──
export const Enquiry = defineForm('enquiry', {
  label: { en: 'Messages', cs: 'Zprávy' },
  labelSingular: { en: 'Message', cs: 'Zpráva' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name', cs: 'Jméno' }),
    email: f.text({ required: true, format: 'email', max: 200 }).label({ en: 'E-mail', cs: 'E-mail' }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'Message', cs: 'Zpráva' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send message', cs: 'Odeslat zprávu' },
  successMessage: { en: 'Thank you, we have your message and will write back.', cs: 'Děkujeme, zprávu máme a ozveme se.' },
})
export const FormSettings = defineFormSettings()
