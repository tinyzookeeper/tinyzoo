// Every Czech text of the Garage template, in one place: the website's own words (what is not
// content: "Dnes otevřeno", "od", the anchors of the sections) and the demo content the seed puts
// in (with what a look's design words differently: `demoByLook`). Another language is a file
// beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

type Look = 'cesta' | 'kontrolky' | 'supliky'

export interface Words extends KitWords {
  /** The monogram's label for screen readers: "U Vlečky, úvod". */
  toTop: (name: string) => string
  /** The line of the opening: "Dnes otevřeno do 17.00". */
  openUntil: (time: string) => string
  openToday: string
  closedToday: string
  closedAlready: string
  closed: string
  /** The badge beside today in the table of hours. */
  todayBadge: string
  nextFree: string
  forService: string
  forTyres: string
  /** "zítra", "dnes": a day that is near, in a sentence. */
  tomorrow: string
  today: string
  /** The weekdays from Monday: "pondělí". */
  weekdays: string[]
  /** "v pondělí", "ve čtvrtek": the day after "on". */
  onWeekdays: string[]
  /** "Nejbližší volný termín na servis je ve čtvrtek 26. 11., na přezutí zítra." */
  freeSentence: (service: string | null, tyres: string | null) => string
  /** "Na přezutí máme volno už zítra." */
  freeTyresSentence: (tyres: string | null) => string
  /** "Na přezutí už zítra.": the short line on the drawer front. */
  tyresNote: (tyres: string | null) => string
  asap: string
  otherDay: string
  hourlyRate: string
  diagnostics: string
  warranty: string
  phone: string
  /** "od": before a price that depends on the car. */
  from: string
  /** The short unit after a price (Cesta) and the longer one under it (Kontrolky, Šuplíky). */
  unitShort: { hour: string; season: string }
  unitLong: { hour: string; season: string }
  /** "trvá 45 min", on a phone. */
  lasts: (duration: string) => string
  /** "11 položek" */
  itemsCount: (n: number) => string
  /** "Sezóna do 11. 12.", and the same in the middle of a line: "sezóna do 11. 12." */
  seasonUntil: (date: string) => string
  seasonUntilAside: (date: string) => string
  /** "1. krok" */
  stepNumber: (n: number) => string
  /** "29 let v oboru" */
  yearsInTrade: (n: number) => string
  groupsNav: string
  /** The two clock figures of the gauge: the weekdays on its dial, and what it shows. */
  gaugeDays: string[]
  gaugeCaption: string
  gaugeLabel: (day: string) => string
  /** Headings inside the "where" section, by look. */
  arrivalHeading: string
  addressHeading: string
  hoursHeading: Record<Look, string>
  hoursAside: string
  contact: string
  onThePage: string
  workshopLabel: string
  /** Labels of the drawn plan of the yard (Šuplíky). */
  plan: { lift1: string; lift2: string; reception: string; workshop: string }
  planLabel: (street: string) => string
  approachLabel: (comingFrom: string, towards: string, turnAt: string, distance: string) => string
  sentToAdmin: string
  /** The addresses of the sections on a page (`/#cenik`), by block type. */
  anchors: Record<'lamps' | 'season' | 'prices' | 'steps' | 'makes' | 'team' | 'booking' | 'where', string>
  /** "zelená brána" etc. are the owner's; these are the sign's own. */
  signSiding: string
  menuOpen: string
  menuClose: string
}

// A sentence's full stop, unless a date at its end has written one ("24. 11.")
const stop = (text: string): string => (text.endsWith('.') ? text : `${text}.`)
const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

export const words: Words = {
  ...KIT_WORDS.cs,
  defaultName: 'Autoservis',
  toTop: (name) => `${name}, úvod`,
  openUntil: (time) => `Dnes otevřeno do ${time}`,
  openToday: 'Dnes otevřeno',
  closedToday: 'Dnes zavřeno',
  closedAlready: 'Dnes už zavřeno',
  closed: 'zavřeno',
  todayBadge: 'dnes',
  nextFree: 'Nejbližší volný termín',
  forService: 'servis a opravy',
  forTyres: 'přezutí',
  tomorrow: 'zítra',
  today: 'dnes',
  weekdays: ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'],
  onWeekdays: ['v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu', 'v neděli'],
  freeSentence: (service, tyres) => {
    const parts = [service ? `Nejbližší volný termín na servis je ${service}` : '', tyres ? `na přezutí ${tyres}` : ''].filter(Boolean)
    return parts.length ? stop(parts.join(', ')) : ''
  },
  freeTyresSentence: (tyres) => (tyres ? stop(`Na přezutí máme volno ${tyres.startsWith('zítra') || tyres === 'dnes' ? 'už ' : ''}${tyres}`) : ''),
  tyresNote: (tyres) => (tyres ? stop(`Na přezutí ${tyres.startsWith('zítra') || tyres === 'dnes' ? 'už ' : ''}${tyres}`) : ''),
  asap: 'Co nejdřív',
  otherDay: 'Jiný den, domluvíme se',
  hourlyRate: 'Hodina práce',
  diagnostics: 'diagnostika a elektrika',
  warranty: 'Záruka',
  phone: 'Telefon',
  from: 'od',
  unitShort: { hour: '/ h', season: '/ sezóna' },
  unitLong: { hour: 'za hodinu', season: 'za sezónu' },
  lasts: (duration) => `trvá ${duration}`,
  itemsCount: (n) => `${n} ${plural(n, 'položka', 'položky', 'položek')}`,
  seasonUntil: (date) => `Sezóna do ${date}`,
  seasonUntilAside: (date) => `sezóna do ${date}`,
  stepNumber: (n) => `${n}. krok`,
  yearsInTrade: (n) => `${n} ${plural(n, 'rok', 'roky', 'let')} v oboru`,
  groupsNav: 'Skupiny ceníku',
  gaugeDays: ['PO', 'ÚT', 'ST', 'ČT', 'PÁ', 'SO'],
  gaugeCaption: 'nejbližší volný termín na servis',
  gaugeLabel: (day) => `Nejbližší volný termín na servis: ${day}`,
  arrivalHeading: 'Příjezd a parkování',
  addressHeading: 'Adresa',
  hoursHeading: { cesta: 'Otevírací doba', kontrolky: 'Otevírací doba', supliky: 'Kdy tu jsme' },
  hoursAside: 'jen v sezóně',
  contact: 'Kontakt',
  onThePage: 'Na stránce',
  workshopLabel: 'dílna',
  plan: { lift1: 'zvedák 1', lift2: 'zvedák 2', reception: 'příjem', workshop: 'Dílna' },
  planLabel: (street) => `Plánek dvora: z ulice ${street} za vlečkou vjedete zelenou bránou na dvůr, vpravo je parkování, naproti dílna se dvěma vraty a příjem.`,
  approachLabel: (comingFrom, towards, turnAt, distance) => `Schéma příjezdu: ${comingFrom}, ${turnAt} odbočit, ${distance}: první zelená brána vpravo; hlavní silnice vede směr ${towards}.`,
  sentToAdmin: 'Poptávka je v administraci.',
  anchors: { lamps: 'svetla', season: 'sezona', prices: 'cenik', steps: 'postup', makes: 'znacky', team: 'lide', booking: 'objednat', where: 'kde' },
  signSiding: 'vlečka',
  menuOpen: 'Otevřít menu',
  menuClose: 'Zavřít menu',
}

