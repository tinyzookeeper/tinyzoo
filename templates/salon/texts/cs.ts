// Every Czech text of the Salon template, in one place: the website's own words (what is not
// content: "Objednat se", the days of the week, the anchors of the sections) and the demo
// content the seed puts in. Another language is a file beside this one with the same two exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

/** A day's hours as the looks write them (the part of `OpenDay` they need; no import, the unit specs load this file outside Nuxt). */
interface DayHours { index: number; name: string; fromText: string; toText: string }
/** What the hours say about today: the day when open, and the next open day. */
interface Now { day: DayHours | null; next: { day: DayHours; ahead: number } | null }

export interface Words extends KitWords {
  toTop: (name: string) => string
  book: string
  order: string
  booking: string
  priceList: string
  callPhone: (phone: string) => string
  openMenu: string
  closeMenu: string
  followUs: string
  onTheWeb: string
  min: string
  from: string
  /** The hint under the price list's groups: a click books the service. */
  clickToBook: string
  /** "Pracuje: pondělí, úterý" for screen readers, from the days a person works. */
  worksLabel: (days: string[]) => string
  weekdays: string[]
  weekdaysShort: string[]
  /** "v pondělí", "ve středu": the day with its preposition, for "we open on…". */
  weekdaysOn: string[]
  /** The days of the week as Czech writes them in a date, Sunday first (the way a browser counts). */
  dayNames: string[]
  /** The booking form's choices when the visitor does not choose. */
  anyone: string
  undecided: string
  moreOnInstagram: string
  openMap: string
  today: string
  closed: string
  /** The addresses of the sections on a page (`/#cenik`), by block type. */
  anchors: Record<'opening' | 'pricelist' | 'team' | 'results' | 'firstVisit' | 'reviews' | 'booking' | 'visit' | 'brands', string>
  /** Zrcadlo's own lines. */
  zrcadlo: {
    /** "Otevřeno pondělí až sobota": the week, before the browser knows the day. */
    week: (first: number, last: number) => string
    /** "po–so" */
    menuWeek: (first: number, last: number) => string
    /** Today's hours, or when the salon opens next. */
    today: (now: Now) => string
    /** "5 služeb" */
    count: (n: number) => string
    whereWeAre: string
  }
  /** Šachovnice's own lines. */
  sachovnice: {
    /** "Po–so otevřeno": the week, before the browser knows the day. */
    week: (first: number, last: number) => string
    /** Today's hours, or when the salon opens next. */
    today: (now: Now) => string
    /** "5 služeb, od 590 Kč" */
    group: (n: number, cheapest: string) => string
    /** The last tile of the results. */
    more: string
    address: string
    about: string
    networks: string
    web: string
  }
  /** Výloha's own lines. */
  vyloha: {
    /** "pondělí až sobota": the week, before the browser knows the day. */
    week: (first: number, last: number) => string
    /** Today's hours as a few words, or when the salon opens next. */
    today: (now: Now) => string
    /** "Otevřeno" or "Zavřeno": the word on the plate on the door. */
    openWord: (now: Now | null) => string
    /** "Šípková 59, 506 01 Jičín v mapách" */
    inMaps: (address: string) => string
    /** The roman numeral of a step: I, II, III… */
    roman: (n: number) => string
    /** "od roku 2014" */
    since: (year: number) => string
    address: string
  }
}

const weekdays = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle']
const weekdaysShort = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const weekdaysOn = ['v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu', 'v neděli']
const lower = (i: number) => weekdays[i]!.toLowerCase()
const shortLower = (i: number) => weekdaysShort[i]!.toLowerCase()

