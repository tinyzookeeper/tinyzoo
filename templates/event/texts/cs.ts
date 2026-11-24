// Every Czech text of the Event template, in one place: the website's own words (what is not
// content: "Datum", "Start", the anchors of the sections) and the demo content the seed puts in
// (with what a look's design words differently: `demoByLook`). Another language is a file beside
// this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

export interface Words extends KitWords {
  skip: string
  toTop: (name: string) => string
  address: string
  /** The addresses of the sections on a page (`/#program`), by block type. */
  anchors: Record<'routes' | 'programme' | 'fees' | 'results' | 'gallery' | 'practical' | 'venue' | 'news' | 'faq' | 'partners', string>
  // the countdown
  countdownAria: string
  unitsShort: [days: string, hours: string, minutes: string, seconds: string]
  unitsLong: [days: string, hours: string, minutes: string]
  finished: string
  finishedText: string
  results: string
  photos: string
  registrationClosed: string
  // the facts of the event
  date: string
  place: string
  placesLeft: string
  feeNow: string
  /** "od 250 Kč" */
  from: (price: string) => string
  /** "do 28. 2." */
  until: (date: string) => string
  /** "z 600", "ze 150" */
  outOf: (total: number) => string
  /** "Zbývá 17 míst", "Zbývá 1 místo" */
  placesRemaining: (n: number) => string
  // routes
  track: string
  /** The same word in Overprint's table: "Trasa". */
  route: string
  elevation: string
  start: string
  fee: string
  free: string
  length: string
  feeFrom: string
  signUp: string
  // fees
  feeNowShort: string
  feeNowLong: string
  /** The caption of the fee table (for screen readers). */
  feeCaption: string
  crowns: string
  // programme
  startWord: string
  // results
  category: string
  winner: string
  time: string
  record: string
  courseRecord: string
  // venue
  plan: { aria: string; toTrack: string; finish: string; meadow: string; pond: string; town: string; fromTrack: string; scale: string; north: string }
  // organiser and footer
  race: string
  editions: string
  contact: string
  organizerCompanyId: (id: string) => string
  copyright: (year: number, name: string) => string
  // news
  backToNews: string
  noNews: string
  noResults: string
  // photographs
  swipePhotos: string
}

export const words: Words = {
  ...KIT_WORDS.cs,
  skip: 'Přeskočit na obsah',
  toTop: (name) => `${name}, úvod`,
  address: 'Adresa',
  anchors: {
    routes: 'trasy', programme: 'program', fees: 'startovne', results: 'vysledky', gallery: 'fotky',
    practical: 'informace', venue: 'misto', news: 'aktuality', faq: 'otazky', partners: 'kontakt',
  },
  countdownAria: 'Do startu zbývá',
  unitsShort: ['dní', 'hod', 'min', 's'],
  unitsLong: ['dní', 'hodin', 'minut'],
  finished: 'Závod už proběhl',
  finishedText: 'Děkujeme všem, kdo běželi, fandili a pomáhali.',
  results: 'Výsledky',
  photos: 'Fotky',
  registrationClosed: 'Přihlášky jsou uzavřeny',
  date: 'Datum',
  place: 'Místo',
  placesLeft: 'Volná místa',
  feeNow: 'Startovné teď',
  from: (price) => `od ${price} Kč`,
  until: (date) => `do ${date}`,
  // "ze" before a hundred ("ze 150"), "z" before the rest ("z 600")
  outOf: (total) => `${total >= 100 && total < 200 ? 'ze' : 'z'} ${total}`,
  placesRemaining: (n) => `Zbývá ${n} ${n === 1 ? 'místo' : n >= 2 && n <= 4 ? 'místa' : 'míst'}`,
  track: 'Trať',
  route: 'Trasa',
  elevation: 'Převýšení',
  start: 'Start',
  fee: 'Startovné',
  free: 'Volno',
  length: 'Délka',
  feeFrom: 'Startovné teď',
  signUp: 'Přihlásit se',
  feeNowShort: 'teď',
  feeNowLong: 'platí teď',
  feeCaption: 'Startovné podle trasy a termínu platby',
  crowns: 'Kč',
  startWord: 'start',
  category: 'Kat.',
  winner: 'Vítěz',
  time: 'Čas',
  record: 'rekord',
  courseRecord: 'traťový rekord',
  plan: {
    aria: 'Plán areálu: hřiště se startem a cílem, sokolovna s prezencí, parkoviště na louce, stany s občerstvením, zdravotník a autobusová zastávka na návsi',
    toTrack: 'na trať', finish: 'cíl', meadow: 'louka', pond: 'rybník', town: 'Žďár n. S. 9 km', fromTrack: 'z trati', scale: '100 m', north: 'S',
  },
  race: 'Závod',
  editions: 'Ročníky',
  contact: 'Kontakt',
  organizerCompanyId: (id) => `IČO ${id}`,
  copyright: (year, name) => `© ${year} ${name}`,
  backToNews: 'Všechny aktuality',
  noNews: 'Zatím tu nejsou žádné aktuality.',
  noResults: 'Výsledky tohoto ročníku zatím nejsou.',
  swipePhotos: 'Fotografie z loňského ročníku, posuňte do strany',
}