// A non-breaking space where a design keeps two words together: "a~pneuservis" ("~" becomes it).
const nb = (text: string): string => text.replace(/~/g, ' ')

// ── the demo content: the fictional Autoservis U Vlečky in Jičín, a garage behind the railway
//    siding with three mechanics and two lifts. The street, the people, the phone numbers and the
//    addresses are invented; the photographs are of an invented workshop. The shared texts are the
//    first look's design (Cesta); `demoByLook` below says what the others word differently. ──

const REVIEW_TEXTS = [
  'Na STK jsem měla jít za týden, nesvítilo mi brzdové světlo a vepředu něco klepalo. Vzali mě ve čtvrtek, v pátek jsem měla auto zpátky i s novou známkou. Cenu mi řekli předem a seděla na korunu.',
  'Jinde mi chtěli měnit turbo za čtyřicet tisíc. Pan Vondra našel prasklou podtlakovou hadičku. Platil jsem 1 400 korun a jezdím dál, už druhý rok.',
  'Přezouvám tu třetí zimu a pneumatiky mám uskladněné u nich. Objednám se telefonem, za dvacet minut je hotovo. Kola dotahují momentovým klíčem, ne od oka.',
  'Když dodávka stojí, nevydělává. V deset volali, že je to spojka, druhý den ve tři jsem ji měl zpátky. Staré díly mi ukázali, i když jsem o to nestál.',
]
const reviews = (cars: string[]) => [
  { name: 'Jana Kubištová', car: cars[0]!, year: 2014, text: REVIEW_TEXTS[0]! },
  { name: 'Milan Řehák', car: cars[1]!, year: 2011, text: REVIEW_TEXTS[1]! },
  { name: 'Lucie Dostálová', car: cars[2]!, year: 2017, text: REVIEW_TEXTS[2]! },
  { name: 'Pavel Novotný, truhlář', car: cars[3]!, year: 2016, text: REVIEW_TEXTS[3]! },
]
const team = (roles: string[], texts: string[]) => [
  { name: 'Petr Vondra', role: roles[0]!, years: 29, photo: 'petr', text: texts[0]! },
  { name: 'Tomáš Hejna', role: roles[1]!, years: 11, photo: 'tomas', text: texts[1]! },
  { name: 'Marek Šolc', role: roles[2]!, years: 7, photo: 'marek', text: texts[2]! },
]
const extras = (items: Array<{ name: string; price: string; unit: string; text: string; photo: string }>) => items
const NOT_DOING = [
  { text: 'Lakování a opravy po větších nehodách.', note: 'Zařídíme u lakýrníka v Jičíně.' },
  { text: 'Generálky automatických převodovek.', note: 'Výměnu oleje v automatu ano.' },
  { text: 'Vysokonapěťové části elektromobilů.', note: 'Brzdy, podvozek a pneu ano.' },
  { text: 'Nákladní auta nad 3,5 t a motocykly.', note: '' },
  { text: 'Chiptuning a vypínání filtrů částic.', note: '' },
]
const OTHER_MAKES = 'Hyundai, Kia, Ford, Renault, Dacia, Peugeot, Citroën, Opel'
const GROUP_MAKES = 'Škoda, Volkswagen, Seat, Audi'
const CALL_NOTE = 'Po–Čt 7.00–17.00, Pá 7.00–15.30. Mimo provozní dobu na mobil {phone}, stačí SMS.'

