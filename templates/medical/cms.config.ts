import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'
import { OWN_COLOR_FIELD } from 'tinyzoo-template-kit/looks'
import { kitEntryBlocks } from 'tinyzoo-template-kit/sections'

// The content model of the Medical template: what a practice can write and change. One model
// for both looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní. Každý vzhled to dělá po svém: Čekárna ho zalomí na novou řádku, Ciferník nechá beze změny.',
  en: 'Text between *asterisks* stands out. Each look does it its own way: Waiting Room puts it on a new line, Clock Face leaves it as it is.',
}
const BOLD_HELP = {
  cs: 'Text mezi *hvězdičkami* se vysází tučně.',
  en: 'Text between *asterisks* is set in bold.',
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS = {
  mon: { en: 'Monday', cs: 'Pondělí' }, tue: { en: 'Tuesday', cs: 'Úterý' }, wed: { en: 'Wednesday', cs: 'Středa' },
  thu: { en: 'Thursday', cs: 'Čtvrtek' }, fri: { en: 'Friday', cs: 'Pátek' }, sat: { en: 'Saturday', cs: 'Sobota' }, sun: { en: 'Sunday', cs: 'Neděle' },
}

// ── the whole site: who, where, how to reach us ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The name of the practice, the address, the phone numbers, the look and the colours.', cs: 'Název ordinace, adresa, telefony, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'ownColor', 'field'] },
      { label: { en: 'Where', cs: 'Kde' }, fields: ['street', 'town', 'floor', 'mapUrl'] },
      { label: { en: 'Phone and e-mail', cs: 'Telefon a e-mail' }, fields: ['phone', 'phoneNote', 'smsPhone', 'email'] },
      { label: { en: 'New patients and closed hours', cs: 'Noví pacienti a zavřeno' }, fields: ['accepting', 'acceptingNote', 'closedText', 'visitsText'] },
      { label: { en: 'Operator', cs: 'Provozovatel' }, fields: ['operatorName', 'companyId', 'register', 'licence'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the practice', cs: 'Název ordinace' })
      .help({ en: 'It stands in the header and the footer, for example “Dr. Novak’s surgery”.', cs: 'Stojí v záhlaví a v zápatí, například „Ordinace MUDr. Nováka“.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the drawn mark.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo nakresleného znaku.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    // The owner's own main colour: the palette of the chosen colours follows it (templates/kit/palette.ts).
    ownColor: f.color().optional().label(OWN_COLOR_FIELD.label).help(OWN_COLOR_FIELD.help),
    field: f.text().optional().label({ en: 'What you do', cs: 'Obor' })
      .help({ en: 'A few words under the name in the footer, for example “General practitioner for adults”.', cs: 'Pár slov pod názvem v zápatí, například „Praktický lékař pro dospělé“.' }),
    street: f.text().optional().label({ en: 'Street and number', cs: 'Ulice a číslo' }),
    town: f.text().optional().label({ en: 'Postcode and town', cs: 'PSČ a město' }).help({ en: 'For example “506 01 Jičín”.', cs: 'Například „506 01 Jičín“.' }),
    floor: f.text().optional().label({ en: 'Floor', cs: 'Patro' }).help({ en: 'For example “1st floor”. It follows the address in the footer.', cs: 'Například „1. patro“. V zápatí následuje za adresou.' }),
    mapUrl: f.text({ format: 'url' }).optional().label({ en: 'Link to a map', cs: 'Odkaz do mapy' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }).help({ en: 'The number patients call. It is written in the header, the footer and the opening.', cs: 'Číslo, na které pacienti volají. Je v záhlaví, v zápatí i v úvodu.' }),
    phoneNote: f.text({ multiline: true }).optional().label({ en: 'When the phone is answered', cs: 'Kdy telefon zvedáte' })
      .help({ en: 'For example “Monday to Friday 11–13”. It stands under the phone number in the booking section.', cs: 'Například „Pondělí až pátek 11–13 h“. Stojí pod číslem v sekci Objednání.' }),
    smsPhone: f.text().optional().label({ en: 'Mobile for text messages and prescriptions', cs: 'Mobil pro SMS a recepty' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    accepting: f.boolean().label({ en: 'Taking new patients', cs: 'Přijímáme nové pacienty' })
      .help({ en: 'Shows a line with a tick in the opening. Turn it off when you are full.', cs: 'V úvodu ukáže řádek se zatržítkem. Vypněte, když máte plno.' }),
    acceptingNote: f.text().optional().label({ en: 'Who you take', cs: 'Koho přijímáte' }).help({ en: 'For example “from Jičín and the surrounding area”.', cs: 'Například „z Jičína a okolí“.' }),
    closedText: f.text({ multiline: true }).optional().label({ en: 'When we are closed', cs: 'Když máme zavřeno' })
      .help({ en: 'Where patients go with an urgent problem. It stands under the opening hours. Text between *asterisks* is set in bold.', cs: 'Kam mají pacienti jít s akutním problémem. Stojí pod ordinačními hodinami. Text mezi *hvězdičkami* se vysází tučně.' }),
    visitsText: f.text({ multiline: true }).optional().label({ en: 'Home visits', cs: 'Návštěvy doma' })
      .help({ en: 'Leave it empty if you do not make any.', cs: 'Když návštěvy nejezdíte, nechte prázdné.' }),
    operatorName: f.text().optional().label({ en: 'Operator', cs: 'Provozovatel' }).help({ en: 'The company or person that runs the practice, for example “Ordinace s.r.o.”.', cs: 'Firma nebo osoba, která ordinaci provozuje, například „Ordinace s.r.o.“.' }),
    companyId: f.text().optional().label({ en: 'Company number', cs: 'IČO' }),
    register: f.text().optional().label({ en: 'Entry in the register', cs: 'Zápis v rejstříku' }).help({ en: 'For example “Registered at the Regional Court in Hradec Králové, section C, file 44218”.', cs: 'Například „Zapsáno u Krajského soudu v Hradci Králové, oddíl C, vložka 44218“.' }),
    licence: f.text({ multiline: true }).optional().label({ en: 'Licence to provide health services', cs: 'Oprávnění ke zdravotním službám' }).help({ en: 'The sentence under the footer.', cs: 'Věta pod zápatím.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── opening hours: one row for one part of a day ──
export const OpeningHour = defineEntity('openingHour', {
  label: { en: 'Opening hours', cs: 'Ordinační hodiny' },
  labelSingular: { en: 'Opening hours row', cs: 'Řádek hodin' },
  description: { en: 'One row is one part of one day. A day with a break has two rows. A day without a row is closed.', cs: 'Jeden řádek je jedna část jednoho dne. Den s přestávkou má dva řádky. Den bez řádku je zavřený.' },
  icon: 'i-lucide-clock',
  titleField: 'note',
  admin: { list: { columns: ['day', 'from', 'to', 'note', 'kind'], orderField: 'position' } },
  fields: {
    day: f.select({ options: DAYS, default: 'mon', labels: DAY_LABELS }).label({ en: 'Day', cs: 'Den' }),
    from: f.text({ required: true, max: 5 }).label({ en: 'From', cs: 'Od' }).help({ en: 'The time as 7:00 or 13:30.', cs: 'Čas ve tvaru 7:00 nebo 13:30.' }),
    to: f.text({ required: true, max: 5 }).label({ en: 'To', cs: 'Do' }).help({ en: 'The time as 11:00 or 18:00. Rows that follow each other are written as one span.', cs: 'Čas ve tvaru 11:00 nebo 18:00. Řádky, které na sebe navazují, se napíšou jako jeden úsek.' }),
    note: f.text().optional().label({ en: 'What happens then', cs: 'Co se v tu dobu děje' }).help({ en: 'For example “Blood samples” or “Urgent problems, no appointment”.', cs: 'Například „Odběry krve“ nebo „Akutní potíže, bez objednání“.' }),
    kind: f.select({
      options: ['walkin', 'booked', 'samples'] as const, default: 'booked',
      labels: { walkin: { en: 'No appointment needed', cs: 'Bez objednání' }, booked: { en: 'By appointment only', cs: 'Jen objednaní' }, samples: { en: 'Blood samples', cs: 'Odběry krve' } },
    }).label({ en: 'For whom', cs: 'Pro koho' })
      .help({ en: 'Clock Face colours the arc of the clock by it. Waiting Room shows only the note.', cs: 'Ciferník podle toho obarví oblouk na ciferníku. Čekárna ukazuje jen poznámku.' }),
    // Rows are ordered by day and time; the order here only settles two rows that start together.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── notices ──
export const Notice = defineEntity('notice', {
  label: { en: 'Notices', cs: 'Oznámení' },
  labelSingular: { en: 'Notice', cs: 'Oznámení' },
  description: { en: 'Holidays, vaccination, a shorter day. A notice shows only while it is valid; the section disappears when there is none.', cs: 'Dovolená, očkování, kratší den. Oznámení se ukazuje jen po dobu platnosti; když žádné není, sekce zmizí.' },
  icon: 'i-lucide-bell',
  titleField: 'title',
  admin: { list: { columns: ['title', 'validFrom', 'validTo', 'important'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Nadpis' }),
    text: f.text({ required: true, multiline: true }).label({ en: 'Text', cs: 'Text' })
      .help({ en: 'An empty line starts a new paragraph. On the important notice the paragraphs after the first are set in bold. Text between *asterisks* stands out too.', cs: 'Prázdný řádek začne nový odstavec. U důležitého oznámení se odstavce za prvním vysází tučně. Text mezi *hvězdičkami* se také zvýrazní.' }),
    validFrom: f.datetime({ allDay: true }).optional().label({ en: 'Shown from', cs: 'Zobrazit od' }).help({ en: 'Empty: shown at once.', cs: 'Prázdné: ukáže se hned.' }),
    validTo: f.datetime({ allDay: true }).optional().label({ en: 'Shown until', cs: 'Zobrazit do' }).help({ en: 'The last day it is shown. Empty: shown until you remove it.', cs: 'Poslední den, kdy se ukazuje. Prázdné: ukazuje se, dokud ho neodstraníte.' }),
    important: f.boolean().label({ en: 'Important', cs: 'Důležité' })
      .help({ en: 'The first important notice stands large above the rest.', cs: 'První důležité oznámení stojí velké nad ostatními.' }),
    dateLine: f.text().optional().label({ en: 'Line above the title', cs: 'Řádek nad nadpisem' })
      .help({ en: 'For example “until the vaccine runs out”. Waiting Room writes it above the title of the smaller notices.', cs: 'Například „do vyčerpání vakcíny“. Čekárna ho napíše nad nadpis menších oznámení.' }),
    badge: f.text({ max: 24 }).optional().label({ en: 'Short date for the disc', cs: 'Krátké datum do kruhu' })
      .help({ en: 'For example “21.–31. prosince” or “2. 12.”. Clock Face puts it in a disc beside the notice. Empty: the icon below.', cs: 'Například „21.–31. prosince“ nebo „2. 12.“. Ciferník ho dá do kruhu vedle oznámení. Prázdné: ikona níže.' }),
    icon: f.select({
      options: ['bell', 'shield-plus', 'info', 'calendar', 'phone'] as const, default: 'bell',
      labels: { 'bell': { en: 'Bell', cs: 'Zvonek' }, 'shield-plus': { en: 'Shield with a cross', cs: 'Štít s křížkem' }, 'info': { en: 'Information', cs: 'Informace' }, 'calendar': { en: 'Calendar', cs: 'Kalendář' }, 'phone': { en: 'Phone', cs: 'Telefon' } },
    }).label({ en: 'Icon', cs: 'Ikona' }).help({ en: 'Clock Face draws it beside a notice that has no short date.', cs: 'Ciferník ji nakreslí u oznámení, které nemá krátké datum.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── what the practice does and what it costs ──
export const Service = defineEntity('service', {
  label: { en: 'Services', cs: 'Služby' },
  labelSingular: { en: 'Service', cs: 'Služba' },
  description: { en: 'What insurance covers makes the list of services; what it does not cover makes the price list.', cs: 'Co hradí pojišťovna, tvoří seznam služeb; co nehradí, tvoří ceník.' },
  icon: 'i-lucide-stethoscope',
  titleField: 'name',
  admin: { list: { columns: ['name', 'covered', 'price'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    text: f.text({ multiline: true }).optional().label({ en: 'A few words about it', cs: 'Pár slov k tomu' }).help({ en: 'Shown in the list of services. The price list shows only the name.', cs: 'Ukáže se v seznamu služeb. Ceník ukazuje jen název.' }),
    covered: f.boolean({ default: true }).label({ en: 'Paid by insurance', cs: 'Hradí pojišťovna' })
      .help({ en: 'On: the service is in the list of services. Off: it is in the price list, with its price.', cs: 'Zapnuto: služba je v seznamu služeb. Vypnuto: je v ceníku, s cenou.' }),
    price: f.number({ int: true, min: 0 }).optional().label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
    priceNote: f.text().optional().label({ en: 'Note to the price', cs: 'Poznámka k ceně' }).help({ en: 'For example “up to 50 years, vaccine included”. It stands under the name in the price list.', cs: 'Například „do 50 let, včetně vakcíny“. Stojí pod názvem v ceníku.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── who looks after you ──
export const TeamMember = defineEntity('teamMember', {
  label: { en: 'Team', cs: 'Tým' },
  labelSingular: { en: 'Team member', cs: 'Člen týmu' },
  description: { en: 'Doctors and nurses, with a portrait. Drag to put them in order.', cs: 'Lékaři a sestry s fotografií. Pořadí změníte přetažením.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  admin: { list: { columns: ['name', 'role'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name with title', cs: 'Jméno s titulem' }),
    role: f.text().optional().label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “general nurse”.', cs: 'Například „všeobecná sestra“.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Portrait', cs: 'Fotografie' })
      .help({ en: 'A portrait, 4 : 5 is best. Clock Face crops a circle from its upper part.', cs: 'Nejlépe portrét na výšku 4 : 5. Ciferník z jeho horní části vyřízne kruh.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'One or two sentences', cs: 'Jedna až dvě věty' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo'] },
})

// ── insurers the practice has a contract with ──
export const Insurer = defineEntity('insurer', {
  label: { en: 'Insurers', cs: 'Pojišťovny' },
  labelSingular: { en: 'Insurer', cs: 'Pojišťovna' },
  description: { en: 'The health insurers you have a contract with. The appointment form offers them too.', cs: 'Zdravotní pojišťovny, se kterými máte smlouvu. Nabízí je i formulář žádosti o termín.' },
  icon: 'i-lucide-shield-check',
  titleField: 'short',
  admin: { list: { columns: ['code', 'short', 'name'], orderField: 'position' } },
  fields: {
    code: f.text({ required: true, max: 10 }).label({ en: 'Code', cs: 'Kód' }).help({ en: 'The number of the insurer, for example “111”.', cs: 'Číslo pojišťovny, například „111“.' }),
    short: f.text({ required: true, max: 20 }).label({ en: 'Abbreviation', cs: 'Zkratka' }),
    name: f.text({ required: true }).label({ en: 'Full name', cs: 'Celý název' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
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
  description: { en: 'The first screen: who and where, a photograph of the waiting room, and today’s opening hours, worked out from the Opening hours section.', cs: 'První obrazovka: kdo a kde, fotografie čekárny a dnešní ordinační hodiny, které se spočítají ze sekce Ordinační hodiny.' },
  icon: 'i-lucide-door-open',
  fields: {
    heading: heading(),
    lead: text().help({ en: 'Under the heading. Clock Face adds a sentence about today after it.', cs: 'Pod nadpisem. Ciferník za něj přidá větu o dnešku.' }),
    image: photo('Photograph of the waiting room', 'Fotografie čekárny')
      .help({ en: 'Waiting Room shows it beside the text, Clock Face in an arch with the clock over its corner.', cs: 'Čekárna ji ukáže vedle textu, Ciferník v oblouku s hodinami přes její roh.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
  },
})

const notices = defineBlock({
  label: { en: 'Notices', cs: 'Oznámení' },
  description: { en: 'The notices from the Notices section that are valid today. Without any, the section is left out.', cs: 'Oznámení ze sekce Oznámení, která dnes platí. Když žádné není, sekce se vynechá.' },
  icon: 'i-lucide-bell',
  fields: {
    heading: heading().help({ en: 'Clock Face does not show the heading, only screen readers read it.', cs: 'Ciferník nadpis neukazuje, čtou ho jen čtečky obrazovky.' }),
  },
})

const hours = defineBlock({
  label: { en: 'Opening hours', cs: 'Ordinační hodiny' },
  description: { en: 'The whole week from the Opening hours section; today is marked. Closed days are folded into one line.', cs: 'Celý týden ze sekce Ordinační hodiny, dnešek je označený. Zavřené dny se sloučí do jednoho řádku.' },
  icon: 'i-lucide-clock',
  fields: {
    eyebrow: eyebrow().help({ en: 'Waiting Room writes it above the heading; Clock Face does not show it.', cs: 'Čekárna ho napíše nad nadpis; Ciferník ho neukazuje.' }),
    heading: heading(),
    text: text().help({ en: 'Waiting Room puts it beside the heading, Clock Face under it.', cs: 'Čekárna ho dá vedle nadpisu, Ciferník pod něj.' }),
  },
})

const widePhoto = defineBlock({
  label: { en: 'Photograph across the page', cs: 'Fotografie přes celou šířku' },
  description: { en: 'One wide photograph between two sections.', cs: 'Jedna široká fotografie mezi dvěma sekcemi.' },
  icon: 'i-lucide-image',
  fields: {
    image: photo(),
  },
})

const services = defineBlock({
  label: { en: 'Services', cs: 'Služby' },
  description: { en: 'The services paid by insurance, from the Services section.', cs: 'Služby hrazené pojišťovnou ze sekce Služby.' },
  icon: 'i-lucide-stethoscope',
  fields: {
    eyebrow: eyebrow().help({ en: 'Only Waiting Room shows it.', cs: 'Ukáže ho jen Čekárna.' }),
    heading: heading(),
    text: text(),
    coveredNote: f.text().label({ en: 'Sentence about insurance', cs: 'Věta o pojišťovně' }).help({ en: 'For example “Everything in this list is paid by insurance”.', cs: 'Například „Vše v tomto seznamu hradí pojišťovna“.' }),
    image: photo('Photograph for Clock Face', 'Fotografie pro Ciferník').help({ en: 'Clock Face shows it in an arch under the text, on a wide screen. Waiting Room does not show it.', cs: 'Ciferník ji na širokém displeji ukáže v oblouku pod textem. Čekárna ji neukazuje.' }),
  },
})

const prices = defineBlock({
  label: { en: 'Price list', cs: 'Ceník' },
  description: { en: 'The services that insurance does not cover, with their prices, from the Services section.', cs: 'Služby, které pojišťovna nehradí, s cenami ze sekce Služby.' },
  icon: 'i-lucide-banknote',
  fields: {
    heading: heading(),
    text: text().help({ en: 'For example when the price list is valid and how to pay.', cs: 'Například od kdy ceník platí a jak se platí.' }),
    image: photo('Photograph for Waiting Room', 'Fotografie pro Čekárnu').help({ en: 'Waiting Room shows it under the text.', cs: 'Čekárna ji ukáže pod textem.' }),
    roundImage: photo('Photograph for Clock Face', 'Fotografie pro Ciferník').help({ en: 'Clock Face shows it in a circle. Empty: the photograph above.', cs: 'Ciferník ji ukáže v kruhu. Prázdné: použije se fotografie výše.' }),
  },
})

const insurers = defineBlock({
  label: { en: 'Insurers', cs: 'Pojišťovny' },
  description: { en: 'The insurers from the Insurers section.', cs: 'Pojišťovny ze sekce Pojišťovny.' },
  icon: 'i-lucide-shield-check',
  fields: {
    heading: heading(),
  },
})

const team = defineBlock({
  label: { en: 'Team', cs: 'Tým' },
  description: { en: 'The doctors and nurses from the Team section, with their portraits.', cs: 'Lékaři a sestry ze sekce Tým s fotografiemi.' },
  icon: 'i-lucide-users',
  fields: {
    eyebrow: eyebrow().help({ en: 'Only Waiting Room shows it.', cs: 'Ukáže ho jen Čekárna.' }),
    heading: heading(),
    text: text(),
  },
})

const booking = defineBlock({
  label: { en: 'Booking and registration', cs: 'Objednání a registrace' },
  description: { en: 'How to make an appointment: the phone number from Site settings, what a first visit looks like, what to bring and the appointment request form. The requests arrive in the admin.', cs: 'Jak se objednat: telefon z Nastavení webu, jak vypadá první návštěva, co si vzít a formulář žádosti o termín. Žádosti najdete v administraci.' },
  icon: 'i-lucide-calendar-check',
  fields: {
    eyebrow: eyebrow().help({ en: 'Only Waiting Room shows it.', cs: 'Ukáže ho jen Čekárna.' }),
    heading: heading(),
    firstVisit: f.list({
      fields: { text: f.text({ required: true, multiline: true }).label({ en: 'Text', cs: 'Text' }) },
      max: 4, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'A first visit, step by step', cs: 'První návštěva krok za krokem' })
      .help({ en: 'Waiting Room numbers the steps; Clock Face joins all but the first into one sentence under “Are you here for the first time?”.', cs: 'Čekárna kroky očísluje; Ciferník všechny kromě prvního spojí do jedné věty pod „Jste u nás poprvé?“.' }),
    bring: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Text', cs: 'Text' }) },
      max: 8, itemLabel: { en: 'Thing', cs: 'Věc' },
    }).label({ en: 'What to bring to the first visit', cs: 'Co si vzít na první návštěvu' })
      .help({ en: 'Waiting Room ticks them in a list, Clock Face sets them as little pills.', cs: 'Čekárna je vypíše se zatržítky, Ciferník jako malé pilulky.' }),
    formText: f.text({ multiline: true }).label({ en: 'Text above the form', cs: 'Text nad formulářem' }).help(BOLD_HELP),
    privacyUrl: link('Page about personal data', 'Stránka o ochraně údajů')
      .help({ en: 'The link “How we handle your data” beside the consent leads here.', cs: 'Sem vede odkaz „Jak s údaji zacházíme“ u souhlasu.' }),
  },
})

const location = defineBlock({
  label: { en: 'Where to find us', cs: 'Kde nás najdete' },
  description: { en: 'A photograph of the house, the address, how to get there and a link to a map (from Site settings).', cs: 'Fotografie domu, adresa, jak se k nám dostat a odkaz do mapy (z Nastavení webu).' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow().help({ en: 'Only Waiting Room shows it.', cs: 'Ukáže ho jen Čekárna.' }),
    heading: heading().help({ en: 'Usually the street and number.', cs: 'Obvykle ulice a číslo.' }),
    text: text(),
    image: photo('Photograph of the house', 'Fotografie domu'),
    facts: f.list({
      fields: {
        icon: f.select({
          options: ['bus', 'parking', 'access', 'door', 'car', 'info'] as const, default: 'info',
          labels: { bus: { en: 'Bus stop', cs: 'Zastávka' }, parking: { en: 'Parking', cs: 'Parkování' }, access: { en: 'Step-free access', cs: 'Bez bariér' }, door: { en: 'Door', cs: 'Dveře' }, car: { en: 'Car', cs: 'Auto' }, info: { en: 'Information', cs: 'Informace' } },
        }).label({ en: 'Icon', cs: 'Ikona' }),
        title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 6, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'How to get here', cs: 'Jak se k nám dostat' })
      .help({ en: 'Waiting Room shows them in two columns in this order. Clock Face leaves out the bus stop (its minute rings tell the way) and puts step-free access, the door and parking in rows.', cs: 'Čekárna je ukáže ve dvou sloupcích v tomto pořadí. Ciferník vynechá zastávku (cestu říkají jeho kroužky s minutami) a bez bariér, dveře a parkování dá do řádků.' }),
    walks: f.list({
      fields: {
        minutes: f.number({ int: true, min: 1, max: 60 }).label({ en: 'Minutes', cs: 'Minuty' }),
        place: f.text({ required: true }).label({ en: 'From where', cs: 'Odkud' }).help({ en: 'For example “from the square”.', cs: 'Například „z náměstí“.' }),
        how: f.text().label({ en: 'How', cs: 'Jak' }).help({ en: 'For example “on foot, on the flat”.', cs: 'Například „pěšky po rovině“.' }),
      },
      max: 3, itemLabel: { en: 'Walk', cs: 'Cesta' },
    }).label({ en: 'Minutes from places', cs: 'Minuty z míst' })
      .help({ en: 'Only Clock Face shows them, as rings with the minutes (a full ring is ten minutes).', cs: 'Ukáže je jen Ciferník, jako kroužky s minutami (celý kruh je deset minut).' }),
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
  blocks: { opening, notices, hours, photo: widePhoto, services, prices, insurers, team, booking, location, text: richText, ...kitEntryBlocks() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    legal: { en: 'Links for patients in the footer', cs: 'Odkazy pro pacienty v zápatí' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the requests of the form below
]

// ── the appointment request ──
// The website draws it per look (the kit's useSiteForm). The insurer is chosen from the
// Insurers section: it is a text here because a form has fixed fields.
export const Appointment = defineForm('appointment', {
  label: { en: 'Appointment requests', cs: 'Žádosti o termín' },
  labelSingular: { en: 'Appointment request', cs: 'Žádost o termín' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    birthYear: f.text({ required: true, max: 4 }).label({ en: 'Year of birth', cs: 'Rok narození' }).help({ en: 'for example 1958', cs: 'např. 1958' }),
    phone: f.text({ required: true, max: 40 }).label({ en: 'Phone', cs: 'Telefon' }),
    insurer: f.text({ required: true, max: 100 }).label({ en: 'Health insurer', cs: 'Zdravotní pojišťovna' }),
    reason: f.text({ multiline: true, max: 3000 }).optional().label({ en: 'What brings you', cs: 'S čím přicházíte' }).help({ en: 'A check-up, blood pressure, registration…', cs: 'Preventivní prohlídka, kontrola tlaku, registrace…' }),
    when: f.select({
      options: ['asap', 'morning', 'afternoon'] as const, default: 'asap',
      labels: { asap: { en: 'As soon as possible', cs: 'Co nejdřív' }, morning: { en: 'Morning', cs: 'Dopoledne' }, afternoon: { en: 'Afternoon', cs: 'Odpoledne' } },
    }).label({ en: 'When suits you', cs: 'Kdy se vám to hodí' }),
    consent: f.boolean({ mustBeTrue: true }).label({ en: 'I agree to my data being processed to deal with the request.', cs: 'Souhlasím se zpracováním údajů pro vyřízení žádosti.' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send request', cs: 'Odeslat žádost' },
  successMessage: { en: 'Thank you, we have your request. We will call you within two working days.', cs: 'Děkujeme, žádost máme. Zavoláme vám do dvou pracovních dnů.' },
})
export const FormSettings = defineFormSettings()