// ── the demo content: the fictional trail race Tři vrchy, 14th edition, in the Žďárské vrchy
//    highlands. The village club, the people, the phone numbers and the addresses are invented.
//    The date is the seed's: some months ahead, on a Saturday, so the demo never shows a past
//    event. Words in {braces} are the dates that follow from it (seed/index.ts fills them in):
//      {eventDate} 22. května 2027   {eventDay} 22. května   {eventShort} 22. 5.   {weekdayShort} sobota 22. 5.
//      {early} 28. února  {earlyShort} 28. 2.  {spring} 16. května  {refund} 30. dubna
//      {prevDate} 23. května 2026   {prevYear} 2026   {archiveTo} 2025   {nth} druhou   {monthAdj} květnovou
// ──

// One list of the routes' figures, the same in every look; each look words its descriptions.
const TRACKS = [
  {
    name: 'Tři vrchy', figure: '24', figureNote: ',1 km', length: '24 km', exactLength: '24,1 km', elevation: '+610 m', startTime: '10:00', capacity: 150, free: 17, prices: [490, 590, 700], forChildren: false,
    profile: '0 612\n1.2 622\n2.4 655\n3.6 700\n4.5 724\n5.4 690\n6.3 640\n7.2 604\n8.2 590\n9 582\n10 618\n11 676\n11.8 730\n12.5 761\n13.3 725\n14.2 668\n15.2 632\n16.3 598\n17.2 624\n18.2 690\n19.2 760\n20 801\n20.8 770\n21.6 705\n22.6 650\n23.4 626\n24.1 612',
    peaks: [{ km: 4.5, height: 724, label: '' }, { km: 12.5, height: 761, label: '' }, { km: 20, height: 801, label: '' }],
  },
  {
    name: 'Dva vrchy', figure: '12', figureNote: ',4 km', length: '12 km', exactLength: '12,4 km', elevation: '+330 m', startTime: '10:30', capacity: 200, free: 41, prices: [350, 420, 500], forChildren: false,
    profile: '0 612\n1.2 622\n2.4 655\n3.6 700\n4.5 724\n5.4 690\n6.3 640\n7 608\n7.8 640\n8.6 705\n9.3 761\n10.2 700\n11.2 640\n12.4 612',
    peaks: [{ km: 4.5, height: 724, label: '' }, { km: 9.3, height: 761, label: '' }],
  },
  {
    name: 'Jeden vrch', figure: '6', figureNote: ',2 km', length: '6 km', exactLength: '6,2 km', elevation: '+140 m', startTime: '11:00', capacity: 150, free: 62, prices: [250, 300, 350], forChildren: false,
    profile: '0 612\n1.2 622\n2.4 655\n3.3 700\n3.9 724\n4.6 680\n5.4 640\n6.2 612',
    peaks: [{ km: 3.9, height: 724, label: '' }],
  },
  {
    name: 'Dětské běhy', figure: '1', figureNote: 'km a méně', length: 'do 1 km', exactLength: '0,2–1 km', elevation: '15 m', startTime: '9:15', capacity: 100, free: 58, prices: [50, 50, 80], forChildren: true,
    profile: '0 612\n0.25 613\n0.5 618\n0.75 614\n1 612',
    peaks: [{ km: 1.33, height: 0, label: 'rovina' }],
  },
]

const trackTexts = {
  casomira: [
    { description: 'Kamenná, Bučina, Strážný. Kamenitý sestup od rozhledny, limit 5 hodin.', registerLabel: 'Přihlásit se na 24 km' },
    { description: 'Kamenná a Bučina, zpět údolím Lhotského potoka. Limit 3 hodiny.', registerLabel: 'Přihlásit se na 12 km' },
    { description: 'Na Kamennou a po louce dolů. Pro každého, kdo uběhne pětku.', registerLabel: 'Přihlásit se na 6 km' },
    { description: 'Čtyři kategorie, 3–13 let. Hřiště a hráz rybníka, medaile pro každého.', registerLabel: 'Přihlásit dítě', elevation: '15 m' },
  ],
  soutisk: [
    { description: 'Kamenná, Bučina a Strážný v jednom kole. Lesní pěšiny, kamenitý sestup od rozhledny a tři občerstvovačky.', registerLabel: 'Chci 24 km' },
    { description: 'Kamenná a Bučina, zpátky údolím Lhotského potoka. Dobrá první trailová dvanáctka: dva poctivé kopce a nic technického.', registerLabel: 'Chci 12 km' },
    { description: 'Na Kamennou a po louce dolů. Zvládne ji každý, kdo uběhne pět kilometrů po rovině. Psi na vodítku jsou vítaní.', registerLabel: 'Chci 6 km' },
    { description: 'Čtyři kategorie od školky po třináct let. Běhá se po hřišti a kolem rybníka, medaili dostane každé dítě.', registerLabel: 'Přihlásit dítě', elevation: 'do 15 m' },
  ],
} as const