export const demo = {
  home: { title: 'Autoservis U Vlečky, Jičín: servis, pneuservis, příprava na STK' },
  // The blocks of the home page, in the order of the look's design.
  sections: ['hero', 'facts', 'season', 'prices', 'steps', 'workshop', 'makes', 'extras', 'team', 'reviews', 'booking', 'where'] as string[],
  settings: {
    siteName: 'Autoservis U Vlečky',
    tagline: 'autoservis, Jičín',
    phone: '123 456 701',
    phone2: '123 456 702',
    email: 'servis@uvlecky.example',
    street: 'Vlečkovská 412',
    zip: '506 01',
    city: 'Jičín',
    // (the days from Monday; a day without hours is closed)
    hours: [
      { day: 'mon' as const, from: '7.00', to: '17.00', note: '' },
      { day: 'tue' as const, from: '7.00', to: '17.00', note: '' },
      { day: 'wed' as const, from: '7.00', to: '17.00', note: '' },
      { day: 'thu' as const, from: '7.00', to: '17.00', note: '' },
      { day: 'fri' as const, from: '7.00', to: '15.30', note: '' },
      { day: 'sat' as const, from: '8.00', to: '12.00', note: 'jen pneu, v sezóně' },
      { day: 'sun' as const, from: '', to: '', note: '' },
    ],
    hourlyRate: 790,
    diagnosticsRate: 890,
    warranty: '24 měsíců',
    ctaLabel: 'Objednat termín',
    about: 'Nezávislý autoservis a pneuservis v Jičíně. Servis, opravy, klimatizace, diagnostika a příprava na STK.',
    legalName: 'Autoservis U Vlečky s.r.o.',
    companyId: '12345678',
    vatId: 'CZ12345678',
    registry: 'Krajský soud v Hradci Králové, oddíl C, vložka 12345',
    metaDescription: 'Nezávislý autoservis a pneuservis v Jičíně. Škoda, Volkswagen, Seat, Audi a dalších osm značek. Ceník, objednání termínu, náhradní vůz.',
  },
  menu: {
    main: [['Ceník', 'prices'], ['Jak oprava probíhá', 'steps'], ['Značky', 'makes'], ['Lidé', 'team'], ['Kde nás najdete', 'where']] as Array<[string, keyof Words['anchors']]>,
    footer: [['Ceník', 'prices'], ['Jak oprava probíhá', 'steps'], ['Značky', 'makes'], ['Lidé', 'team'], ['Objednat termín', 'booking'], ['Kde nás najdete', 'where']] as Array<[string, keyof Words['anchors']]>,
  },
  groups: [
    { name: 'Servis a opravy', summary: 'Pravidelný servis, brzdy, podvozek, rozvody, spojky, výfuky.', icon: 'wrench' as const, lamp: 'brake' as const, lampColor: 'red' as const, lampPosition: 2 },
    { name: 'Pneuservis', summary: 'Přezutí, vyvážení, opravy defektů. Nové pneumatiky objednáme do druhého dne.', icon: 'circle-dot' as const, lamp: 'tyre' as const, lampColor: 'amber' as const, lampPosition: 3 },
    { name: 'Klimatizace', summary: 'Plníme obě chladiva, hledáme úniky, čistíme.', icon: 'snowflake' as const, lamp: 'snow' as const, lampColor: 'blue' as const, lampPosition: 4 },
    { name: 'Příprava na STK', summary: 'Projdeme to, co projde technik, a na stanici zajedeme za vás.', icon: 'clipboard-check' as const, lamp: 'wrench' as const, lampColor: 'green' as const, lampPosition: 5 },
    { name: 'Diagnostika', summary: 'Kontrolky, elektrika, řídicí jednotky, prohlídky ojetin.', icon: 'activity' as const, lamp: 'engine' as const, lampColor: 'amber' as const, lampPosition: 1 },
    { name: 'Karoserie', summary: 'Menší klempířina, skla a ochrana proti korozi.', icon: 'car' as const, lamp: 'door' as const, lampColor: 'red' as const, lampPosition: 6 },
  ],
  // The price list: [group, name, text, price, "from", unit, duration]
  services: [
    ['Servis a opravy', 'Výměna oleje a filtru', 'olej 5W-30 do 4,5 l a olejový filtr v ceně', 1690, true, 'none', '45 min'],
    ['Servis a opravy', 'Servisní prohlídka podle výrobce', 'olej, filtry, kontrola 32 bodů, zápis do servisní knížky', 3400, true, 'none', '2 h'],
    ['Servis a opravy', 'Přední brzdové destičky', 'sada destiček, vyčištění a namazání třmenů', 1490, true, 'none', '1 h'],
    ['Servis a opravy', 'Přední kotouče a destičky', 'díly v kvalitě prvovýroby', 3900, true, 'none', '1,5 h'],
    ['Servis a opravy', 'Výměna brzdové kapaliny', 'přístrojem, včetně odvzdušnění', 890, false, 'none', '45 min'],
    ['Servis a opravy', 'Rozvody s vodní pumpou', 'kompletní sada, u většiny motorů 1.2 až 2.0', 9800, true, 'none', '1 den'],
    ['Servis a opravy', 'Spojková sada', 'lamela, přítlačný talíř, ložisko; setrvačník zvlášť', 11500, true, 'none', '1 den'],
    ['Servis a opravy', 'Přední tlumiče, pár', 'včetně horních uložení a geometrie', 5600, true, 'none', 'půl dne'],
    ['Servis a opravy', 'Čepy, ramena, stabilizátory', 'cena za jeden díl s montáží', 1200, true, 'none', '1–2 h'],
    ['Servis a opravy', 'Geometrie kol', '3D měření, protokol před a po', 1190, false, 'none', '1 h'],
    ['Servis a opravy', 'Výfuk: výměna dílu, svařování', 'podle rozsahu, cenu řekneme pod autem', 900, true, 'none', '1 h'],
    ['Pneuservis', 'Výměna kol na discích', '4 kola, dotažení momentovým klíčem, kontrola tlaku', 480, false, 'none', '20 min'],
    ['Pneuservis', 'Přezutí pneu 13–15"', 'demontáž, montáž a vyvážení, 4 kola', 1090, false, 'none', '40 min'],
    ['Pneuservis', 'Přezutí pneu 16–17"', 'demontáž, montáž a vyvážení, 4 kola', 1290, false, 'none', '45 min'],
    ['Pneuservis', 'Přezutí pneu 18" a větší, SUV, dodávky', 'včetně run-flat a nízkých profilů', 1590, false, 'none', '1 h'],
    ['Pneuservis', 'Oprava defektu', 'knot nebo záplata zevnitř, vyvážení', 290, true, 'none', '30 min'],
    ['Pneuservis', 'Čidla tlaku v pneu', 'výměna ventilku a naučení čidla, cena za kus', 450, true, 'none', '20 min'],
    ['Pneuservis', 'Uskladnění sady pneumatik', 's disky i bez, včetně měření vzorku', 790, false, 'season', ''],
    ['Klimatizace', 'Plnění klimatizace R134a', 'odsátí, vakuování, zkouška těsnosti, olej, náplň do 600 g', 1290, false, 'none', '1 h'],
    ['Klimatizace', 'Plnění klimatizace R1234yf', 'vozy zhruba od roku 2017, náplň podle váhy', 2490, true, 'none', '1 h'],
    ['Klimatizace', 'Hledání úniku', 'dusíkem a UV lampou', 690, true, 'none', '1 h'],
    ['Klimatizace', 'Dezinfekce ozonem', 'proti zápachu a plísním ve výparníku', 390, false, 'none', '30 min'],
    ['Klimatizace', 'Kabinový filtr', 'filtr s aktivním uhlím včetně výměny', 390, true, 'none', '15 min'],
    ['Příprava na STK', 'Prohlídka před STK', 'brzdy, světla, vůle v podvozku, výfuk, emise nanečisto', 590, false, 'none', '45 min'],
    ['Příprava na STK', 'Odvoz na STK a emise', 'poplatky stanice (asi 1 900 Kč) platíte zvlášť', 600, false, 'none', 'půl dne'],
    ['Příprava na STK', 'Seřízení světlometů', 'na regloskopu', 250, false, 'none', '15 min'],
    ['Příprava na STK', 'Odstranění závad z protokolu', 'podle hodinové sazby, cenu řekneme předem', 790, false, 'hour', 'podle závady'],
    ['Diagnostika', 'Načtení paměti závad', 'výpis závad a vysvětlení, co hoří a co počká', 490, false, 'none', '20 min'],
    ['Diagnostika', 'Hledání závady', 'elektrika, motor, řídicí jednotky; po půlhodinách', 890, false, 'hour', 'podle závady'],
    ['Diagnostika', 'Kontrola ojetiny před koupí', 'zvedák, diagnostika, měření laku, jízda, písemný protokol', 1490, false, 'none', '1,5 h'],
    ['Diagnostika', 'Test baterie a dobíjení', 'zátěžový test s výtiskem', 150, false, 'none', '10 min'],
    ['Diagnostika', 'Výměna autobaterie', 'včetně zakódování u vozů se start-stop; baterie zvlášť', 350, true, 'none', '30 min'],
    ['Karoserie', 'Koroze prahů a lemů', 'vyříznutí, vevaření plechu, základ', 3500, true, 'none', '1–2 dny'],
    ['Karoserie', 'Ošetření podvozku a dutin', 'mytí, odrezení, vosk do dutin', 4900, true, 'none', '1 den'],
    ['Karoserie', 'Výměna čelního skla', 'i přes pojišťovnu bez spoluúčasti', 3900, true, 'none', 'půl dne'],
    ['Karoserie', 'Leštění světlometů, pár', 'broušení, leštění, UV lak', 890, false, 'none', '1 h'],
    ['Karoserie', 'Lakování dílu', 'sami nelakujeme, zajistíme u lakýrníka v Jičíně', 4500, true, 'none', '3–5 dnů'],
  ] as Array<[string, string, string, number, boolean, 'none' | 'hour' | 'season', string]>,
  hero: {
    eyebrow: '',
    heading: nb('Autoservis a~pneuservis v~Jičíně'),
    text: 'Opravujeme Škodu, Volkswagen, Seat, Audi a dalších osm značek, osobní auta i dodávky do 3,5 t. Cenu vám řekneme, než začneme.',
    primaryLabel: 'Objednat termín',
    secondaryLabel: '',
  },
  facts: {
    items: [
      { label: 'Hodina práce', value: '790 Kč', note: 's DPH, diagnostika 890 Kč' },
      { label: 'Záruka', value: '24 měsíců', note: 'na práci i na díly od nás' },
      { label: 'Cena předem', value: 'do 2 hodin', note: 'od příjmu voláme, co to je a za kolik' },
      { label: 'Náhradní vůz', value: '290 Kč', note: 'za den, u opravy nad 5 000 Kč zdarma' },
    ],
  },
  lamps: { heading: 'Která svítí vám?', text: 'Vyberte kontrolku a uvidíte, co s tím děláme a za kolik.' },
  season: {
    title: 'Přezouváme na zimu',
    text: 'Do 11. prosince máme na přezutí otevřeno i v sobotu dopoledne. Jedeme po půlhodinách, takže se prosím objednejte.',
    chip: '',
    prices: [
      { label: 'Kola na discích', price: 480, note: '4 kola, 20 minut' },
      { label: 'Pneu 13–15"', price: 1090, note: 's vyvážením, 40 minut' },
      { label: 'Pneu 16–17"', price: 1290, note: 's vyvážením, 45 minut' },
      { label: '18" a větší, SUV', price: 1590, note: 'i dodávky, 1 hodina' },
    ],
    buttonLabel: 'Objednat přezutí',
  },
  prices: {
    eyebrow: 'Ceník',
    heading: nb('Co děláme a~za kolik'),
    text: 'Ceny jsou s DPH a platí pro běžné osobní vozy. U položek „od“ záleží na motoru a dílech: přesnou částku dostanete před opravou.',
    footnote: '',
  },
  steps: {
    eyebrow: 'Jak oprava probíhá',
    heading: 'Čtyři zastávky, žádná odbočka bez vašeho souhlasu',
    text: '',
    steps: [
      { title: 'Objednání', text: 'Zavoláte nebo napíšete, co auto dělá. Dáme vám termín a domluvíme, jestli chcete náhradní vůz nebo auto vyzvednout.', mark: '', key: false },
      { title: 'Diagnóza a cena', text: 'Auto zvedneme, projdeme a připojíme na diagnostiku. Do dvou hodin voláme: co to je, co počká a kolik to bude stát.', mark: '', key: false },
      { title: 'Oprava', text: 'Děláme jen to, na čem jsme se domluvili. Když se pod koly najde něco dalšího, voláme dřív, než na to sáhneme.', mark: '', key: false },
      { title: 'Předání', text: 'Ukážeme vám, co jsme vyměnili a proč, a projdeme fakturu po řádcích. Platí se kartou nebo hotově, záruka je 24 měsíců.', mark: '', key: false },
    ],
  },
  workshop: {
    photos: [
      { photo: 'lift', lead: 'Dva zvedáky a 3D geometrie.', text: 'Na jednom servis, na druhém to, co nepočká.' },
      { photo: 'parts', lead: 'Staré díly schováváme,', text: 'dokud si pro auto nepřijdete.' },
    ],
  },
  makes: {
    eyebrow: 'Značky a specializace',
    heading: 'Koncernová auta známe do posledního šroubu',
    groups: [
      { names: GROUP_MAKES, text: 'Petr na nich dělal čtrnáct let v autorizovaném servisu. Máme pro ně originální diagnostiku, zapisujeme do elektronické servisní knížky a běžné díly držíme skladem.' },
      { names: OTHER_MAKES, text: 'Běžný servis, brzdy, podvozky, rozvody, spojky a klimatizace. Díly objednáváme do druhého dne. Zvedneme i dodávky do 3,5 t a hybridy servisujeme mimo vysokonapěťovou část.' },
    ],
    notHeading: 'Co neděláme',
    notText: 'Raději to řekneme rovnou, než abyste k nám jeli zbytečně.',
    notDoing: NOT_DOING,
  },
  extras: {
    heading: 'Aby vás oprava nezdržela',
    items: extras([
      { name: 'Náhradní vůz', price: '290 Kč', unit: 'za den', text: 'Dva malé hatchbacky s dálniční známkou. U opravy nad 5 000 Kč je máte zdarma, platíte jen benzin.', photo: 'loaner' },
      { name: 'Vyzvednutí a přivezení', price: 'po Jičíně zdarma', unit: '', text: 'Ráno si pro auto přijedeme domů nebo do práce, večer ho vrátíme. Do 15 km od Jičína za 300 Kč.', photo: 'dusk' },
      { name: 'Uskladnění pneumatik', price: '790 Kč', unit: 'za sezónu', text: 'Cena za sadu, s disky i bez. Změříme vzorek a řekneme, kolik sezón ještě vydrží.', photo: 'tyres' },
    ]),
  },
  team: {
    eyebrow: 'Kdo vám na auto sáhne',
    heading: nb('Tři lidé, které potkáte na dílně i~u~telefonu'),
    text: 'Nemáme přijímacího technika ani call centrum. Telefon bere ten, kdo má zrovna čisté ruce, a při předání mluvíte s tím, kdo auto opravoval.',
    people: team(
      ['Majitel, diagnostika a motory', 'Mechanik, podvozky a brzdy', 'Pneuservis a klimatizace'],
      [
        'V oboru 29 let, z toho 14 v autorizovaném servisu. Když něco svítí a nikdo neví proč, skončí to u něj.',
        '11 let v oboru. Dělá geometrii, rozvody a spojky a na zkušební jízdu po opravě jezdí vždycky sám.',
        'U nás od vyučení, sedm let. V sezóně přezuje třicet aut denně a ví, kde která sada leží.',
      ],
    ),
  },
  reviews: {
    eyebrow: 'Co o nás píšou zákazníci',
    heading: '„Cena seděla na korunu“',
    items: reviews(['Škoda hatchback 1.2', 'Volkswagen sedan 2.0 diesel', 'Hyundai kombi', 'Ford dodávka 2.0 diesel']),
  },
  booking: {
    eyebrow: 'Objednat termín',
    heading: nb('Napište, co auto dělá. Ozveme se s~termínem.'),
    text: 'Na poptávku odpovídáme do dvou pracovních hodin.',
    callLabel: 'Rychlejší je zavolat',
    callNote: CALL_NOTE,
    submitLabel: 'Odeslat poptávku',
    sentText: 'Děkujeme, poptávku máme. Ozveme se do dvou pracovních hodin.',
    carLabel: 'Vůz: značka, model, rok',
    plateLabel: '(nepovinné)',
    messageHint: 'Při brzdění píská zleva vepředu. STK mi končí 4. 12.',
    loanerLabel: 'Potřebuji náhradní vůz',
    privacyNote: 'Údaje použijeme jen k vyřízení vaší poptávky.',
  },
  where: {
    eyebrow: 'Kde nás najdete',
    heading: nb('Vlečkovská 412, první brána za~vlečkou'),
    arrival: 'Ze silnice na Hradec Králové odbočte u čerpací stanice do Vlečkovské. Po 400 metrech přejedete vlečku a jsme první zelená brána vpravo. Na dvoře je šest míst.',
    keys: 'Klíče mimo otevírací dobu hoďte do schránky u brány.',
    transit: 'Autobus: zastávka Průmyslová zóna, 3 minuty pěšky. Na vlak 12 minut.',
    hoursNote: '',
    towards: 'Hradec Králové',
    road: 'silnice I/35',
    comingFrom: 'z centra Jičína',
    turnAt: 'u čerpací stanice',
    distance: '400 m od odbočky',
    landmark: 'vlečka',
    places: '6 míst',
    workshopNote: 'dva zvedáky, pneuservis, sklad pneu',
    streetLabel: 'Vlečkovská ulice',
    gateLabel: 'zelená brána',
    keyLabel: 'klíče sem',
    turns: [
      { icon: 'arrow-up' as const, text: 'Z centra po hlavní silnici směr Hradec Králové', distance: '1,8 km' },
      { icon: 'corner-up-right' as const, text: 'U čerpací stanice vpravo do Vlečkovské', distance: '400 m' },
      { icon: 'train-track' as const, text: 'Přejedete vlečku', distance: '30 m' },
      { icon: 'flag' as const, text: 'První zelená brána vpravo. Jste tu.', distance: 'P 6 míst' },
    ],
  },
  privacy: {
    title: 'Ochrana osobních údajů',
    slug: 'ochrana-osobnich-udaju',
    heading: 'Ochrana osobních údajů',
    intro: 'Tohle je ukázkový text. Než web zveřejníte, nahraďte ho vlastním zněním, nejlépe po poradě s právníkem.',
    sections: [
      { heading: 'Kdo údaje zpracovává', text: 'Údaje zpracovává provozovatel autoservisu, jehož název, sídlo a IČO najdete v zápatí stránky.' },
      { heading: 'K čemu je potřebujeme', text: 'Jméno, telefon, údaje o voze a popis závady použijeme jen k tomu, abychom vám odpověděli, domluvili termín a opravu provedli. Nikomu je nepředáváme.' },
      { heading: 'Jak dlouho je uchováváme', text: 'Poptávku, ze které se nestala zakázka, mažeme do jednoho roku. Doklady o zakázce uchováváme po dobu, kterou nám ukládá zákon.' },
      { heading: 'Vaše práva', text: 'Můžete požádat o přístup ke svým údajům, jejich opravu nebo smazání. Stačí napsat nebo zavolat na kontakt v zápatí.' },
    ],
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    hero: 'Dílna Autoservisu U Vlečky: stříbrný hatchback na zvedáku a mechanik pod ním',
    yard: 'Dvůr servisu z ulice: otevřená zelená brána a dílna s roletovými vraty',
    lift: 'Tmavě modré kombi na dvousloupovém zvedáku',
    tyres: 'Regál s uskladněnými pneumatikami',
    bonnet: 'Mechanik skloněný pod kapotou šedého vozu v dílně',
    petr: 'Petr Vondra, majitel servisu',
    tomas: 'Tomáš Hejna, mechanik',
    marek: 'Marek Šolc, pneuservis a klimatizace',
    parts: 'Sjeté brzdové kotouče a destičky vedle nového kotouče na pracovním stole',
    wheel: 'Kolo se zimní pneumatikou na vyvažovačce',
    loaner: 'Bílý hatchback, náhradní vůz, na dvoře servisu',
    dusk: 'Servis v podvečer: rozsvícená dílna s autem na zvedáku',
  },
}