export const words: Words = {
  ...KIT_WORDS.cs,
  toTop: (name) => `${name}, na začátek stránky`,
  book: 'Objednat se', order: 'Objednat', booking: 'Objednání', priceList: 'Ceník',
  callPhone: (phone) => `Zavolat ${phone}`,
  openMenu: 'Otevřít menu', closeMenu: 'Zavřít menu',
  followUs: 'Sledujte nás', onTheWeb: 'Na webu',
  min: 'min', from: 'od',
  clickToBook: 'Kliknutím na řádek službu rovnou objednáte.',
  worksLabel: (days) => `Pracuje: ${days.join(', ')}`,
  weekdays, weekdaysShort, weekdaysOn,
  dayNames: ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'],
  anyone: 'Kdokoli, kdo má volno', undecided: 'Ještě nevím, poradíme se',
  moreOnInstagram: 'Další na Instagramu',
  openMap: 'Otevřít v mapách',
  today: 'dnes', closed: 'zavřeno',
  anchors: {
    opening: 'uvod', pricelist: 'cenik', team: 'tym', results: 'promeny', firstVisit: 'poprve',
    reviews: 'recenze', booking: 'objednat', visit: 'kde', brands: 'znacky',
  },
  zrcadlo: {
    week: (first, last) => `Otevřeno ${lower(first)}${first === last ? '' : ` až ${lower(last)}`}`,
    menuWeek: (first, last) => `${shortLower(first)}–${shortLower(last)}`,
    today: ({ day, next }) => (day
      ? `Dnes (${day.name.toLowerCase()}) máme otevřeno ${day.fromText}–${day.toText} h`
      : next ? `Dnes máme zavřeno, otevíráme ${weekdaysOn[next.day.index]} v ${next.day.fromText} h` : 'Dnes máme zavřeno'),
    count: (n) => `${n} ${n > 4 ? 'služeb' : 'služby'}`,
    whereWeAre: 'Kde nás najdete',
  },
  sachovnice: {
    week: (first, last) => `${weekdaysShort[first]}${first === last ? '' : `–${shortLower(last)}`} otevřeno`,
    today: ({ day, next }) => (day
      ? `Dnes otevřeno ${day.fromText}–${day.toText}`
      : next ? `Dnes zavřeno · ${weekdaysOn[next.day.index]} ${next.day.fromText}–${next.day.toText}` : 'Dnes zavřeno'),
    group: (n, cheapest) => `${n} ${n > 4 ? 'služeb' : 'služby'}, od ${cheapest}`,
    more: 'Další práce každý týden',
    address: 'Adresa', about: 'Salon', networks: 'Sítě', web: 'Web',
  },
  vyloha: {
    week: (first, last) => `${lower(first)}${first === last ? '' : ` až ${lower(last)}`}`,
    today: ({ day, next }) => (day
      ? `dnes ${day.fromText}–${day.toText} h`
      : next ? `otevíráme ${weekdaysOn[next.day.index]} v ${next.day.fromText} h` : 'dnes zavřeno'),
    openWord: (now) => (now && !now.day ? 'Zavřeno' : 'Otevřeno'),
    inMaps: (address) => `${address} v mapách`,
    roman: (n) => ['I', 'II', 'III', 'IV', 'V', 'VI'][n - 1] ?? String(n),
    since: (year) => `od roku ${year}`,
    address: 'Adresa',
  },
  defaultName: 'Salon',
}

// ── the demo content: the fictional Salon Pěšinka, a hairdresser and barber in a town house in
//    Jičín. The street, the people, the phone numbers, the addresses and the products are
//    invented; the photographs are the salon on an overcast morning. `demo` is worded as
//    Zrcadlo's design words it; `demoByLook` (below) holds what the other two designs word
//    differently. ──

/** The blocks of the home page, by the name the seed gives them. */
type Section = 'opening' | 'pricelist' | 'team' | 'results' | 'firstVisit' | 'reviews' | 'booking' | 'visit' | 'brands'

interface ResultDemo { photo: 'balayage' | 'fade' | 'drdol' | 'kudrny' | 'bob'; title: string; by: string; service: string; facts?: string }
interface PersonDemo { name: string; role: string; bio: string; days: number[]; bookLabel?: string }