const tracksFor = (look: keyof typeof trackTexts) => TRACKS.map((t, i) => ({ ...t, ...trackTexts[look][i] }))

// where the numbered points lie on the sample plan, in percent (Overprint's drawing puts the fifth point a little higher)
const pointPositions = [
  { x: 70.6, y: 48.3 }, { x: 54.4, y: 57 }, { x: 25, y: 52.3 }, { x: 73.8, y: 72.3 }, { x: 93.1, y: 71.9 }, { x: 30.6, y: 89.4 },
]
const pointPositionsSoutisk = pointPositions.map((p, i) => (i === 4 ? { x: 93.8, y: 69.8 } : p))

const winners = [
  { track: 'Tři vrchy', category: 'Muži', place: 1, name: 'Ondřej Havlík', club: 'AC Vrchovina Žďár', time: '1:44:38', record: true },
  { track: 'Tři vrchy', category: 'Ženy', place: 1, name: 'Tereza Kubíčková', club: 'Sokol Polnička', time: '2:03:51', record: false },
  { track: 'Dva vrchy', category: 'Muži', place: 1, name: 'Jakub Vrána', club: 'SK Borová Lhota', time: '0:49:12', record: false },
  { track: 'Dva vrchy', category: 'Ženy', place: 1, name: 'Markéta Šustrová', club: 'Běžci Chotěboř', time: '0:57:40', record: false },
  { track: 'Jeden vrch', category: 'Muži', place: 1, name: 'Matěj Dolejš', club: 'bez oddílu', time: '0:23:27', record: false },
  { track: 'Jeden vrch', category: 'Ženy', place: 1, name: 'Anna Peřinová', club: 'TJ Jiskra Herálec', time: '0:27:05', record: false },
  // the rest of the podium, for the page of full results
  { track: 'Tři vrchy', category: 'Muži', place: 2, name: 'Filip Kozel', club: 'Běžci Chotěboř', time: '1:48:02', record: false },
  { track: 'Tři vrchy', category: 'Muži', place: 3, name: 'David Strnad', club: 'SK Borová Lhota', time: '1:51:44', record: false },
  { track: 'Tři vrchy', category: 'Ženy', place: 2, name: 'Lucie Hanzalová', club: 'AC Vrchovina Žďár', time: '2:07:19', record: false },
  { track: 'Tři vrchy', category: 'Ženy', place: 3, name: 'Alena Skálová', club: 'bez oddílu', time: '2:12:56', record: false },
  { track: 'Dva vrchy', category: 'Muži', place: 2, name: 'Michal Pokorný', club: 'Sokol Polnička', time: '0:50:31', record: false },
  { track: 'Dva vrchy', category: 'Muži', place: 3, name: 'Radim Tvrdík', club: 'TJ Jiskra Herálec', time: '0:52:08', record: false },
  { track: 'Dva vrchy', category: 'Ženy', place: 2, name: 'Veronika Dubská', club: 'SK Borová Lhota', time: '0:59:03', record: false },
  { track: 'Dva vrchy', category: 'Ženy', place: 3, name: 'Hana Řezníčková', club: 'bez oddílu', time: '1:01:47', record: false },
  { track: 'Jeden vrch', category: 'Muži', place: 2, name: 'Petr Kuča', club: 'bez oddílu', time: '0:24:10', record: false },
  { track: 'Jeden vrch', category: 'Muži', place: 3, name: 'Adam Mach', club: 'SK Borová Lhota', time: '0:24:58', record: false },
  { track: 'Jeden vrch', category: 'Ženy', place: 2, name: 'Eliška Bartošová', club: 'Sokol Polnička', time: '0:28:14', record: false },
  { track: 'Jeden vrch', category: 'Ženy', place: 3, name: 'Karolína Vacková', club: 'bez oddílu', time: '0:29:33', record: false },
]

