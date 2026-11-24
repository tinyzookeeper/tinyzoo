// Every Czech text of the Studio template, in one place: the website's own words (what is not
// content: "Rozvrh", "Obsazeno", the anchors of the sections) and the demo content the seed puts
// in (with what a look's design words differently: `demoByLook`). Another language is a file
// beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import { dateParts } from '../../kit/app/utils/format'
import type { DemoOverride } from '../../kit/seed'

type Level = 'z' | 'm' | 'p' | 'v' | 'd'
type Icon = 'walk' | 'bus' | 'car' | 'bike' | 'clock'
type Section = 'hero' | 'timetable' | 'kinds' | 'courses' | 'prices' | 'instructors' | 'space' | 'where' | 'questions' | 'signup'

export interface Words extends KitWords {
  /** The name's label for screen readers: the link to the start of the page. */
  toTop: (name: string) => string
  studioLabel: string
  hoursTitle: string
  openMenu: string
  closeMenu: string
  /** The timetable's days, Monday to Saturday. */
  days: Array<{ id: 'po' | 'ut' | 'st' | 'ct' | 'pa' | 'so'; long: string; short: string }>
  /** The days as `Date.getDay()` counts them, Sunday first: for the dates of the form. */
  weekdays: string[]
  /** The months after a day: "listopadu". */
  months: string[]
  /** Morning, afternoon, evening: the rows of Sál's matrix. */
  parts: [string, string, string]
  /** "v 18:00" */
  at: string
  all: string
  kindOfClass: string
  level: string
  allLevels: string
  levelPick: { z: string; m: string; p: string }
  levels: Record<Level, string>
  levelsDeka: Record<Level, string>
  levelColon: string
  onlyFree: string
  dayOfWeek: string
  todayDot: string
  todayTag: string
  /** "29 lekcí", "1 lekce", "žádná lekce" */
  lessonsCount: (n: number) => string
  weekly: string
  /** "Zobrazeno 3 z 29 lekcí" */
  shown: (n: number, of: number) => string
  /** "3 z 29 lekcí" */
  boardShown: (n: number, of: number) => string
  noneThatDay: string
  noneBoard: string
  noneThatDayDeka: string
  /** "Obsazeno", "2 volná", "1 volné" */
  freeShort: (n: number) => string
  /** "Poslední volné místo", "3 volná místa" */
  freeLong: (n: number) => string
  /** "3 volná" (the opening's board) */
  freeBoard: (n: number) => string
  /** "volných" (the board's rows) */
  freeWord: (n: number) => string
  freeDeka: (n: number) => string
  full: string
  fullLower: string
  fullClass: string
  /** "z 14 míst" */
  ofPlaces: (cap: number) => string
  /** "ze 14", "z 10" */
  courseOf: (cap: number) => string
  /** "Zbývají 3 místa", "Zbývá 6 míst" */
  courseLeft: (n: number) => string
  /** "Začíná v úterý" */
  startsOn: (iso: string) => string
  /** "12. 1." */
  courseDay: (iso: string) => string
  lessonsLabel: string
  priceLabel: string
  enrol: string
  free: string
  nextLesson: string
  today: string
  tomorrow: string
  tomorrowCap: string
  onMonday: string
  todaysClasses: string
  wholeTimetable: string
  week: string
  show: string
  viewDay: string
  viewWeek: string
  /** "2 sály" */
  roomsCount: (n: number) => string
  /** The small print under Tabule's day tabs. */
  miniHint: (upper: string, lower: string) => string
  /** Deka's line above the blanket (shown from a wide desktop). */
  weekHint: string
  upTo: string
  difficulty: string
  /** "11 lekcí v rozvrhu" */
  lessonsInTimetable: (n: number) => string
  forWhom: string
  length: string
  openMap: string
  routeLabel: (from: string | null, fromTime: string | null, via: string | null, viaTime: string | null) => string
  planLabel: (name: string, from: string | null, via: string | null) => string
  chooseLesson: string
  chooseLessonFirst: string
  consentNeeded: string
  /** The addresses of the sections on a page (`/#rozvrh`), by block type. */
  anchors: Record<Section, string>
}