export const demo = {
  settings: {
    siteName: 'Pěšinka',
    tagline: 'Kadeřnictví · Jičín',
    phone: '123 456 701',
    email: 'ahoj@salon-pesinka.example',
    address: 'Šípková 59',
    town: '506 01 Jičín',
    mapUrl: 'https://mapy.example/salon-pesinka',
    instagram: 'https://instagram.example/salonpesinka',
    facebook: 'https://facebook.example/salonpesinka',
    hours: [
      { day: 'mon' as const, from: '9', to: '18' },
      { day: 'tue' as const, from: '8', to: '19' },
      { day: 'wed' as const, from: '8', to: '19' },
      { day: 'thu' as const, from: '9', to: '18' },
      { day: 'fri' as const, from: '8', to: '17' },
      { day: 'sat' as const, from: '8', to: '12' },
      { day: 'sun' as const, from: '', to: '' },
    ],
    hoursNote: 'Poslední zákazníky bereme hodinu před zavřením, na barvení dvě a půl hodiny.',
    hoursShort: 'po–pá od 8 nebo 9 h, so 8–12 h',
    about: 'Kadeřnictví pro dámy, pány i děti v Šípkové ulici v Jičíně. Stříháme od roku 2014.',
    founded: 2014,
    legal: '© 2026 Salon Pěšinka · Radka Vejvodová, IČO 12345678, zapsána v živnostenském rejstříku. Nejsme plátci DPH.',
    metaTitle: 'Salon Pěšinka · kadeřnictví v Jičíně',
    metaDescription: 'Kadeřnictví pro dámy, pány i děti v Šípkové ulici v Jičíně. Ceník, tým a objednání termínu.',
  },
  // What each photograph shows, for people who cannot see it.
  photos: {
    hero: 'Kadeřnice Radka češe zákaznici v křesle u okna salonu',
    bob: 'Měděné mikádo po bradu, pohled zezadu',
    radka: 'Radka Vejvodová',
    simona: 'Simona Hájková',
    tomas: 'Tomáš Kubát',
    eliska: 'Eliška Nová',
    balayage: 'Dlouhé hnědé vlasy s medovou balayage, pohled zezadu',
    fade: 'Pánský střih s nízkým fade, pohled zezadu',
    drdol: 'Svatební nízký drdol ze světlých vlasů',
    kudrny: 'Kudrnaté vlasy po ramena po střihu nasucho',
    detail: 'Police s lahvičkami, hřebeny a ručníky',
    dum: 'Dům se zelenou výlohou v Šípkové ulici, kde salon sídlí',
  },
  groups: ['Dámské střihy', 'Pánské střihy a vousy', 'Barvení', 'Péče a kúry', 'Děti a studenti'],
  // group (index in `groups`), name, minutes, price, "from" price, note, quick-price label
  services: [
    { group: 0, name: 'Střih, mytí a foukaná', minutes: 60, price: 590, priceFrom: true, note: 'podle délky vlasů', quickLabel: 'Dámský střih s foukanou' },
    { group: 0, name: 'Střih bez foukané', minutes: 30, price: 390 },
    { group: 0, name: 'Mytí a foukaná', minutes: 40, price: 390, priceFrom: true },
    { group: 0, name: 'Zastřižení ofiny', minutes: 10, price: 90, note: 'mezi dvěma střihy zdarma' },
    { group: 0, name: 'Společenský účes', minutes: 60, price: 790, priceFrom: true },
    { group: 0, name: 'Svatební účes se zkouškou', minutes: 120, price: 2400 },
    { group: 1, name: 'Pánský střih', minutes: 30, price: 350, quickLabel: 'Pánský střih' },
    { group: 1, name: 'Střih strojkem', minutes: 20, price: 250 },
    { group: 1, name: 'Fade', minutes: 45, price: 420, note: 'přechod do ztracena' },
    { group: 1, name: 'Úprava vousů', minutes: 20, price: 220 },
    { group: 1, name: 'Střih a vousy', minutes: 50, price: 520 },
    { group: 2, name: 'Barvení odrostů', minutes: 90, price: 890, priceFrom: true, quickLabel: 'Barvení odrostů' },
    { group: 2, name: 'Barvení celých vlasů', minutes: 120, price: 1190, priceFrom: true },
    { group: 2, name: 'Melír do fólií', minutes: 150, price: 1490, priceFrom: true },
    { group: 2, name: 'Balayage', minutes: 210, price: 2400, priceFrom: true, note: 'včetně tónování' },
    { group: 2, name: 'Tónování', minutes: 45, price: 450, priceFrom: true },
    { group: 2, name: 'Stažení barvy', minutes: 180, price: 1900, priceFrom: true, note: 'jen po konzultaci' },
    { group: 3, name: 'Regenerace vazeb', minutes: 20, price: 350, note: 'k barvení i samostatně' },
    { group: 3, name: 'Keratinová kúra', minutes: 120, price: 1600, priceFrom: true },
    { group: 3, name: 'Masáž hlavy s maskou', minutes: 15, price: 190 },
    { group: 3, name: 'Trvalá', minutes: 120, price: 1100, priceFrom: true },
    { group: 4, name: 'První stříhání', minutes: 20, price: 190, note: 's diplomem a pramínkem na památku' },
    { group: 4, name: 'Dětský střih do 10 let', minutes: 20, price: 220 },
    { group: 4, name: 'Dětský střih 11–15 let', minutes: 30, price: 280 },
    { group: 4, name: 'Studentský střih', minutes: 30, price: 300, note: 'po předložení průkazu' },
  ],
  // Monday to Saturday, as the six days they work
  team: [
    { name: 'Radka Vejvodová', role: 'Majitelka, kadeřnice', bio: 'Dámské střihy, balayage a zesvětlování. Stříhá od roku 2003.', days: [1, 1, 0, 1, 1, 0] },
    { name: 'Simona Hájková', role: 'Koloristka', bio: 'Barvy, melír, měděné a blond odstíny, střih kudrnatých vlasů.', days: [0, 1, 1, 0, 1, 1] },
    { name: 'Tomáš Kubát', role: 'Holič', bio: 'Pánské střihy, fade a úprava vousů břitvou i strojkem.', days: [0, 0, 1, 1, 1, 1] },
    { name: 'Eliška Nová', role: 'Kadeřnice', bio: 'Dětské střihy, společenské a svatební účesy, foukaná.', days: [1, 0, 1, 1, 0, 0] },
  ] as PersonDemo[],
  // The photograph, the title, who did it (a team member), the service it was; in the order of the design
  results: [
    { photo: 'balayage', title: 'Balayage na tmavém základu', by: 'Radka Vejvodová', service: 'Balayage' },
    { photo: 'fade', title: 'Nízký fade', by: 'Tomáš Kubát', service: 'Fade' },
    { photo: 'drdol', title: 'Svatební drdol', by: 'Eliška Nová', service: 'Svatební účes se zkouškou' },
    { photo: 'kudrny', title: 'Kudrny, střih nasucho', by: 'Simona Hájková', service: 'Střih, mytí a foukaná' },
    { photo: 'bob', title: 'Měděné mikádo', by: 'Simona Hájková', service: 'Barvení celých vlasů' },
  ] as ResultDemo[],
  reviews: [
    { name: 'Markéta D.', about: 'melír a tónování', text: 'K Simoně chodím třetí rok a poprvé v životě mám blond, která nežloutne. A vždycky mi řekne narovinu, co moje vlasy vydrží.' },
    { name: 'Jakub S.', about: 'pánský střih', text: 'Objednal jsem se přes web v neděli večer, ve středu jsem seděl v křesle. Fade přesně podle fotky, za půl hodiny hotovo.' },
    { name: 'Hana P.', about: 'první stříhání', text: 'Dcera se stříhání bála. Eliška nejdřív učesala plyšáka a pak už to šlo samo. Domů jsme nesly diplom.' },
  ],
  // The sections of the home page, top to bottom, and the menu: sections of it, by name.
  home: ['opening', 'pricelist', 'team', 'results', 'firstVisit', 'reviews', 'booking', 'visit', 'brands'] as Section[],
  menuSections: ['pricelist', 'team', 'results', 'firstVisit', 'visit'] as Section[],
  menu: { pricelist: 'Ceník', team: 'Tým', results: 'Proměny', firstVisit: 'Jdu poprvé', visit: 'Kde jsme', privacy: 'Ochrana osobních údajů' } as Partial<Record<Section | 'privacy', string>>,
  opening: {
    eyebrow: 'Kadeřnictví pro dámy, pány i děti · Jičín',
    heading: 'Střih, barva a hodina klidu v Šípkové ulici',
    text: 'Čtyři kadeřníci, kteří se nejdřív zeptají a pak teprve stříhají. Dámský střih od 590 Kč, pánský za 350 Kč. O termín si napíšete za minutu a potvrdíme ho ještě ten den.',
    primaryLabel: 'Objednat se', secondaryLabel: 'Ceník',
    badgeLabel: 'Střih od', badgeValue: '350 Kč',
    arc: 'DÁMSKÉ · PÁNSKÉ · DĚTSKÉ',
  },
  pricelist: {
    eyebrow: 'Ceník',
    heading: 'Kolik to stojí a jak dlouho to trvá',
    text: 'Ciferník u každé služby ukazuje, kolik času si na vás vyhradíme: plný kruh je hodina. Ceny „od“ platí pro vlasy po ramena, u delších řekneme částku předem.',
    footnote: 'V ceně barvení je mytí a foukaná. Střih se připočítává podle ceníku.',
  },
  teamBlock: {
    eyebrow: 'Tým',
    heading: 'Kdo vás ostříhá',
    text: 'Každý z nás má, co dělá nejraději. Když si nejste jistí, ke komu jít, napište do objednávky „kdokoli“ a vybereme podle služby.',
    bookLabel: 'Objednat termín',
  },
  resultsBlock: { eyebrow: 'Proměny', heading: 'Co odešlo z našich křesel', text: '' },
  firstVisit: {
    eyebrow: 'Jdete poprvé',
    heading: 'Jak vypadá první návštěva',
    text: 'Na nové zákazníky si necháváme o čtvrt hodiny víc. Stačí to napsat do objednávky.',
    steps: [
      { heading: 'Nejdřív si popovídáme', text: 'Zeptáme se, jak vlasy nosíte, kolik času jim ráno dáte a co vám na nich vadí. Fotky účesů si klidně přineste.' },
      { heading: 'Cenu znáte předem', text: 'U barvení a delších vlasů řekneme částku dřív, než začneme. U pokladny vás nic nepřekvapí.' },
      { heading: 'Pak teprve nůžky', text: 'Mytí, střih, foukaná. K tomu káva, čaj nebo voda a nikdo na vás nespěchá.' },
      { heading: 'Doma to zvládnete taky', text: 'Ukážeme, jak účes ráno upravit, a zapíšeme si odstín i postup, ať příště navážeme.' },
    ],
  },
  reviewsBlock: { heading: 'Co o nás říkají' },
  booking: {
    eyebrow: 'Objednání',
    heading: 'Napište si o termín',
    text: 'Vyplnění trvá minutu. Ozveme se ještě ten den, v sobotu odpoledne a v neděli hned v pondělí ráno, a termín potvrdíme SMS.',
    phoneLabel: 'Raději zavoláte?',
    phoneNote: 'Telefon bereme v otevírací době. Když zrovna stříháme, voláme zpátky do hodiny.',
    submitLabel: 'Odeslat žádost o termín',
    note: 'Termín platí, až ho potvrdíme. Zrušit ho můžete nejpozději den předem.',
  },
  visit: {
    eyebrow: 'Otevírací doba',
    heading: 'Kdy máme otevřeno',
    ways: [
      { label: 'Pěšky', text: 'Dvě minuty od hlavního náměstí: kolem kašny a rovně, dům se zelenou výlohou vpravo.' },
      { label: 'Autem', text: 'Šípková je pěší zóna. Parkoviště u nádraží je tři minuty chůze.' },
      { label: 'S kočárkem', text: 'U vchodu je jeden nízký schod, s kočárkem rádi pomůžeme. Pro děti máme podsedák.' },
    ],
  },
  brands: {
    heading: 'S čím pracujeme',
    names: ['Brumel', 'Kolora Professional', 'Mendal', 'N18', 'Tarsen'],
    text: 'Myjeme a pečujeme s Brumel, barvíme barvami Kolora, vlasy po zesvětlení ošetřujeme kúrami Mendal a N18, pánům stylujeme s Tarsen. Všechno si můžete koupit domů a poradíme, co má pro vaše vlasy smysl.',
    voucherEyebrow: 'Dárek',
    voucherHeading: 'Dárkový poukaz',
    voucherText: 'Na částku, nebo na konkrétní službu. Platí rok. Vyzvednete si ho v salonu, nebo ho pošleme e‑mailem k vytištění.',
    amounts: [500, 1000, 2000],
    voucherLabel: 'Objednat poukaz e‑mailem',
  },
  privacy: {
    title: 'Ochrana osobních údajů',
    slug: 'ochrana-osobnich-udaju',
    heading: 'Ochrana osobních údajů',
    intro: 'Tento text je ukázkový: nahraďte ho vlastním zněním. Říká, jaké údaje o vás salon zpracovává, proč a jak dlouho.',
    sections: [
      { heading: 'Co zpracováváme', text: 'Jméno a telefon, které nám pošlete v žádosti o termín, abychom se vám mohli ozvat a termín potvrdit.' },
      { heading: 'Jak dlouho to uchováváme', text: 'Žádost o termín smažeme nejpozději rok po návštěvě. Údaje nikomu nepředáváme.' },
      { heading: 'Kdo za to odpovídá', text: 'Salon Pěšinka, Radka Vejvodová, IČO 12345678, Šípková 59, 506 01 Jičín. Ozvat se můžete na ahoj@salon-pesinka.example.' },
    ],
  },
}