export const demo = {
  settings: {
    siteName: 'Tři vrchy',
    edition: 14,
    tagline: 'Terénní běh Žďárskými vrchy na 6, 12 a 24 km. Každou {nth} {monthAdj} sobotu od roku 2013 v Borové Lhotě.',
    venueName: 'Borová Lhota',
    venueArea: 'u Žďáru n. S.',
    address: 'Borová Lhota 184, 592 11',
    coordinates: '49.6318N, 15.9742E',
    mapUrl: 'https://mapy.example/borova-lhota-areal',
    ctaLabel: 'Přihlásit se',
    ctaUrl: 'https://prihlasky.example/tri-vrchy',
    // (a non-breaking space inside "z. s.": the abbreviation never breaks apart)
    organizerName: 'SK Borová Lhota, z.\u00a0s.',
    organizerAbout: 'Oddíl běhu a lyžování, 86 členů. Tři vrchy pořádáme od roku 2013 se čtyřiceti dobrovolníky ze vsi.',
    contactName: 'Radek Chalupa',
    contactRole: 'ředitel závodu',
    phone: '123 456 701',
    email: 'zavod@vrchy.example',
    companyId: '12345678',
    social: [
      { label: 'Facebook', url: 'https://facebook.example/behtrivrchy' },
      { label: 'Instagram', url: 'https://instagram.example/behtrivrchy' },
      { label: 'Strava', url: 'https://strava.example/clubs/behtrivrchy' },
    ],
    metaDescription: 'Terénní běh na 6, 12 a 24 km přes Kamennou, Bučinu a Strážný. {eventDate}, Borová Lhota u Žďáru nad Sázavou. Pořádá SK Borová Lhota.',
  },
  // The menu: the sections of the home page (by their block) and the pages. `to` is a section
  // (`routes`…) or an address.
  menu: {
    main: [
      { label: 'Tratě', to: 'routes' }, { label: 'Program', to: 'programme' }, { label: 'Startovné', to: 'fees' },
      { label: 'Výsledky', to: 'results' }, { label: 'Informace', to: 'practical' }, { label: 'Kontakt', to: 'partners' },
    ],
    race: [{ label: 'Tratě', to: 'routes' }, { label: 'Startovné', to: 'fees' }, { label: 'Program', to: 'programme' }, { label: 'Propozice', to: '/propozice' }],
    years: [
      { label: 'Výsledky {prevYear}', to: 'results' }, { label: 'Fotky {prevYear}', to: 'gallery' },
      { label: 'Archiv 2013–{archiveTo}', to: '/vysledky' }, { label: 'Traťové rekordy', to: '/vysledky' },
    ],
    legal: [{ label: 'Ochrana osobních údajů', to: '/ochrana-osobnich-udaju' }],
  },
  // The sections of the home page, top to bottom (each look's design has its own order).
  home: {
    title: 'Úvod',
    order: ['opening', 'routes', 'programme', 'fees', 'results', 'gallery', 'practical', 'venue', 'news', 'faq', 'partners', 'closing'] as string[],
  },
  opening: {
    eyebrow: '14. ročník · terénní běh · Žďárské vrchy',
    lead: '6, 12 a 24 kilometrů přes Kamennou, Bučinu a Strážný. Start i cíl na hřišti v Borové Lhotě.',
    countdownLabel: 'Start za',
    secondaryLabel: 'Tratě a profily',
  },
  routes: {
    eyebrow: '01 — Tratě',
    heading: 'Čtyři tratě. Jedna časomíra.',
    text: 'Profily jsou ve stejném měřítku: co vidíte, to poběžíte. Čas měří čip ve startovním čísle, mezičasy na každém vrchu.',
    links: [
      { label: 'GPX všech tratí', url: 'https://gpx.example/tri-vrchy.zip' },
      { label: 'Mapa k tisku (PDF)', url: 'https://mapy.example/tri-vrchy-tisk.pdf' },
    ],
    items: tracksFor('casomira'),
  },
  programme: {
    eyebrow: '02 — Program · {weekdayShort}',
    heading: 'Den po minutách.',
    text: 'Číslo si vyzvedněte nejpozději půl hodiny před svým startem. Starty se nečekají: v celou zazní výstřel a časomíra běží.',
    photos: [{ caption: 'Km 3 · pod Kamennou, ročník {prevYear}' }, { caption: '' }],
    items: [
      { time: '7:30', title: 'Prezence a výdej čísel', place: 'sokolovna', text: 'Otevřeno do 9:30.', highlight: 'none' },
      { time: '9:15', title: 'Dětské běhy', place: 'hřiště a rybník', text: 'Čtyři kategorie od nejmladších, poslední startuje v 9:40.', highlight: 'none' },
      { time: '9:45', title: 'Rozprava k tratím', place: 'startovní oblouk', text: 'Pět minut o značení a o sestupu ze Strážného.', highlight: 'none' },
      { time: '10:00', title: 'Start 24 km Tři vrchy', place: '', text: '', highlight: 'start' },
      { time: '10:30', title: 'Start 12 km Dva vrchy', place: '', text: '', highlight: 'start' },
      { time: '11:00', title: 'Start 6 km Jeden vrch', place: '', text: '', highlight: 'start' },
      { time: '11:30', title: 'Guláš, koláče a pivo', place: 'stany u sokolovny', text: 'Kuchyně vaří od první doběhnuté šestky do posledního běžce v cíli.', highlight: 'none' },
      { time: '13:00', title: 'Vyhlášení 6 km a 12 km', place: 'pódium', text: 'První tři muži a ženy a vítězové věkových kategorií.', highlight: 'ceremony' },
      { time: '14:30', title: 'Vyhlášení 24 km a tombola', place: 'pódium', text: 'Losuje se ze startovních čísel všech, kdo doběhli.', highlight: 'ceremony' },
      { time: '15:00', title: 'Uzavření trati, hraje kapela Sešlost', place: 'pódium', text: 'Bigbít ze Žďáru, hraje se do šesti.', highlight: 'none' },
    ],
  },
  fees: {
    eyebrow: '03 — Startovné',
    heading: 'Cena roste se dnem platby.',
    text: 'Rozhoduje den, kdy platba přijde. Na místě se přihlásíte, jen když na trati zbude místo.',
    pricesNote: 'Ceny jsou v korunách.',
    includedTitle: 'V ceně:',
    included: ['číslo s čipem', 'občerstvení na trati, guláš a pití v cíli', 'dřevěná medaile', 'šatny, sprchy a úschovna'],
    notes: [
      'Členové SK Borová Lhota a běžci nad 70 let startují zdarma. Tričko závodu se dá přiobjednat za 290 Kč.',
      'Do {refund} vracíme polovinu startovného. Přepis na jiného běžce je do {spring} zdarma.',
    ],
    periods: [{ name: 'zimní' }, { name: 'jarní' }, { name: 'na místě' }],
  },
  results: {
    eyebrow: '04 — Výsledky {prevYear}',
    heading: 'Loňské časy k poražení.',
    text: '13. ročník, {prevDate}. Do cíle doběhlo 418 běžců a na čtyřiadvacítce padl traťový rekord.',
    links: [
      { label: 'Kompletní výsledky {prevYear}', url: '/vysledky' },
      { label: 'Archiv 2013–{archiveTo}', url: '/vysledky' },
      { label: 'Traťové rekordy', url: '/vysledky' },
    ],
    items: winners,
  },
  gallery: {
    eyebrow: '05 — Fotky {prevYear}',
    heading: 'Tak to vypadalo loni.',
    linkLabel: 'Celá galerie · 214 fotek',
    linkUrl: 'https://fotky.example/tri-vrchy',
    credit: 'Foto: Jan Bureš',
    // the photographs by their key (seed/photos.ts), with the captions Race Clock writes
    photos: [
      { photo: 'hreben', caption: 'km 14 · hřeben za Bučinou' }, { photo: 'rozhledna', caption: 'km 20 · Strážný' },
      { photo: 'les', caption: 'km 3 · pod Kamennou' }, { photo: 'sestup', caption: 'km 21 · sestup' },
      { photo: 'deti', caption: '9:15 · dětské běhy' }, { photo: 'medaile', caption: 'cíl · medaile z pily' },
      { photo: 'gulas', caption: '13:40 · guláš' },
    ],
  },
  practical: {
    eyebrow: '06 — Praktické informace',
    heading: 'Než přijedete.',
    items: [
      { icon: 'parking', title: 'P1 — Parkování', text: 'Louka u hřiště, 300 aut, 400 m od startu. Otevřeno od 7:00, parkovné 50 Kč vybírají hasiči. Náves je zavřená.' },
      { icon: 'locker', title: 'Šatny a úschovna', text: 'Sokolovna: šatny, čtyři sprchy s teplou vodou, hlídaná úschovna 7:30–15:30. Tašku označíte svým číslem.' },
      { icon: 'refreshments', title: 'Občerstvení na trati', text: 'Km 6 Kamenná, km 12 Bučina, km 20 Strážný. Voda, iontový nápoj, banány, sůl, koláče. Kelímek si vezměte vlastní.' },
      { icon: 'bus', title: 'Autobusem', text: 'Linka 840 ze Žďáru n. S. v 7:10 a 8:05, zastávka Borová Lhota, náves. Zpět v 15:40 a 17:10.' },
    ],
    rulesTitle: 'Pravidla ve zkratce',
    rules: [
      'Běžíte na vlastní odpovědnost a jen po značené trati.',
      'Na 24 km je povinný telefon, půl litru vody a kelímek.',
      'Limit je 5 hodin. Průběžná kontrola na Bučině se zavírá ve 13:00.',
      'Hole jsou povolené všude, psi na vodítku jen na 6 km.',
    ],
    rulesLabel: 'Celé propozice (PDF)',
  },
  venue: {
    eyebrow: '07 — Areál',
    heading: 'Od auta na start za tři minuty.',
    text: 'Sportovní areál SK Borová Lhota na horním konci vsi. Od parkoviště k prezenci 400 metrů, od prezence na start padesát.',
    linkLabel: 'Otevřít v mapě',
    points: [
      { name: 'Start a cíl', note: 'hřiště, oblouk u střídaček' }, { name: 'Prezence, šatny, úschovna', note: 'sokolovna' },
      { name: 'Parkoviště P1', note: 'louka, 300 aut' }, { name: 'Občerstvení a pódium', note: 'stany pod hřištěm' },
      { name: 'Zdravotník', note: 'stan u cíle' }, { name: 'Autobus', note: 'zastávka náves' },
    ].map((p, i) => ({ ...p, ...pointPositions[i]! })),
  },
  news: {
    eyebrow: '08 — Aktuality',
    heading: 'Hlášení pořadatele.',
    linkLabel: 'Všechny aktuality',
    items: [
      {
        title: 'Registrace na 14. ročník je otevřená', slug: 'registrace-je-otevrena', daysAgo: 5,
        summary: 'Zimní startovné platí do konce února. Loni se čtyřiadvacítka vyprodala v dubnu, letos má o třicet míst víc.',
        body: ['Přihlášky na 14. ročník Tří vrchů jsou otevřené. Zimní startovné platí do {early}, pak se cena zvedne na jarní a na místě bude nejdražší.', 'Loni se čtyřiadvacítka vyprodala v dubnu. Letos jsme ji rozšířili o třicet míst, ale kdo chce jistotu, ať se hlásí brzy. Přihlásit se můžete na stránce přihlášek, tam také uvidíte, kolik míst na které trati zbývá.'],
      },
      {
        title: 'Čtyřiadvacítka povede kolem rozhledny', slug: 'ctyriadvacitka-kolem-rozhledny', daysAgo: 19,
        summary: 'Lesní správa nám povolila pěšinu k nové rozhledně na Strážném. Trať je o 600 metrů delší a ubylo z ní asfaltu.',
        body: ['Lesní správa nám povolila pěšinu k nové rozhledně na Strážném. Čtyřiadvacítka se tak prodloužila o 600 metrů a hlavně z ní ubylo asfaltu.', 'Aktuální profil a soubor GPX najdete u tratí. Sestup od rozhledny je kamenitý, proto na něm bude stát pořadatel s lékárničkou.'],
      },
      {
        title: 'Hledáme čtyřicet dobrovolníků', slug: 'hledame-dobrovolniky', daysAgo: 34,
        summary: 'Na značení tratí, občerstvovačky a do cíle. Za pomoc je tričko, oběd a start zdarma v roce 2028.',
        body: ['Na značení tratí, občerstvovačky a do cíle hledáme čtyřicet dobrovolníků. Za pomoc je tričko, oběd a start zdarma v roce 2028.', 'Napište Radkovi na zavod@vrchy.example, ať víme, kolik vás přijde.'],
      },
    ],
  },
  faq: {
    eyebrow: '09 — Časté otázky',
    heading: 'Krátké odpovědi.',
    text: '',
    items: [
      { question: 'Můžu startovné přepsat na někoho jiného?', answer: 'Ano. Do {spring} zdarma přes odkaz v potvrzovacím e-mailu, později už jen u prezence za 50 Kč.' },
      { question: 'Vracíte startovné, když nemůžu přijet?', answer: 'Do {refund} vracíme polovinu. Potom ho můžete převést na jiného běžce nebo na příští ročník.' },
      { question: 'Jak je trať značená?', answer: 'Fáborky po sto metrech, šipkou na každé odbočce a cedulkou na každém kilometru. Na křížení s turistickými značkami stojí pořadatel.' },
      { question: 'Co dostanu v cíli?', answer: 'Dřevěnou medaili, guláš nebo bezmasé jídlo, pití a koláč. Tričko se dá přiobjednat v přihlášce za 290 Kč.' },
      { question: 'Dá se běžet se psem nebo s holemi?', answer: 'Hole ano, na všech tratích. Se psem na vodítku jen na 6 km a startujete z konce pole.' },
      { question: 'Kdy a kde uvidím výsledky?', answer: 'Průběžně na obrazovce v cíli a do večera tady na webu. Čas vám hned po doběhu přijde v SMS.' },
    ],
  },
  partners: {
    eyebrow: '10 — Partneři',
    heading: 'Partneři závodu',
    mainLabel: 'Hlavní partner',
    partnerLabel: 'Partneři',
    supporterLabel: 'Podporují',
    organizerLabel: 'Pořadatel',
    items: [
      { name: 'Pila Vondra', level: 'main' }, { name: 'Pivovar Strážný', level: 'partner' }, { name: 'Pekařství Sýkora', level: 'partner' },
      { name: 'Běžecké potřeby Horák', level: 'partner' }, { name: 'Lékárna U Lípy', level: 'partner' },
      { name: 'Obec Borová Lhota', level: 'supporter' }, { name: 'SDH Borová Lhota', level: 'supporter' },
      { name: 'Lesní družstvo Strážný', level: 'supporter' }, { name: 'Mikroregion Žďársko', level: 'supporter' },
    ],
  },
  closing: {
    label: 'Volná místa · všechny tratě',
    heading: 'z {total} míst\nje ještě volných.',
    text: '',
    note: 'Zimní startovné do {earlyShort}',
  },
  pages: {
    contact: {
      title: 'Kontakt', eyebrow: 'Kontakt', heading: 'Napište pořadatelům',
      text: 'Odpověď tu není? Napište nám, odpovídáme do dvou dnů. Před závodem nejrychleji zavolejte řediteli závodu.',
    },
    news: { title: 'Aktuality', eyebrow: 'Aktuality', heading: 'Hlášení pořadatele.' },
    results: { title: 'Výsledky', eyebrow: 'Výsledky {prevYear}', heading: 'Kompletní výsledky', text: 'Nejlepší tři v každé kategorii loňského ročníku.' },
    rules: {
      title: 'Propozice', heading: 'Propozice závodu',
      lead: 'Ukázkový text. Před zveřejněním sem vložte propozice vašeho závodu.',
      sections: [
        { heading: 'Pořadatel a termín', text: 'Závod pořádá SK Borová Lhota, z. s., v sobotu {eventDate}. Start první trati je v 10:00, děti běží od 9:15.' },
        { heading: 'Trati a limity', text: 'Běží se na třech tratích, 6, 12 a 24 km, a pro děti na hřišti. Časový limit je 5 hodin na 24 km a 3 hodiny na 12 km.' },
        { heading: 'Povinná výbava', items: ['telefon s nabitou baterií', 'půl litru vody', 'kelímek na občerstvovačkách'] },
        { heading: 'Odpovědnost', text: 'Každý běží na vlastní odpovědnost a jen po značené trati. Pořadatel zajišťuje zdravotníka v cíli a na kontrolním bodě na Bučině.' },
      ],
    },
    privacy: {
      title: 'Ochrana osobních údajů', heading: 'Ochrana osobních údajů',
      lead: 'Ukázkový text. Před zveřejněním popište, jak s údaji běžců a návštěvníků nakládáte vy.',
      sections: [
        { heading: 'Jaké údaje zpracováváme', text: 'Z formuláře máme vaše jméno, e-mail a zprávu. Při přihlášce na závod zpracováváme údaje, které vyplníte v přihlašovacím systému.' },
        { heading: 'Proč údaje potřebujeme', items: ['abychom vám mohli odpovědět', 'abychom změřili čas a zveřejnili výsledky', 'abychom vás mohli upozornit na změny'] },
        { heading: 'Jak dlouho je uchováváme', text: 'Zprávy z formuláře smažeme do půl roku. Výsledky závodu zůstávají v archivu.' },
      ],
    },
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    rano: 'Startovní oblouk na hřišti za svítání, osvětlený dvěma reflektory, kolem se rozcvičují běžci',
    krajina: 'Běžci na polní cestě mezi loukami, v dálce tři zalesněné vrchy',
    mlha: 'Tři běžci na lesní pěšině v ranní mlze, vyfocení zezadu',
    start: 'Běžci čekají pod červeným startovním obloukem na hřišti',
    cil: 'Běžec dobíhá do cíle pod červeným obloukem',
    hreben: 'Běžec na hřebenové pěšině mezi žulovými balvany',
    rozhledna: 'Dřevěná rozhledna na Strážném, k ní stoupá běžec',
    les: 'Tři běžci na lesní pěšině mezi smrky, vyfocení zezadu',
    sestup: 'Běžec sbíhá lesní pěšinou plnou kořenů',
    deti: 'Děti běží po hřišti při dětském závodě',
    medaile: 'Dřevěné medaile na červených stuhách',
    gulas: 'Běžci u dlouhých stolů před sokolovnou po závodě',
    obcerstveni: 'Občerstvovací stůl na lesní křižovatce: kelímky, banány a pomeranče',
    ves: 'Borová Lhota z louky nad vsí: rybník, žlutá sokolovna a hřiště',
  },
}