// What a look's design words differently from the texts above: a site made in that look gets
// these (the seed is told the look). A list is replaced whole; a text is replaced by its own.
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  kontrolky: {
    sections: ['hero', 'lamps', 'season', 'prices', 'workshop', 'steps', 'makes', 'extras', 'team', 'reviews', 'booking', 'where'],
    settings: { tagline: 'autoservis, Jičín' },
    menu: {
      main: [['Ceník', 'prices'], ['Jak oprava probíhá', 'steps'], ['Značky', 'makes'], ['Lidé', 'team'], ['Příjezd', 'where']],
      footer: [['Ceník', 'prices'], ['Jak oprava probíhá', 'steps'], ['Značky', 'makes'], ['Lidé', 'team'], ['Objednat termín', 'booking'], ['Příjezd', 'where']],
    },
    hero: {
      eyebrow: 'Autoservis a pneuservis v Jičíně',
      heading: 'Svítí vám kontrolka?',
      text: 'Opravujeme Škodu, Volkswagen, Seat, Audi a dalších osm značek. Do dvou hodin od příjmu víte, co to je a kolik to bude stát.',
      secondaryLabel: 'Ceník',
    },
    season: {
      title: 'Venku mrzne, přezouváme',
      text: 'Do 11. prosince i v sobotu dopoledne. Jedeme po půlhodinách, tak se prosím objednejte.',
      chip: '+3 °C',
    },
    prices: {
      heading: 'Kolik to bude stát',
      text: 'Ceny s DPH pro běžná osobní auta. „Od“ znamená, že záleží na motoru a dílech: přesnou částku dostanete před opravou.',
      footnote: 'Účtujeme po půlhodinách. Záruka 24 měsíců na práci i díly od nás.',
    },
    workshop: {
      photos: [
        { photo: 'lift', lead: 'Dva zvedáky, 3D geometrie, plnička obou chladiv.', text: 'Pro koncernová auta máme originální diagnostiku.' },
        { photo: 'parts', lead: 'Staré díly necháváme na stole,', text: 'dokud si pro auto nepřijdete.' },
      ],
    },
    steps: {
      heading: 'Řadíme popořadě',
      text: 'Z jedničky na pětku, žádný stupeň nepřeskakujeme. A když se po opravě něco nezdá, je tu zpátečka.',
      steps: [
        { title: 'Objednání', text: 'Zavoláte nebo vyplníte formulář. Řekneme termín a domluvíme náhradní vůz nebo vyzvednutí auta.', mark: '', key: false },
        { title: 'Příjem a diagnóza', text: 'Auto zvedneme, projdeme a připojíme na diagnostiku. Sepíšeme, co je nutné hned a co počká.', mark: '', key: false },
        { title: 'Cena předem', text: 'Do dvou hodin od příjmu voláme s cenou a potvrdíme ji SMS. Bez vašeho „ano“ nezačneme.', mark: '', key: true },
        { title: 'Oprava', text: 'Děláme jen to, na čem jsme se domluvili. Když se najde něco dalšího, voláme dřív, než na to sáhneme.', mark: '', key: false },
        { title: 'Předání', text: 'Ukážeme staré díly a projdeme fakturu po řádcích. Platí se kartou nebo hotově.', mark: '', key: false },
        { title: 'Zpátečka', text: 'Záruka 24 měsíců na práci i díly. Když se vám něco nezdá, přijeďte: podíváme se hned a zdarma.', mark: 'R', key: false },
      ],
    },
    makes: {
      heading: GROUP_MAKES,
      groups: [
        { names: GROUP_MAKES, text: 'Koncernová auta jsou naše specializace. Petr na nich dělal čtrnáct let v autorizovaném servisu, máme pro ně originální diagnostiku a zapisujeme do elektronické servisní knížky.' },
        { names: OTHER_MAKES, text: 'Běžný servis, brzdy, podvozky, rozvody, spojky a klimatizace. Díly do druhého dne. Zvedneme i dodávky do 3,5 t a hybridy servisujeme mimo vysokonapěťovou část.' },
      ],
      notText: '',
    },
    extras: {
      heading: 'K opravě navíc',
      items: extras([
        { name: 'Náhradní vůz', price: '290 Kč', unit: 'za den', text: 'Dva malé hatchbacky s dálniční známkou. U opravy nad 5 000 Kč zdarma, platíte jen benzin.', photo: 'loaner' },
        { name: 'Vyzvednutí a přivezení', price: 'po Jičíně zdarma', unit: '', text: 'Ráno si pro auto přijedeme, odpoledne ho vrátíme. Do 15 km od Jičína za 300 Kč.', photo: 'bonnet' },
        { name: 'Uskladnění pneumatik', price: '790 Kč', unit: 'za sezónu', text: 'Cena za sadu, s disky i bez. Změříme vzorek a řekneme, kolik sezón ještě vydrží.', photo: 'tyres' },
      ]),
    },
    team: {
      eyebrow: 'Lidé',
      heading: '47 let pod kapotou',
      text: 'Dohromady. Telefon bere ten, kdo má zrovna čisté ruce, a při předání mluvíte s tím, kdo auto opravoval.',
      people: team(
        ['Majitel, diagnostika a motory', 'Mechanik, podvozky a brzdy', 'Pneuservis a klimatizace'],
        [
          'Čtrnáct let v autorizovaném servisu. Když něco svítí a nikdo neví proč, skončí to u něj.',
          'Dělá geometrii, rozvody a spojky. Na zkušební jízdu po opravě jezdí vždycky sám.',
          'U nás od vyučení. V sezóně přezuje třicet aut denně a ví, kde která sada leží.',
        ],
      ),
    },
    reviews: { eyebrow: 'Zákazníci', heading: 'Co o nás píšou' },
    booking: {
      heading: 'Popište, co auto dělá',
      sentText: 'Poptávku máme. Ozveme se do dvou pracovních hodin.',
      messageHint: 'Svítí oranžová kontrolka motoru, auto netáhne. STK mi končí 4. 12.',
    },
    where: {
      eyebrow: 'Příjezd',
      transit: 'Autobus: zastávka Jičín, Průmyslová zóna, 3 minuty pěšky. Na vlak 12 minut.',
      hoursNote: 'V sobotu jen pneuservis, v sezóně přezouvání. Polední pauzu nemáme.',
    },
  },
  supliky: {
    sections: ['hero', 'season', 'prices', 'steps', 'team', 'workshop', 'makes', 'extras', 'reviews', 'booking', 'where'],
    settings: { tagline: 'autoservis a pneuservis, Jičín', ctaLabel: 'Objednat' },
    menu: {
      main: [['Ceník', 'prices'], ['Jak to chodí', 'steps'], ['Kdo jsme', 'team'], ['Značky', 'makes'], ['Kudy k nám', 'where']],
      footer: [['Ceník', 'prices'], ['Jak to chodí', 'steps'], ['Kdo jsme', 'team'], ['Značky', 'makes'], ['Objednat termín', 'booking'], ['Kudy k nám', 'where']],
    },
    hero: {
      eyebrow: 'Autoservis a pneuservis v Jičíně',
      heading: nb('Tři mechanici, dva~zvedáky, *žádné překvapení* na~faktuře.'),
      text: 'Jsme Petr, Tomáš a Marek. Opravujeme Škodu, Volkswagen, Seat, Audi a dalších osm značek, přezouváme a chystáme auta na STK. Cenu řekneme, než na auto sáhneme.',
      secondaryLabel: 'Kolik to stojí',
    },
    season: {
      title: 'Je čas přezout',
      text: 'Do 11. prosince přezouváme i v sobotu dopoledne. Jedeme po půlhodinách, tak se prosím objednejte.',
    },
    prices: {
      heading: 'Šuplík po šuplíku',
      text: 'Ceny jsou s DPH pro běžná osobní auta. Kde je „od“, záleží na motoru a dílech: přesnou částku vám řekneme před opravou, ne po ní.',
    },
    steps: {
      eyebrow: 'Jak to u nás chodí',
      heading: 'Nahoru, dolů a domů',
      text: 'Čtyři kroky a jedno pravidlo: dokud neřeknete „ano, udělejte to“, auto zůstane tak, jak jste ho přivezli.',
      steps: [
        { title: 'Objednání', text: 'Zavoláte nebo napíšete, co auto dělá. Dáme vám termín a domluvíme náhradní vůz nebo vyzvednutí.', mark: '', key: false },
        { title: 'Diagnóza a cena', text: 'Auto zvedneme, projdeme a připojíme na diagnostiku. Do dvou hodin voláme: co to je, co počká a kolik to bude stát.', mark: '', key: false },
        { title: 'Oprava', text: 'Děláme jen to, na čem jsme se domluvili. Když se pod autem najde něco dalšího, voláme dřív, než na to sáhneme.', mark: '', key: false },
        { title: 'Předání', text: 'Ukážeme vám staré díly a projdeme fakturu řádek po řádku. Platí se kartou nebo hotově, záruka je 24 měsíců.', mark: '', key: false },
      ],
    },
    workshop: {
      photos: [
        { photo: 'hero', lead: 'Dva zvedáky, 3D geometrie, plnička obou chladiv.', text: 'Pro koncernová auta máme originální diagnostiku.' },
        { photo: 'parts', lead: 'Staré díly necháváme na stole,', text: 'dokud si pro auto nepřijdete.' },
      ],
    },
    team: {
      eyebrow: 'Kdo vám na auto sáhne',
      heading: 'Petr, Tomáš a Marek',
      people: team(
        ['Majitel', 'Mechanik', 'Pneuservis'],
        [
          'Diagnostika a motory. Čtrnáct let dělal v autorizovaném servisu. Když něco svítí a nikdo neví proč, skončí to u něj.',
          'Podvozky a brzdy. Dělá geometrii, rozvody a spojky a na zkušební jízdu po opravě jezdí vždycky sám.',
          'Pneu a klimatizace. U nás od vyučení. V sezóně přezuje třicet aut denně a ví, kde která sada leží.',
        ],
      ),
    },
    makes: {
      heading: 'Škodovky umíme poslepu',
      groups: [
        { names: GROUP_MAKES, text: 'Koncernová auta jsou naše specializace. Máme pro ně originální diagnostiku, zapisujeme do elektronické servisní knížky a běžné díly držíme skladem.' },
        { names: OTHER_MAKES, text: 'Běžný servis, brzdy, podvozky, rozvody, spojky a klimatizace. Díly objednáváme do druhého dne. Zvedneme i dodávky do 3,5 t a hybridy servisujeme mimo vysokonapěťovou část.' },
      ],
      notHeading: 'Tohle neděláme',
      notText: 'Řekneme to rovnou, ať k nám nejedete zbytečně.',
    },
    extras: {
      heading: 'Ať vás oprava nezdrží',
      items: extras([
        { name: 'Náhradní vůz', price: '290 Kč', unit: 'za den', text: 'Dva malé hatchbacky s dálniční známkou. U opravy nad 5 000 Kč zdarma, platíte jen benzin.', photo: 'loaner' },
        { name: 'Vyzvednutí a přivezení', price: 'zdarma', unit: 'po Jičíně', text: 'Ráno si pro auto přijedeme domů nebo do práce, večer ho vrátíme. Do 15 km od Jičína za 300 Kč.', photo: 'dusk' },
        { name: 'Uskladnění pneumatik', price: '790 Kč', unit: 'za sezónu', text: 'Cena za sadu, s disky i bez. Změříme vzorek a řekneme, kolik sezón ještě vydrží.', photo: 'tyres' },
      ]),
    },
    reviews: {
      eyebrow: 'Zákazníci',
      heading: 'Co říkají lidi, kteří u nás byli',
      items: reviews(['Škoda hatchback', 'VW sedan diesel', 'Hyundai kombi', 'Ford dodávka']),
    },
    booking: {
      heading: 'Zavolejte, nebo napište, co auto dělá',
      text: 'Na zprávu odpovídáme do dvou pracovních hodin.',
      callLabel: 'Telefon je rychlejší',
      callNote: 'Po–Čt 7.00–17.00, Pá 7.00–15.30. Jindy na mobil {phone}, stačí SMS.',
      submitLabel: 'Odeslat',
      sentText: 'Díky, máme to. Ozveme se do dvou pracovních hodin.',
      carLabel: 'Auto: značka, model, rok',
      plateLabel: '(nemusíte)',
      messageHint: 'Vepředu to klepe na nerovnostech a táhne doprava. STK mi končí 4. 12.',
      loanerLabel: 'Chci náhradní vůz',
    },
    where: {
      eyebrow: 'Kudy k nám',
      heading: 'Za vlečkou první zelená brána',
      arrival: 'Ze silnice na Hradec Králové odbočte u čerpací stanice do Vlečkovské. Po 400 metrech přejedete vlečku a jsme první zelená brána vpravo.',
      transit: 'Autobus: zastávka Jičín, Průmyslová zóna, 3 minuty pěšky. Na vlakové nádraží 12 minut.',
    },
  },
}