// What the designs of Šachovnice and Výloha word differently from Zrcadlo's: a site made in
// that look gets these laid over the texts above (the seed is told the look), and its home page
// has the sections that design has, in that design's order. Lists are replaced whole.
const wayStroller = { label: 'S kočárkem', text: 'U vchodu je jeden nízký schod, s kočárkem rádi pomůžeme.' }
const brandsText = 'Myjeme a pečujeme s Brumel, barvíme barvami Kolora, vlasy po zesvětlení ošetřujeme kúrami Mendal a N18, pánům stylujeme s Tarsen. Všechno si můžete koupit domů.'
const [way1, way2] = demo.visit.ways

export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  sachovnice: {
    settings: { about: 'Kadeřnictví a holičství pro dámy, pány i děti. Stříháme od roku 2014.' },
    home: ['opening', 'pricelist', 'team', 'results', 'booking', 'firstVisit', 'reviews', 'visit', 'brands'],
    menu: { pricelist: 'Ceník', team: 'Lidi', results: 'Práce', firstVisit: 'Poprvé', visit: 'Kdy a kde' },
    opening: {
      eyebrow: 'Kadeřnictví a holičství · Šípková 59',
      heading: 'Stříháme Jičín.',
      text: 'Dámy, pány i děti, od pondělí do soboty. Střih od 350 Kč, barva od 890 Kč. Termín si napíšete za minutu.',
    },
    pricelist: {
      heading: 'Ceník. Bez hvězdiček.',
      text: 'Co je napsáno, to platí. Jeden čtvereček je čtvrthodina v křesle. „Od“ znamená vlasy po ramena, u delších řekneme cenu předem.',
    },
    teamBlock: {
      heading: 'Čtyři křesla, čtyři lidi.',
      text: 'Každý má svoje. Vyplněné políčko znamená, že ten den stříhá. Nevíte, ke komu? Napište „kdokoli“ a vybereme podle služby.',
      bookLabel: 'Chci k nim',
    },
    team: [
      { ...demo.team[0]!, bookLabel: 'Chci k Radce' },
      { ...demo.team[1]!, bookLabel: 'Chci k Simoně' },
      { ...demo.team[2]!, bookLabel: 'Chci k Tomášovi' },
      { ...demo.team[3]!, bookLabel: 'Chci k Elišce' },
    ],
    results: [
      { photo: 'balayage', title: 'Balayage na tmavém základu', by: 'Radka Vejvodová', service: 'Balayage' },
      { photo: 'fade', title: 'Nízký fade', by: 'Tomáš Kubát', service: 'Fade' },
      { photo: 'bob', title: 'Měděné mikádo', by: 'Simona Hájková', service: 'Barvení celých vlasů', facts: 'barva od 1 190 Kč · 120 min' },
      { photo: 'drdol', title: 'Svatební drdol', by: 'Eliška Nová', service: 'Svatební účes se zkouškou', facts: '2 400 Kč · se zkouškou' },
      { photo: 'kudrny', title: 'Kudrny, střih nasucho', by: 'Simona Hájková', service: 'Střih, mytí a foukaná' },
    ],
    resultsBlock: {
      heading: 'Tohle od nás odešlo.',
      text: 'Bez filtrů, focené u okna hned po foukané. U každé práce je, kdo ji dělal a kolik stojí.',
    },
    firstVisit: {
      heading: 'Poprvé? V klidu.',
      text: 'Na nové lidi si necháváme o čtvrt hodiny víc. Stačí to napsat do objednávky.',
      steps: [
        { heading: 'Nejdřív si popovídáme', text: 'Jak vlasy nosíte, kolik času jim ráno dáte a co vám na nich vadí. Fotky účesů si klidně přineste.' },
        ...demo.firstVisit.steps.slice(1),
      ],
    },
    reviewsBlock: { heading: 'Říkají o nás' },
    booking: {
      heading: 'Chci termín.',
      text: 'Vyplňte šest políček. Ozveme se ještě ten den a termín potvrdíme SMS. Zrušit jde nejpozději den předem.',
      phoneLabel: 'Nebo prostě zavolejte',
      phoneNote: 'Bereme to v otevírací době. Když zrovna stříháme, voláme zpátky do hodiny.',
      note: 'Termín platí, až ho potvrdíme.',
    },
    visit: { heading: 'Kdy a kde.', ways: [{ label: 'Pěšky', text: 'Dvě minuty od hlavního náměstí: kolem kašny a pak rovně, dům se zelenou výlohou stojí hned vpravo.' }, way2!, wayStroller] },
    brands: { heading: 'Čím to děláme', text: brandsText, voucherHeading: 'Poukaz.' },
  },
  vyloha: {
    settings: { tagline: 'Kadeřnictví & holičství · Jičín' },
    home: ['opening', 'results', 'pricelist', 'team', 'firstVisit', 'booking', 'reviews', 'visit', 'brands'],
    menu: { pricelist: 'Ceník', team: 'Kadeřníci', results: 'Práce', firstVisit: 'Jdu poprvé', visit: 'Kde jsme' },
    menuSections: ['pricelist', 'team', 'results', 'firstVisit', 'visit'],
    opening: {
      eyebrow: 'Kadeřnictví & holičství v Šípkové ulici',
      heading: 'Račte dál.',
      text: 'Stříháme, barvíme a holíme v Jičíně od roku 2014. Dámský střih od 590 Kč, pánský za 350 Kč, barvení od 890 Kč.',
    },
    resultsBlock: { heading: 'Z našich křesel' },
    results: [
      { photo: 'balayage', title: 'Balayage na tmavém základu', by: 'Radka Vejvodová', service: 'Balayage' },
      { photo: 'fade', title: 'Nízký fade', by: 'Tomáš Kubát', service: 'Fade' },
      { photo: 'drdol', title: 'Svatební drdol', by: 'Eliška Nová', service: 'Svatební účes se zkouškou' },
      { photo: 'bob', title: 'Měděné mikádo', by: 'Simona Hájková', service: 'Barvení celých vlasů' },
      { photo: 'kudrny', title: 'Kudrny, střih nasucho', by: 'Simona Hájková', service: 'Střih, mytí a foukaná' },
    ],
    pricelist: {
      eyebrow: 'Co u nás kolik stojí',
      heading: 'Ceník služeb',
      text: 'U každé služby je čas, který si na vás vyhradíme. Ceny „od“ platí pro vlasy po ramena, u delších řekneme částku dřív, než začneme.',
    },
    teamBlock: { eyebrow: 'Kadeřníci a holič', heading: 'V křesle vás přivítají', bookLabel: 'Zamluvit křeslo' },
    firstVisit: { heading: 'Jdete k nám poprvé?' },
    booking: {
      heading: 'Zamluvte si křeslo',
      text: 'Vyplnění trvá minutu. Ozveme se ještě ten den a termín potvrdíme SMS. Zrušit ho můžete nejpozději den předem.',
      submitLabel: 'Odeslat žádost',
      note: 'Termín platí, až ho potvrdíme.',
    },
    reviewsBlock: { heading: 'Řekli o nás' },
    visit: { heading: 'Otevřeno máme', ways: [way1!, way2!, wayStroller] },
    brands: { heading: 'Pracujeme s', text: brandsText, voucherLabel: 'Objednat poukaz' },
  },
}