// What a look's design words differently from the texts above: a site made in that look gets
// these (the seed is told the look). Časomíra's wording is the shared one above; Soutisk speaks
// informally and has its own order of sections.
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  soutisk: {
    settings: { venueArea: 'u Žďáru nad Sázavou', address: 'Borová Lhota 184, 592 11 Borová Lhota' },
    menu: {
      main: [
        { label: 'Trasy', to: 'routes' }, { label: 'Startovné', to: 'fees' }, { label: 'Program', to: 'programme' },
        { label: 'Výsledky', to: 'results' }, { label: 'Informace', to: 'practical' }, { label: 'Kontakt', to: 'partners' },
      ],
      race: [{ label: 'Trasy', to: 'routes' }, { label: 'Startovné', to: 'fees' }, { label: 'Program', to: 'programme' }, { label: 'Propozice', to: '/propozice' }],
    },
    home: { order: ['opening', 'routes', 'fees', 'programme', 'gallery', 'results', 'practical', 'venue', 'news', 'partners', 'faq', 'closing'] },
    opening: { eyebrow: '14. ročník · terénní běh Žďárskými vrchy', lead: '', countdownLabel: 'Do startu zbývá', secondaryLabel: 'Vybrat trasu' },
    routes: {
      eyebrow: 'Trasy {year}',
      heading: 'Jeden kopec, dva, nebo všechny tři?',
      text: 'Každá trasa přidá jeden vrch. Startuje se pod stejným obloukem a značení je všude stejné: fáborek každých sto metrů a šipka na každé odbočce.',
      links: [{ label: 'GPX všech tras', url: 'https://gpx.example/tri-vrchy.zip' }, { label: 'Mapa k tisku (PDF)', url: 'https://mapy.example/tri-vrchy-tisk.pdf' }],
      items: tracksFor('soutisk'),
    },
    programme: {
      eyebrow: 'Program · sobota {eventDay}',
      heading: 'Jak půjde sobota',
      text: 'Ráno čísla, dopoledne kopce, odpoledne guláš a kapela. Číslo si vyzvedněte nejpozději půl hodiny před svým startem.',
    },
    fees: {
      eyebrow: 'Startovné',
      heading: 'Kolik to stojí',
      text: 'Kdo zaplatí v zimě, ušetří. Rozhoduje den, kdy platba přijde. Na místě se přihlásíte, jen když na trase zbude místo.',
      pricesNote: '',
      includedTitle: 'V ceně máte',
      included: ['číslo s čipem a měření času', 'občerstvení na trati, guláš a pití v cíli', 'dřevěnou medaili z místní pily', 'šatny, sprchy a hlídanou úschovnu'],
      notes: [
        'Členové SK Borová Lhota a běžci nad 70 let startují zdarma. Tričko závodu si přiobjednáte za 290 Kč.',
        'Do {refund} vracíme polovinu startovného. Přepis na jiného běžce je do {spring} zdarma.',
      ],
    },
    results: {
      eyebrow: 'Výsledky {prevYear}',
      heading: 'Kdo byl loni nahoře první',
      text: '13. ročník, {prevDate}. Do cíle doběhlo 418 běžců a Ondra Havlík na čtyřiadvacítce přepsal traťový rekord.',
      links: [{ label: 'Kompletní výsledky {prevYear}', url: '/vysledky' }, { label: 'Starší ročníky 2013–{archiveTo}', url: '/vysledky' }],
    },
    gallery: {
      eyebrow: 'Fotky {prevYear}',
      heading: 'Loni bylo krásně',
      linkLabel: 'Celá galerie, 214 fotek',
      photos: [
        { photo: 'hreben', caption: '' }, { photo: 'rozhledna', caption: '' }, { photo: 'sestup', caption: '' }, { photo: 'medaile', caption: '' },
        { photo: 'deti', caption: '' }, { photo: 'gulas', caption: '' }, { photo: 'cil', caption: '' },
      ],
    },
    practical: {
      eyebrow: 'Praktické informace',
      heading: 'Kde zaparkuju a kam si dám věci?',
      items: [
        { icon: 'parking', title: 'Parkování', text: 'Na louce u hřiště je místo pro 300 aut, 400 metrů od startu. Otevřeno od 7:00, padesátikorunu vyberou hasiči. Náves nechte prosím místním.' },
        { icon: 'locker', title: 'Šatny a úschovna', text: 'V sokolovně najdete šatny, čtyři sprchy s teplou vodou a hlídanou úschovnu. Funguje od 7:30 do 15:30, tašku označíte svým číslem.' },
        { icon: 'refreshments', title: 'Občerstvení na trati', text: 'Voda, iontový nápoj, banány, sůl a koláče na 6. km (Kamenná), 12. km (Bučina) a 20. km (Strážný). Kelímky nerozdáváme, vezměte si vlastní.' },
        { icon: 'bus', title: 'Autobusem', text: 'Ze Žďáru nad Sázavou jede linka 840 v 7:10 a 8:05 na zastávku Borová Lhota, náves. Zpátky v 15:40 a 17:10.' },
      ],
      rules: [
        'Běžíte na vlastní odpovědnost a jen po značené trati.',
        'Na 24 km je povinný telefon, půl litru vody a kelímek.',
        'Limit je 5 hodin, kontrola na Bučině se zavírá ve 13:00.',
        'Hole jsou povolené všude, psi na vodítku jen na 6 km.',
      ],
    },
    venue: {
      eyebrow: 'Kudy k nám',
      heading: 'Všechno je na jednom plácku',
      text: 'Areál SK Borová Lhota leží na horním konci vsi. Z parkoviště k prezenci je to 400 metrů, od prezence na start padesát.',
      points: [
        { name: 'Start a cíl', note: 'na hřišti' }, { name: 'Prezence, šatny, úschovna', note: 'v sokolovně' },
        { name: 'Parkoviště', note: 'na louce, 300 aut' }, { name: 'Guláš, pivo a pódium', note: 've stanech' },
        { name: 'Zdravotník', note: 've stanu u cíle' }, { name: 'Autobus', note: 'zastávka náves' },
      ].map((p, i) => ({ ...p, ...pointPositionsSoutisk[i]! })),
    },
    news: { eyebrow: 'Aktuality', heading: 'Co je nového' },
    faq: {
      eyebrow: 'Časté otázky',
      heading: 'Na co se ptáte',
      text: 'Odpověď tu není? Zavolejte Radkovi na *123 456 701*, bere to i večer.',
    },
    partners: { eyebrow: 'Partneři', heading: 'Díky nim se běží', mainLabel: 'Hlavní partner', partnerLabel: 'Partneři', supporterLabel: 'Podporují', organizerLabel: 'Pořadatel' },
    closing: {
      label: '',
      heading: 'Tak co, poběžíte?',
      text: 'Sobota {eventDate}, Borová Lhota. Zimní startovné od 250 Kč platí do {early}.',
      note: '',
    },
  },
}