const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)
// "ze 14", "ze 12": Czech says "ze" before the numbers that begin with a sibilant (dvou, tří, čtyř, dvanácti…).
const out = (n: number) => ([2, 3, 4, 12, 13, 14, 20, 30, 40].includes(n) ? 'ze' : 'z')
const startsOnWord = ['v neděli', 'v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu']
const weekdayIndex = (iso: string): number => {
  const d = new Date(iso)
  // (the date is stored at midnight of the site's zone: read in that zone)
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', weekday: 'short' }).format(d)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

export const words: Words = {
  ...KIT_WORDS.cs,
  toTop: (name) => `${name}, na začátek stránky`,
  studioLabel: 'Studio', hoursTitle: 'Lekce',
  openMenu: 'Otevřít menu', closeMenu: 'Zavřít menu',
  days: [
    { id: 'po', long: 'Pondělí', short: 'Po' }, { id: 'ut', long: 'Úterý', short: 'Út' }, { id: 'st', long: 'Středa', short: 'St' },
    { id: 'ct', long: 'Čtvrtek', short: 'Čt' }, { id: 'pa', long: 'Pátek', short: 'Pá' }, { id: 'so', long: 'Sobota', short: 'So' },
  ],
  weekdays: ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'],
  months: ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'],
  parts: ['Ráno', 'Odpoledne', 'Večer'],
  at: 'v',
  all: 'Vše', kindOfClass: 'Druh lekce', level: 'Úroveň', allLevels: 'Všechny úrovně',
  levelPick: { z: 'Pro začátečníky', m: 'Pro mírně pokročilé', p: 'Pro pokročilé' },
  levels: { z: 'Začátečníci', m: 'Mírně pokročilí', p: 'Pokročilí', v: 'Všechny úrovně', d: 'Podle věku' },
  levelsDeka: { z: 'Začátečníci', m: 'Mírně pokročilí', p: 'Pokročilí', v: 'Pro všechny', d: 'Podle věku' },
  levelColon: 'úroveň:',
  onlyFree: 'Jen volné', dayOfWeek: 'Den v týdnu',
  todayDot: 'dnes · ', todayTag: 'dnes',
  lessonsCount: (n) => (n === 0 ? 'žádná lekce' : n === 1 ? '1 lekce' : n < 5 ? `${n} lekce` : `${n} lekcí`),
  weekly: 'týdně',
  shown: (n, of) => `Zobrazeno ${n} z ${of} lekcí`,
  boardShown: (n, of) => `${n} z ${of} lekcí`,
  noneThatDay: 'V tento den žádná lekce filtru neodpovídá. Zkuste jiný den nebo filtr zrušte.',
  noneBoard: 'V tento den žádná lekce filtru neodpovídá. Žluté čárky nahoře ukazují, kdy se hodí jiný den.',
  noneThatDayDeka: 'Tento den žádná lekce filtru neodpovídá.',
  freeShort: (n) => (n === 0 ? 'Obsazeno' : n === 1 ? '1 volné' : n < 5 ? `${n} volná` : `${n} volných`),
  freeLong: (n) => (n === 0 ? 'Obsazeno' : n === 1 ? 'Poslední volné místo' : n < 5 ? `${n} volná místa` : `${n} volných míst`),
  freeBoard: (n) => `${n} ${plural(n, 'volné', 'volná', 'volných')}`,
  freeWord: (n) => plural(n, 'volné', 'volná', 'volných'),
  freeDeka: (n) => (n === 0 ? 'Obsazeno' : n === 1 ? 'Poslední místo' : n < 5 ? `${n} volná` : `${n} volných`),
  full: 'obsazeno', fullLower: 'obsazeno', fullClass: 'obsazená lekce',
  ofPlaces: (cap) => `z ${cap} míst`,
  courseOf: (cap) => `${out(cap)} ${cap}`,
  courseLeft: (n) => (n === 0 ? 'Obsazeno' : n === 1 ? 'Zbývá 1 místo' : n < 5 ? `Zbývají ${n} místa` : `Zbývá ${n} míst`),
  startsOn: (iso) => `Začíná ${startsOnWord[weekdayIndex(iso)] ?? ''}`.trim(),
  courseDay: (iso) => { const d = dateParts(iso); return d ? `${d.day}. ${d.monthNumber}.` : '' },
  lessonsLabel: 'Lekcí', priceLabel: 'Cena', enrol: 'Zapsat se', free: 'Zdarma',
  nextLesson: 'Nejbližší lekce', today: 'dnes', tomorrow: 'zítra', tomorrowCap: 'Zítra', onMonday: 'V pondělí',
  todaysClasses: 'Dnešní lekce', wholeTimetable: 'Celý rozvrh',
  week: 'Týden', show: 'Zobrazit', viewDay: 'Den', viewWeek: 'Celý týden',
  roomsCount: (n) => `${n} ${plural(n, 'sál', 'sály', 'sálů')}`,
  miniHint: (upper, lower) => `Čárky ukazují lekce mezi 7. a 21. hodinou: nahoře ${upper}${lower ? `, dole ${lower}` : ''}.`,
  weekHint: 'Každý řádek je jeden den, zleva od rána do večera. Čím delší lekce, tím širší pruh.',
  upTo: 'až', difficulty: 'náročnost',
  lessonsInTimetable: (n) => `${n === 0 ? 'žádná lekce' : n === 1 ? '1 lekce' : n < 5 ? `${n} lekce` : `${n} lekcí`} v rozvrhu`,
  forWhom: 'Pro koho', length: 'Délka',
  openMap: 'Otevřít v mapách',
  routeLabel: (from, fromTime, via, viaTime) => `Pěšky z místa „${from ?? ''}“ přes „${via ?? ''}“: ${fromTime ?? ''}, potom ${viaTime ?? ''}`,
  planLabel: (name, from, via) => `Plánek cesty ke studiu ${name}${from ? `: z místa „${from}“` : ''}${via ? ` přes „${via}“` : ''}, u studia zastávka autobusu a parkování`,
  chooseLesson: 'Vyberte lekci…', chooseLessonFirst: 'Nejdřív vyberte lekci',
  consentNeeded: 'Bez souhlasu vám místo rezervovat nemůžeme.',
  anchors: {
    hero: 'uvod', timetable: 'rozvrh', kinds: 'lekce', courses: 'kurzy', prices: 'cenik', instructors: 'lektori',
    space: 'kde', where: 'adresa', questions: 'otazky', signup: 'prihlaska',
  },
  defaultName: 'Studio',
}

// ── the demo content: the fictional studio Osnova in a former mill in Písek. The street, the
//    people, the phone numbers and the addresses are invented. This is Sál's wording (the first
//    look's design); what Tabule and Deka word differently is `demoByLook` below. ──
const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`

// "Tanec pro děti 5–7 let": a word joiner keeps the dash with the numbers, a hard space the unit.
const kids = (ages: string) => `Tanec pro děti ${ages.replace('–', '⁠–⁠')} let`

const kindsList = (dance: string) => [
  { name: 'Jóga', shortName: 'Jóga', summary: 'Hatha a klidná vinyasa. Dech, protažení a síla bez akrobacie; ráno na probuzení, večer na zklidnění.', audience: 'dospělí každého věku, i úplní začátečníci', levelNote: 'od začátečníků po pokročilé', duration: '60–75 minut', photo: 'yoga' as const },
  { name: 'Pilates', shortName: 'Pilates', summary: 'Pevný střed těla a záda, která nebolí. Cvičíme na podložce, s malým míčem a kruhem, v malé skupině.', audience: 'sedavá zaměstnání, běžci, ženy po porodu', levelNote: 'začátečníci a mírně pokročilí', duration: '60 minut', photo: 'pilates' as const },
  { name: 'Současný tanec', shortName: dance, summary: 'Technika, práce s podlahou a krátké choreografie. Každý měsíc nová, na hudbu, kterou vybírá Ondřej.', audience: 'dospělí a mládež od 15 let', levelNote: 'základy, mírně pokročilí, pokročilí', duration: '90 minut', photo: 'dance' as const },
  { name: 'Balet pro dospělé', shortName: 'Balet', summary: 'Tyč, držení těla a základní kroky. Bez špiček, bez trikotů a bez předchozích zkušeností.', audience: 'dospělí, kteří to chtěli zkusit odmalička', levelNote: 'začátečníci a mírně pokročilí', duration: '75 minut', photo: 'ballet' as const },
  { name: 'Tanec pro děti', shortName: 'Děti', summary: 'Rytmus, hry a první choreografie. Dvakrát do roka vystoupení pro rodiče v našem velkém sále.', audience: 'děti 5–7 let a 8–11 let', levelNote: 'bez zkušeností, skupiny podle věku', duration: '45–60 minut', photo: 'kids' as const },
]

const claims = {
  marta: 'Studio založila v roce 2017. Původně fyzioterapeutka, učí hathu a vinyasu a nikoho nenutí do provazu.',
}

// The lessons of the week: day, from, to, title, kind (index in the list above), instructor, level, room, places, places left.
type Row = [day: 'po' | 'ut' | 'st' | 'ct' | 'pa' | 'so', from: string, to: string, title: string, kind: number, who: number, level: Level, room: string, capacity: number, free: number]
const BIG = 'Velký sál'
const SMALL = 'Malý sál'
const rows: Row[] = [
  ['po', '7:00', '8:00', 'Ranní jóga', 0, 0, 'v', BIG, 14, 6],
  ['po', '9:30', '10:30', 'Pilates', 1, 1, 'z', SMALL, 10, 2],
  ['po', '16:00', '16:45', kids('5–7'), 4, 3, 'd', BIG, 12, 3],
  ['po', '17:30', '18:30', 'Pilates', 1, 1, 'm', SMALL, 10, 0],
  ['po', '18:00', '19:15', 'Jóga pro začátečníky', 0, 0, 'z', BIG, 14, 5],
  ['po', '19:30', '21:00', 'Současný tanec', 2, 2, 'm', BIG, 14, 4],
  ['ut', '9:00', '10:15', 'Jóga pro zdravá záda', 0, 0, 'v', SMALL, 10, 1],
  ['ut', '16:00', '17:00', kids('8–11'), 4, 3, 'd', BIG, 12, 4],
  ['ut', '17:30', '18:45', 'Balet pro dospělé', 3, 2, 'z', BIG, 12, 7],
  ['ut', '18:00', '19:00', 'Pilates s míčem', 1, 1, 'v', SMALL, 10, 3],
  ['ut', '19:15', '20:30', 'Vinyasa jóga', 0, 0, 'm', BIG, 14, 8],
  ['st', '7:00', '8:00', 'Ranní jóga', 0, 0, 'v', BIG, 14, 9],
  ['st', '9:30', '10:30', 'Pilates', 1, 1, 'm', SMALL, 10, 4],
  ['st', '16:00', '16:45', kids('5–7'), 4, 3, 'd', BIG, 12, 0],
  ['st', '17:30', '18:30', 'Pilates', 1, 1, 'z', SMALL, 10, 1],
  ['st', '18:00', '19:15', 'Jóga pro začátečníky', 0, 0, 'z', BIG, 14, 2],
  ['st', '19:30', '21:00', 'Současný tanec', 2, 2, 'p', BIG, 14, 6],
  ['ct', '9:00', '10:15', 'Jóga pro zdravá záda', 0, 0, 'v', SMALL, 10, 5],
  ['ct', '16:00', '17:00', kids('8–11'), 4, 3, 'd', BIG, 12, 2],
  ['ct', '17:30', '18:45', 'Balet pro dospělé', 3, 2, 'm', BIG, 12, 5],
  ['ct', '18:00', '19:00', 'Pilates', 1, 1, 'm', SMALL, 10, 0],
  ['ct', '19:15', '20:30', 'Vinyasa jóga', 0, 0, 'p', BIG, 14, 7],
  ['pa', '7:00', '8:00', 'Ranní jóga', 0, 0, 'v', BIG, 14, 10],
  ['pa', '9:30', '10:30', 'Pilates', 1, 1, 'z', SMALL, 10, 6],
  ['pa', '17:00', '18:30', 'Současný tanec: základy', 2, 2, 'z', BIG, 14, 3],
  ['pa', '18:45', '20:00', 'Jin jóga', 0, 0, 'v', BIG, 14, 4],
  ['so', '9:00', '10:15', 'Sobotní jóga', 0, 0, 'v', BIG, 14, 3],
  ['so', '10:30', '11:30', 'Pilates', 1, 1, 'v', SMALL, 10, 5],
  ['so', '10:30', '11:45', 'Balet pro dospělé', 3, 2, 'z', BIG, 12, 6],
]

const stepsA = [
  'Přijďte o deset minut dřív, ukážeme vám šatny a sál.',
  'Lektorovi řekněte, že jste tu poprvé a jestli vás něco bolí.',
  'Po lekci si dejte čaj. Jestli budete chtít chodit dál, poradíme s permanentkou.',
]
const stepsShort = [stepsA[0]!, stepsA[1]!, 'Po lekci si dejte čaj. Poradíme, jestli se vám vyplatí permanentka.']
const contact = 'ahoj@studioosnova.example'
const phone = '123 456 701'

export const demo = {
  settings: {
    siteName: 'Osnova',
    tagline: 'pohybové studio',
    phone,
    email: contact,
    instagram: 'https://instagram.example/studioosnova',
    facebook: 'https://facebook.example/studioosnova',
    street: 'Útková 7',
    zip: '397 01',
    city: 'Písek',
    addressNote: '2. patro, vchod ze dvora',
    mapUrl: 'https://mapy.example/studio-osnova',
    hours: 'Po–Pá 7:00–21:00\nSo 9:00–11:45\nNe zavřeno',
    ctaLabel: 'Zkušební lekce',
    ctaLongLabel: 'Přijít na zkušební lekci',
    about: 'Pohybové studio v bývalé tkalcovně v Písku. Jóga, pilates a tanec pro dospělé i děti od roku 2017.',
    legalName: 'Studio Osnova s.r.o.',
    companyId: '12345678',
    metaDescription: 'Pohybové studio v bývalé tkalcovně v Písku. Jóga, pilates, současný tanec, balet pro dospělé a tanec pro děti. První lekce zdarma.',
  },
  menu: [
    { label: 'Rozvrh', to: 'timetable' }, { label: 'Lekce', to: 'kinds' }, { label: 'Kurzy', to: 'courses' },
    { label: 'Ceník', to: 'prices' }, { label: 'Lektoři', to: 'instructors' }, { label: 'Kde nás najdete', to: 'space' },
  ] as Array<{ label: string; to: keyof typeof words.anchors }>,
  legal: [
    { label: 'Provozní řád', url: '/provozni-rad' },
    { label: 'Ochrana osobních údajů', url: '/ochrana-osobnich-udaju' },
  ],
  pages: {
    home: { title: 'Úvod' },
    timetable: { title: 'Rozvrh' },
    rules: {
      title: 'Provozní řád',
      lead: 'Krátce o tom, jak to u nás funguje. Řád je ukázkový: nahraďte ho vlastním.',
      sections: [
        { heading: 'Příchod a rezervace', text: 'Na lekci se chodí o deset minut dřív. Místo si držíte klepnutím na lekci v rozvrhu a rezervaci můžete zdarma zrušit do tří hodin před začátkem.' },
        { heading: 'Šatny a věci', text: 'Boty se nechávají u vchodu. Ve šatnách jsou zamykací skříňky, ručník si vezměte vlastní. Za věci mimo skříňky neručíme.' },
        { heading: 'Ohleduplnost', text: 'Telefony se na lekci ztiší a lektorovi se před začátkem řekne o úrazu nebo těhotenství.' },
      ],
    },
    privacy: {
      title: 'Ochrana osobních údajů',
      lead: 'Tato stránka je ukázková: nahraďte ji textem, který odpovídá vašemu studiu.',
      sections: [
        { heading: 'Co o vás uchováváme', text: 'Jméno a e-mail, které vyplníte v přihlášce na zkušební lekci, a lekci, kterou jste si vybrali. Nic dalšího nesbíráme.' },
        { heading: 'K čemu je potřebujeme', text: 'Potvrdit vám místo e-mailem a vědět, kdo přijde. Nezasíláme vám žádné další zprávy.' },
        { heading: 'Jak dlouho', text: 'Přihlášky mažeme do tří měsíců po lekci. Můžete nás požádat o dřívější smazání na adrese ahoj@studioosnova.example.' },
      ],
    },
  },
  kinds: kindsList('Současný tanec'),
  instructors: [
    { name: 'Marta Vlčková', label: 'Jóga · Zdravá záda', teaches: [0], bio: claims.marta, photo: 'marta' as const },
    { name: 'Klára Benešová', label: 'Pilates', teaches: [1], bio: 'Deset let tančila ve folklorním souboru, dnes učí pilates. Hlídá detaily, ale nikoho nehoní.', photo: 'klara' as const },
    { name: 'Ondřej Hruška', label: 'Současný tanec · Balet', teaches: [2, 3], bio: 'Absolvent taneční konzervatoře, osm let v divadelním angažmá. Balet učí i ty, kdo u tyče nikdy nestáli.', photo: 'ondrej' as const },
    { name: 'Tereza Malá', label: 'Tanec pro děti', teaches: [4], bio: 'Učitelka z mateřské školy a tanečnice. Děti u ní běhají a skáčou a ani nepostřehnou, že se učí rytmus.', photo: 'tereza' as const },
  ],
  rows,
  courses: [
    { title: 'Současný tanec: první kroky', kind: 2, text: 'Pro ty, kdo nikdy netančili. Úterky 18:45–20:15 s Ondřejem Hruškou.', startsOn: '2027-01-11T23:00:00Z', lessons: 10, price: 2400, capacity: 14, free: 3 },
    { title: 'Pilates po porodu', kind: 1, text: 'Střed těla a pánevní dno. Středy 10:00–11:00 s Klárou Benešovou, miminko může s vámi.', startsOn: '2027-01-12T23:00:00Z', lessons: 8, price: 1920, capacity: 10, free: 6 },
    { title: 'Jóga od začátku', kind: 0, text: 'Základní pozice, dech a jak cvičit doma. Čtvrtky 17:30–18:45 s Martou Vlčkovou.', startsOn: '2027-01-13T23:00:00Z', lessons: 8, price: 1840, capacity: 12, free: 5 },
  ],
  tariffs: [
    { name: 'První lekce', price: 0, text: 'Kterákoli otevřená lekce z rozvrhu. Bez závazku, stačí si předem držet místo.', featured: false, badge: '', linkLabel: 'Vybrat termín', linkUrl: to('signup') },
    { name: 'Jednotlivý vstup', price: 220, text: 'Když chodíte jen občas. Platí se na místě před lekcí.', featured: false, badge: '', linkLabel: 'Najít lekci', linkUrl: to('timetable') },
    { name: 'Permanentka na 10 vstupů', price: 1900, text: '190 Kč za lekci. Platí čtyři měsíce a můžete ji půjčit někomu z rodiny.', featured: true, badge: 'Nejčastější volba', linkLabel: 'Koupit na recepci', linkUrl: to('signup') },
    { name: 'Měsíční členství', price: 1490, text: 'Neomezeně na všechny otevřené lekce. Bez smlouvy, zrušíte ho kdykoli ke konci měsíce.', featured: false, badge: '', linkLabel: 'Stát se členem', linkUrl: to('signup') },
  ],
  questions: [
    { question: 'Co si mám vzít s sebou?', answer: 'Pohodlné oblečení a láhev s vodou. Podložky, bloky, deky i míče máme. Cvičí se naboso nebo v ponožkách, na balet stačí ponožky nebo měkké piškoty.' },
    { question: 'Potřebuju partnera?', answer: 'Ne. Žádná z našich lekcí není párová, i na tanec chodí každý sám za sebe.' },
    { question: 'Můžu se přidat v pololetí?', answer: 'Na otevřené lekce z rozvrhu kdykoli. Do kurzu se dá přistoupit do třetí lekce a cenu poměrně snížíme; později už jen po domluvě s lektorem.' },
    { question: 'Nikdy jsem necvičil. Zvládnu to?', answer: 'Lekce označené „začátečníci“ a „všechny úrovně“ jsou stavěné tak, aby je zvládl každý. Lektorovi před začátkem řekněte, že jste tu poprvé, a ukáže vám lehčí varianty.' },
    { question: 'Jak se ruší rezervace?', answer: 'Odkazem z potvrzovacího e-mailu nebo telefonem, zdarma do tří hodin před začátkem. Ranní lekce prosíme rušit do osmé večer předchozího dne.' },
    { question: 'Je kde se převléknout a osprchovat?', answer: 'Ano, máme dvě šatny se zamykacími skříňkami a sprchou. Ručník si vezměte vlastní.' },
  ],
  hero: {
    eyebrow: 'Písek · bývalá tkalcovna u řeky',
    heading: 'Jóga, pilates a tanec *ve světle staré tkalcovny*',
    text: 'Dva sály, čtyři lektoři a 29 lekcí týdně pro začátečníky i pokročilé. První lekci máte zdarma: vyberte si ji v rozvrhu a přijďte.',
    primaryLabel: 'Přijít na zkušební lekci', primaryUrl: to('signup'),
    secondaryLabel: 'Prohlédnout rozvrh', secondaryUrl: to('timetable'),
    facts: [
      { label: 'První lekce', value: 'zdarma' },
      { label: 'Na lekci', value: 'nejvýš 14 lidí' },
      { label: 'Otevřeno', value: 'pondělí až sobota' },
    ],
    badgeTop: '', badgeBottom: '',
  },
  timetable: {
    eyebrow: 'Rozvrh',
    heading: 'Rozvrh na tento týden',
    text: 'Klepnutím na lekci si v ní držíte místo. Rezervace se otevírá 14 dní předem, zrušit ji můžete zdarma do tří hodin před začátkem.',
    printLabel: 'Rozvrh k vytištění (PDF)', printUrl: '/rozvrh',
  },
  kindsBlock: {
    eyebrow: 'Lekce',
    heading: 'Co u nás můžete cvičit',
    text: 'Na otevřené lekce z rozvrhu se nemusíte zapisovat na celé pololetí. Přijdete, kdy se vám to hodí, a platíte vstupem, permanentkou nebo členstvím.',
    helpTitle: '', helpText: '', helpLabel: '', helpUrl: '',
  },
  coursesBlock: {
    eyebrow: 'Zápis · leden 2027',
    heading: 'Kurzy, do kterých se právě zapisuje',
    text: 'Uzavřená skupina, která začíná od první lekce a jde krok za krokem. Místo máte jisté na celý kurz.',
  },
  pricesBlock: {
    eyebrow: 'Ceník',
    heading: 'Kolik lekce stojí',
    text: 'Ceny platí pro všechny otevřené lekce v rozvrhu bez ohledu na délku. Platit můžete kartou na recepci nebo převodem.',
    footnote: 'Dětské lekce se platí pololetně: 2 600 Kč za 17 lekcí. Studenti a senioři nad 65 let mají na vstupy a permanentky slevu 20 %. Kurzy mají vlastní cenu uvedenou u zápisu.',
  },
  instructorsBlock: {
    eyebrow: 'Lektoři',
    heading: 'Čtyři lidé, kteří vás povedou',
    text: '',
  },
  space: {
    eyebrow: 'Prostor',
    heading: 'Dva sály ve druhém patře tkalcovny',
    text: 'Velký sál má 140 m², dubovou podlahu a okna na dvě strany. Malý sál s 60 m² je pro pilates a skupiny do deseti lidí. Podložky, bloky, deky i míče jsou na místě.',
    // (the order of the photographs is the look's: see seed/index.ts)
    captions: { lobby: 'Vstup s čajovým koutem', detail: 'Pomůcky máme pro každého' } as Record<string, string>,
    facts: [
      { label: 'Velký sál', value: '140 m²' },
      { label: 'Malý sál', value: '60 m²' },
      { label: 'Šatny se sprchou', value: '2' },
    ],
  },
  where: {
    eyebrow: 'Kde nás najdete',
    heading: 'Útková 7, Písek',
    text: 'Cihlová budova bývalé tkalcovny, vchod ze dvora, 2. patro (výtah je vlevo od schodiště).',
    ways: [
      { icon: 'bus' as Icon, label: 'Autobusem', figure: '', text: 'Linka 2, zastávka U Tkalcovny. Od zastávky dvě minuty.' },
      { icon: 'car' as Icon, label: 'Autem', figure: '', text: 'Ve dvoře je osm míst zdarma. Večer bývá plno, další místa jsou na nábřeží.' },
      { icon: 'bike' as Icon, label: 'Na kole', figure: '', text: 'Krytý stojan je hned u vchodu, cyklostezka vede kolem řeky.' },
      { icon: 'clock' as Icon, label: 'Recepce', figure: '', text: 'Otevíráme půl hodiny před první lekcí dne. V neděli je zavřeno.' },
    ],
    routeFrom: 'Velké náměstí', routeFromTime: '3 min', routeVia: 'Kamenný most', routeViaTime: '6 min po nábřeží',
    river: 'Otava', parking: '8 míst ve dvoře', stop: 'zastávka U Tkalcovny', stopNote: 'linka 2 · 2 min',
  },
  questionsBlock: {
    eyebrow: 'Před první lekcí',
    heading: 'Na co se lidé ptají',
    text: `Nenašli jste odpověď? Napište na ${contact} nebo zavolejte Martě na ${phone}.`,
  },
  signup: {
    eyebrow: 'Zkušební lekce',
    heading: 'Přijďte si první lekci vyzkoušet zdarma',
    text: 'Vyberte lekci a den. Místo vám potvrdíme e-mailem nejpozději do večera.',
    steps: stepsA,
    consent: 'Souhlasím se zpracováním údajů pro potvrzení rezervace. Nic dalšího vám posílat nebudeme.',
    phoneNote: 'Raději telefonem?',
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    room: 'Prázdný velký sál studia v ranním světle: dubová podlaha, bílé cihlové zdi a vysoká tovární okna',
    hero: 'Tanečnice v pohybu uprostřed velkého sálu bývalé tkalcovny',
    yoga: 'Lekce jógy: čtyři lidé na podložkách v pozici bojovníka, pohled zezadu',
    pilates: 'Žena na podložce cvičí pilates s malým míčem',
    dance: 'Lekce současného tance: tři tanečníci v pohybu nízko u podlahy',
    ballet: 'Dvě ženy u baletní tyče před vysokým oknem',
    kids: 'Děti sedí v kruhu na podlaze sálu s barevnými šátky',
    marta: 'Marta Vlčková, lektorka jógy',
    klara: 'Klára Benešová, lektorka pilates',
    ondrej: 'Ondřej Hruška, lektor současného tance a baletu',
    tereza: 'Tereza Malá, lektorka tance pro děti',
    lobby: 'Vstup do studia: dřevěná lavice, věšáky a stolek s čajem',
    detail: 'Police se srolovanými podložkami, korkovými bloky a složenými dekami',
    exterior: 'Cihlová budova bývalé tkalcovny ze dvora, u vchodu stojan s koly',
  },
}

// What a look's design words differently from the texts above: a site made in that look gets
// these (the seed is told the look). Sál is the shared wording. A list is replaced whole.
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  tabule: {
    settings: { ctaLongLabel: 'Zkušební lekce zdarma' },
    menu: [
      { label: 'Rozvrh', to: 'timetable' }, { label: 'Lekce', to: 'kinds' }, { label: 'Zápis', to: 'courses' },
      { label: 'Ceník', to: 'prices' }, { label: 'Lektoři', to: 'instructors' }, { label: 'Kde to je', to: 'space' },
    ],
    kinds: kindsList('Tanec'),
    hero: {
      eyebrow: 'Pohybové studio · Písek · od roku 2017',
      heading: 'Hýbeme\nPískem.',
      text: 'Jóga, pilates, současný tanec, balet a tanec pro děti ve dvou sálech bývalé tkalcovny. 29 lekcí týdně, první máte zdarma.',
      primaryLabel: 'Zkušební lekce zdarma',
      secondaryLabel: 'Ceník', secondaryUrl: to('prices'),
      facts: [],
    },
    timetable: { eyebrow: '', heading: 'Rozvrh' },
    kindsBlock: {
      eyebrow: '',
      heading: 'Co se tu cvičí',
      text: 'Na otevřené lekce se nemusíte zapisovat na pololetí. Přijdete, kdy se vám to hodí, a platíte vstupem, permanentkou nebo členstvím.',
    },
    coursesBlock: { eyebrow: 'Kurzy od ledna 2027', heading: 'Zápis' },
    pricesBlock: {
      eyebrow: '',
      heading: 'Ceník',
      text: 'Ceny platí pro všechny otevřené lekce v rozvrhu bez ohledu na délku. Platí se kartou na recepci nebo převodem.',
    },
    instructorsBlock: { eyebrow: '', heading: 'Kdo učí', text: '4 lektoři · 5 druhů lekcí' },
    space: {
      eyebrow: '',
      captions: {},
      facts: [
        { label: 'Velký sál', value: '140 m²' },
        { label: 'Malý sál', value: '60 m²' },
        { label: '2 šatny se sprchou', value: '' },
        { label: 'Podložky, bloky, deky a míče na místě', value: '' },
      ],
    },
    where: {
      eyebrow: '',
      heading: 'Kde to je',
      text: 'Cihlová budova bývalé tkalcovny na nábřeží. Vchod je ze dvora, studio ve 2. patře, výtah vlevo od schodiště.',
      ways: [
        { icon: 'walk', label: 'Pěšky', figure: '6 min', text: 'od Kamenného mostu po nábřeží, z Velkého náměstí devět' },
        { icon: 'bus', label: 'Autobusem', figure: '2 min', text: 'od zastávky U Tkalcovny, jezdí sem linka 2' },
        { icon: 'car', label: 'Autem', figure: '8 míst', text: 've dvoře zdarma; večer bývá plno, další jsou na nábřeží' },
        { icon: 'bike', label: 'Na kole', figure: '12 kol', text: 'se vejde do krytého stojanu u vchodu, cyklostezka vede kolem řeky' },
      ],
    },
    questionsBlock: {
      eyebrow: '',
      heading: 'Otázky',
      text: `Chybí tu vaše otázka? Napište na ${contact} nebo zavolejte Martě na ${phone}.`,
    },
    signup: {
      heading: 'První lekce zdarma.',
      steps: stepsShort,
    },
  },
  deka: {
    menu: [
      { label: 'Lekce', to: 'kinds' }, { label: 'Rozvrh', to: 'timetable' }, { label: 'Kurzy', to: 'courses' },
      { label: 'Lektoři', to: 'instructors' }, { label: 'Ceník', to: 'prices' }, { label: 'Kudy k nám', to: 'space' },
    ],
    hero: {
      eyebrow: 'Pohybové studio v bývalé písecké tkalcovně',
      heading: 'Přijďte v teplákách. *O zbytek se postaráme.*',
      text: 'Jóga, pilates, současný tanec, balet pro dospělé a tanec pro děti. Učíme v malých skupinách, podložku vám půjčíme a první lekci máte zdarma.',
      secondaryLabel: 'Co se kdy cvičí',
      facts: [],
      badgeTop: '1. lekce', badgeBottom: 'zdarma',
    },
    timetable: {
      eyebrow: 'Týden',
      heading: 'Co se kdy cvičí',
      text: 'Klepnutím na lekci si v ní držíte místo; zrušit ho jde zdarma do tří hodin před začátkem.',
    },
    kindsBlock: {
      eyebrow: '',
      heading: 'Pět způsobů, jak se u nás hýbat',
      text: 'Každý druh lekce má svou barvu, podle které ho poznáte i v rozvrhu. Na otevřené lekce chodíte, kdy se vám to hodí.',
      helpTitle: 'Nevíte, co si vybrat?',
      helpText: 'Napište nám, co vás bolí nebo co vás baví. Marta vám poradí, kterou lekcí začít, a rovnou vám v ní podrží místo.',
      helpLabel: 'Napsat Martě', helpUrl: `mailto:${contact}`,
    },
    coursesBlock: {
      eyebrow: 'Zápis na leden 2027',
      heading: 'Chcete začít úplně od začátku? Tři kurzy otevíráme v lednu',
    },
    pricesBlock: {
      eyebrow: '',
      heading: 'Kolik to stojí',
      text: 'Ceny platí pro všechny otevřené lekce bez ohledu na délku. Platit můžete kartou na recepci nebo převodem.',
    },
    instructorsBlock: {
      eyebrow: '',
      heading: 'Kdo vás povede',
      text: 'Čtyři lektoři, kteří si pamatují jména a všimnou si, když vás po týdnu u počítače bolí záda.',
    },
    space: {
      eyebrow: '',
      heading: 'Druhé patro, okna na řeku',
      text: 'Velký sál má 140 m², dubovou podlahu a okna na dvě strany. Malý sál s 60 m² je pro pilates a skupiny do deseti lidí. K tomu dvě šatny se sprchou a čajový kout, kde se po lekci dá chvíli zůstat.\n\nPodložky, bloky, deky i míče jsou na místě. Deky jsou vlněné, pruhované a po relaxaci je nikdo nechce vracet.',
      captions: {},
      facts: [
        { label: 'Velký sál', value: '140 m², až 14 lidí' },
        { label: 'Malý sál', value: '60 m², až 10 lidí' },
        { label: 'Šatny', value: 'dvě, se sprchou a skříňkami' },
        { label: 'Čajový kout', value: 'čaj a voda zdarma' },
      ],
    },
    where: {
      eyebrow: 'Kudy k nám',
      text: 'Cihlová budova bývalé tkalcovny na nábřeží. Vchod je ze dvora, studio ve 2. patře, výtah vlevo od schodiště.',
      ways: [
        { icon: 'walk', label: 'Pěšky', figure: '', text: 'Z Velkého náměstí devět minut: přes Kamenný most a doprava po nábřeží.' },
        { icon: 'bus', label: 'Autobusem', figure: '', text: 'Linka 2, zastávka U Tkalcovny. Od zastávky dvě minuty.' },
        { icon: 'car', label: 'Autem', figure: '', text: 'Ve dvoře je osm míst zdarma. Večer bývá plno, další místa jsou na nábřeží.' },
        { icon: 'bike', label: 'Na kole', figure: '', text: 'Krytý stojan je hned u vchodu, cyklostezka vede kolem řeky.' },
      ],
    },
    questionsBlock: {
      eyebrow: '',
      heading: 'Než přijdete poprvé',
      text: `Na tohle se nás ptáte nejčastěji. Cokoli dalšího napište na ${contact}.`,
    },
    signup: {
      eyebrow: '',
      heading: 'První lekci máte zdarma. *Kdy přijdete?*',
      steps: stepsShort,
    },
  },
}
