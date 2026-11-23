// Every Czech text of the Association template, in one place: the website's own words (what is
// not content: "Nejbližší akce", "Přihlásit", the anchors of the sections) and the demo content
// the seed puts in (with what a look's design words differently: `demoByLook`). Another
// language is a file beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

export interface Words extends KitWords {
  /** The wordmark's label for screen readers: "Planá hruška, úvodní stránka". */
  toTop: (name: string) => string
  openMenu: string
  closeMenu: string
  /** Months, January first: "leden"; and as they stand after a day: "ledna". */
  months: string[]
  monthsOf: string[]
  /** Days, Sunday first: "sobota"; "v sobotu"; "do soboty" (the genitive); "so". */
  weekdays: string[]
  weekdaysOn: string[]
  weekdaysUntil: string[]
  weekdaysShort: string[]
  /** The four seasons, as the cards write them. */
  seasons: Record<'zima' | 'jaro' | 'leto' | 'podzim', string>
  nearest: string
  /** "Nejbližší akce · sobota 9:00" */
  nearestAt: (weekday: string, time: string) => string
  signUp: string
  signUpLong: string
  /** "Přihlásit se · volných 5 z 12" */
  signUpFree: (free: number, places: number) => string
  full: string
  /** "Volných míst: 5 z 12." */
  placesLeft: (free: number, places: number) => string
  noSignup: string
  details: string
  where: string
  bring: string
  signupLabel: string
  /** "Ano, do čtvrtka 26. 11., ať víme…" */
  signupYes: (by: string, note: string) => string
  signupNone: string
  /** "listopadu, v sobotu od 9 do 14 hodin" (with a year: "října 2026, v sobotu…") */
  whenLong: (monthOf: string, weekdayOn: string, from: string, to: string, year?: number) => string
  /** "Zatím 31 lidí." */
  soFar: (n: number) => string
  /** "S sebou:" in the list of events */
  bringShort: string
  /** "Letos:" before a project's result */
  thisYear: string
  currency: string
  pastEvent: string
  signUpForOption: (title: string, short: string) => string
  allEventsBack: string
  moreEvents: string
  noEvents: string
  readMore: string
  allNewsBack: string
  rightNow: string
  qrPayment: string
  qrSample: string
  account: string
  permanent: string
  download: string
  noFile: string
  meetLabel: string
  presenceLabel: string
  reachLabel: string
  idNumber: string
  register: string
  dataBox: string
  /** The preposition-and-number glue of a date: "26. 11." */
  shortDate: (day: number, month: number) => string
  /** The addresses of the sections on a page (`/#rok`), by block type. */
  anchors: Record<'year' | 'events' | 'help' | 'accounts' | 'documents' | 'people' | 'news' | 'contact' | 'give', string>
}

const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

export const words: Words = {
  ...KIT_WORDS.cs,
  toTop: (name) => `${name}, úvodní stránka`,
  openMenu: 'Otevřít menu', closeMenu: 'Zavřít menu',
  months: ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'],
  monthsOf: ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'],
  weekdays: ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'],
  weekdaysOn: ['v neděli', 'v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu'],
  weekdaysUntil: ['neděle', 'pondělí', 'úterý', 'středy', 'čtvrtka', 'pátku', 'soboty'],
  weekdaysShort: ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'],
  seasons: { zima: 'zima', jaro: 'jaro', leto: 'léto', podzim: 'podzim' },
  nearest: 'Nejbližší akce',
  nearestAt: (weekday, time) => `Nejbližší akce · ${weekday}${time ? ` ${time}` : ''}`,
  signUp: 'Přihlásit',
  signUpLong: 'Přihlásit se',
  signUpFree: (free, places) => `Přihlásit se · volných ${free} z ${places}`,
  full: 'Obsazeno',
  placesLeft: (free, places) => `Volných míst: ${free} z ${places}.`,
  noSignup: 'bez přihlášení',
  details: 'Podrobnosti',
  where: 'Kde',
  bring: 'S sebou',
  signupLabel: 'Přihlášení',
  signupYes: (by, note) => `Ano${by ? `, do ${by}` : ''}${note ? `, ${note}` : ''}.`,
  signupNone: 'Není potřeba, stačí přijít.',
  whenLong: (monthOf, weekdayOn, from, to, year) => `${monthOf}${year ? ` ${year}` : ''}, ${weekdayOn}${from ? ` od ${from}${to ? ` do ${to}` : ''} hodin` : ''}`,
  soFar: (n) => `Zatím ${n} ${plural(n, 'člověk', 'lidé', 'lidí')}.`,
  bringShort: 'S sebou:',
  thisYear: 'Letos:',
  currency: 'Kč',
  pastEvent: 'Proběhlo',
  signUpForOption: (title, short) => `Přihlašuji se na akci: ${title} (${short})`,
  allEventsBack: 'Kalendář akcí',
  moreEvents: 'Další akce',
  noEvents: 'Další akce teprve chystáme.',
  readMore: 'Číst dál',
  allNewsBack: 'Všechny aktuality',
  rightNow: 'právě teď',
  qrPayment: 'QR platba',
  qrSample: 'QR kód pro platbu (ukázka)',
  account: 'Transparentní účet',
  permanent: 'Stálé',
  download: 'Stáhnout',
  noFile: 'soubor doplníme',
  meetLabel: 'Scházíme se',
  presenceLabel: 'Někdo tu je',
  reachLabel: 'Napište nebo zavolejte',
  idNumber: 'IČO',
  register: 'Spolkový rejstřík',
  dataBox: 'Datová schránka',
  shortDate: (day, month) => `${day}. ${month}.`,
  anchors: {
    year: 'rok', events: 'akce', help: 'pomoc', accounts: 'ucty', documents: 'dokumenty', people: 'lide', news: 'aktuality', contact: 'kontakt', give: 'dar',
  },
  defaultName: 'Náš spolek',
}

// ── the demo content: the fictional association Planá hruška, z. s., of neighbours who look
//    after old orchards, field avenues, a wet meadow and seven springs around Jablonné nad
//    Orlicí. The people, the sums, the phone numbers and the addresses are invented. The dates
//    of the events are not here: the seed writes them relative to the day it runs. ──
export const demo = {
  settings: {
    siteName: 'Planá hruška',
    legalName: 'Planá hruška, z. s.',
    about: 'Spolek sousedů, kteří se od roku 2011 starají o staré sady, aleje a studánky kolem Jablonného nad Orlicí.',
    companyId: '12345678',
    register: 'Krajský soud v Hradci Králové, spisová značka L 7421',
    dataBox: 'k7vm3hq',
    account: '2901847365/0000',
    accountUrl: 'https://banka.example/ucet/2901847365',
    giftEmail: 'dary@hruska.example',
    placeName: 'Sušárna Na Vrších',
    address: 'U Sušárny 214, 561 64 Jablonné nad Orlicí',
    directions: 'Od náměstí 1,2 km do kopce, pěšky 20 minut.',
    presence: 'každý čtvrtek 16–18 h',
    presenceNote: 'Od dubna do října. V zimě po domluvě.',
    email: 'spolek@hruska.example',
    phone: '123 456 701',
    ctaLabel: 'Podpořit',
    metaDescription: 'Spolek Planá hruška se od roku 2011 stará o staré sady, aleje a studánky kolem Jablonného nad Orlicí. Kalendář brigád a akcí, jak pomoci, výroční zprávy a účty.',
  },
  // What is done in each month (the strip of the year), and the same as a sentence (the label in the opening).
  months: [
    { text: 'řez starého sadu', doing: 'řežeme starý sad' },
    { text: 'kurz řezu, budky', doing: 'učíme řez a stloukáme budky' },
    { text: 'roubování, dosadba', doing: 'roubujeme a dosazujeme' },
    { text: 'studánky, vycházka', doing: 'čistíme studánky' },
    { text: 'počítání orchidejí', doing: 'počítáme orchideje' },
    { text: 'první seč louky', doing: 'kosíme louku' },
    { text: 'ovce v sadu, zálivka', doing: 'pasou se ovce v sadu' },
    { text: 'druhá seč, očkování', doing: 'kosíme podruhé' },
    { text: 'moštárna otevírá', doing: 'otevíráme moštárnu' },
    { text: 'Den v sadu', doing: 'slavíme Den v sadu' },
    { text: 'sázení alejí', doing: 'sázíme aleje' },
    { text: 'advent u sušárny', doing: 'čekáme na advent u sušárny' },
  ],
  menu: { year: 'Co děláme', events: 'Kalendář', help: 'Jak pomoci', accounts: 'Účty', people: 'Lidé', contact: 'Kontakt' },
  legal: { statutes: 'Stanovy', privacy: 'Ochrana osobních údajů', facebook: 'Facebook' },
  facebookUrl: 'https://facebook.example/planahruska',
  home: { title: 'Úvod' },
  opening: {
    heading: '*Od roku 2011* pečujeme o staré sady, aleje a studánky kolem Jablonného nad Orlicí.',
    text: 'Po sobotách, vlastníma rukama a s každým, kdo přijde. V zimě řežeme, na jaře sázíme, v létě kosíme a na podzim lisujeme mošt.',
    primaryLabel: 'Přijít na akci',
    secondaryLabel: 'Podpořit spolek',
  },
  year: {
    heading: 'Co se u nás *kdy* dělá',
    text: 'Sad, louka ani studánka nepočkají, až se to bude hodit. Takhle vypadá náš rok, měsíc po měsíci.',
    asideHeading: 'A mezi tím? *Schůze, žádosti o dotace a broušení kos.*',
    asideText: 'Co se za rok udělalo a co to stálo, sepisujeme do výroční zprávy. Ta za rok 2025 má dvacet stran.',
    asideLinkLabel: 'Účty a výroční zprávy',
  },
  projects: [
    {
      title: 'Starý sad Na Vrších', season: 'winter' as const, period: 'leden až březen',
      text: 'Sad ze třicátých let, který dvacet let nikdo neřezal. Od roku 2012 ho máme v nájmu od města a vracíme ho do kondice: řežeme, dosazujeme staré odrůdy a přes léto v něm paseme ovce.',
      result: 'zimní řez 61 stromů, dosazeno 12 jabloní a 4 hrušně. V sadu roste 94 stromů 31 odrůd.',
    },
    {
      title: 'Studánky', season: 'spring' as const, period: 'duben',
      text: 'Staráme se o sedm studánek v lesích kolem města. Čistíme jímky, opravujeme stříšky a jednou ročně necháváme udělat rozbor vody.',
      result: 'vyčištěno všech 7, nová stříška u Vavřincovy. Rozbor vody vyhověl u pěti.',
    },
    {
      title: 'Louka Mokřiny', season: 'summer' as const, period: 'červen a srpen',
      text: 'Podmáčenou louku pod lesem kosíme ručně a lištovou sekačkou, vždy až po odkvětu orchidejí. Seno si odváží chovatel koz z Orliček.',
      result: '2 seče na 1,2 ha. V květnu 310 kvetoucích prstnatců, předloni 190.',
    },
    {
      title: 'Moštárna a kurzy', season: 'autumn' as const, period: 'září až listopad',
      text: 'V sušárně lisujeme jablka z okolních zahrad, každou sobotu od září do půlky listopadu. V zimě učíme řez, v létě roubování.',
      result: '3 400 litrů moštu pro 212 lidí, 2 kurzy řezu a 41 absolventů.',
    },
    {
      title: 'Aleje a meze', season: 'autumn' as const, period: 'listopad',
      text: 'Sázíme ovocné stromy a keře podél polních cest, kde bývaly, než se scelila pole. O každý stromek se pak pět let staráme: zálivka, výchovný řez, oprava chráničů po zimě.',
      result: '3 brigády, 240 vysazených stromů a keřů. Od roku 2011 dohromady 2,9 km alejí.',
    },
  ],
  events: {
    heading: 'Kdy se *uvidíme*',
    text: 'Přijít může kdokoli, i jen na dopoledne. Nářadí a rukavice půjčíme, děti jsou vítané.',
    limit: 8,
    allLabel: 'Všechny akce',
    lookbackHeading: 'Jak to vypadalo *minule*',
    pastLimit: 3,
    // The coming events, nearest first; `in` is the number of days after the nearest one (the seed
    // writes the dates from the day it runs, so the calendar is never stale), `at` the start.
    coming: [
      {
        title: 'Sázíme alej k Mistrovicím', in: 0, at: '09:00', endTime: '14:00',
        place: 'Sraz u kříže na polní cestě za hřbitovem',
        summary: 'Šedesát vysokokmenů na šesti stech metrech polní cesty. Práce se najde pro každého.',
        text: 'Šedesát vysokokmenů – třešně, hrušně a jeřáby – na šesti stech metrech polní cesty. Práce se najde pro každého: kopat jámy, zatloukat kůly, vázat stromky, nosit vodu.',
        teaser: 'Rýč s sebou, polévka je naše.',
        bring: 'Pevné boty, rukavice, rýč, kdo ho má, a svačinu. Polévka a čaj jsou naše.',
        signup: true, signupBy: -2, signupLabel: 'Přihlásit se na sázení', signupNote: 'ať víme, kolik vzít nářadí a uvařit polévky', registered: 31,
      },
      {
        title: 'Adventní mošt u sušárny', in: 6, at: '17:00', endTime: '',
        place: 'Sušárna Na Vrších', summary: 'Svařený mošt, oheň a sousedé.', text: '',
        teaser: '', bring: 'vlastní hrnek', signup: false,
      },
      {
        title: 'Budky a krmítka s dětmi', in: 14, at: '09:00', endTime: '12:00',
        place: 'Dílna v sušárně', summary: 'Stloukáme budky na jaro do sadu i domů.', text: '',
        teaser: '', bring: 'nic, materiál i nářadí máme; 50 Kč na dítě', signup: true, capacity: 12, registered: 7,
      },
      {
        title: 'Zimní řez starého sadu', in: 49, at: '09:00', endTime: '',
        place: 'Sad Na Vrších', summary: 'Začátečníky zaučíme na místě.', text: '',
        teaser: '', bring: 'pilku a nůžky, kdo má, a teplé oblečení', signup: false,
      },
      {
        title: 'Členská schůze', in: 62, at: '18:00', endTime: '',
        place: 'Malý sál kulturního domu', summary: 'Veřejná: účty za rok 2026 a plán na rok 2027.', text: '',
        teaser: '', bring: '', signup: false,
      },
      {
        title: 'Kurz řezu ovocných stromů', in: 84, at: '09:00', endTime: '15:00',
        place: 'Sad Na Vrších', summary: 'Dopoledne teorie v sušárně, odpoledne na žebříku.', text: '',
        teaser: '', bring: 'nůžky, kdo má; 250 Kč s obědem, členové zdarma', signup: true, capacity: 20, registered: 9,
      },
    ],
    // Past events with a photograph, newest first; `in` counts back from the nearest event.
    past: [
      { title: 'Podzimní brigáda v sadu', in: -21, at: '09:00', photo: 'ohen' as const, recap: 'Přišlo 23 lidí. Shrabali jsme listí, spálili prořez a opravili oplocenku. Pak se sedělo u ohně do tmy.' },
      { title: 'Den v sadu', in: -42, at: '10:00', photo: 'bedynky' as const, recap: 'Ochutnávka 31 odrůd, lisování před očima a asi 140 návštěvníků. Vylisovalo se 620 litrů moštu.' },
      { title: 'Vycházka kvetoucí alejí', in: -217, at: '14:00', photo: 'vychazka' as const, recap: '35 lidí, čtyři kilometry a výklad botaničky o tom, co všechno roste na mezích.' },
    ],
  },
  help: {
    heading: 'Tři způsoby, jak být *u toho*',
    text: 'Nejvíc pomůže, když přijdete. Když to nejde, pomůže členství nebo pár stovek na stromky.',
    volunteerLabel: 'Rukama',
    volunteerHeading: 'Přijďte na brigádu',
    volunteerText: 'Stačí jedno dopoledne. Nářadí i rukavice půjčíme a kdo neví, co dělat, toho se někdo ujme. Poprvé se ozvěte Tereze.',
    memberLabel: 'Členstvím',
    memberHeading: 'Staňte se členem',
    memberAmount: '300 Kč',
    memberUnit: 'na rok',
    memberText: 'Člen hlasuje na členské schůzi, má kurzy zdarma a moštuje za polovic. Na brigády chodit nemusí, ale většina chodí.',
    memberNote: 'Studenti a senioři 150 Kč, celá rodina 500 Kč.',
    memberButtonLabel: 'Vyplnit přihlášku',
    giveLabel: 'Darem',
    giveHeading: 'Pošlete pár stovek',
    giveText: 'Namiřte na kód bankovní aplikaci. Částku doplníte sami, variabilní symbol není potřeba.',
    accountNote: 'Každou platbu si může kdokoli prohlédnout na stránkách banky.',
    accountLinkLabel: 'Nahlédnout do účtu',
    sumsHeading: 'Co se za dar *pořídí*',
    sums: [
      { amount: 150, text: 'pletivo proti okusu k jednomu stromku' },
      { amount: 450, text: 'jeden vysokokmen staré odrůdy s kůlem a úvazkem' },
      { amount: 1200, text: 'rozbor vody z jedné studánky' },
      { amount: 2500, text: 'benzín a nože do lištové sekačky na celou sezonu' },
    ],
    receipt: '*Potvrzení o daru* pro daňové přiznání vystavíme každému, kdo si o ně napíše na {email}. Posíláme je vždy do konce ledna.',
  },
  accounts: {
    heading: 'Účty *na stole*',
    text: 'Rok 2025 podle účetní závěrky. Nikdo ze spolku nebere mzdu ani odměnu, všechnu práci děláme zadarmo.',
    incomeHeading: 'Odkud peníze *přišly*',
    income: [
      { name: 'Dotace Pardubického kraje', amount: 148000 },
      { name: 'Nadace Krajina domova', amount: 75000 },
      { name: 'Dary lidí a firem', amount: 68400 },
      { name: 'Dotace města Jablonné n. Orl.', amount: 60000 },
      { name: 'Moštování a kurzy', amount: 47600 },
      { name: 'Členské příspěvky', amount: 13300 },
    ],
    expensesHeading: 'Kam *odešly*',
    expenses: [
      { name: 'Sazenice, kůly a chrániče', amount: 121500 },
      { name: 'Oprava sušárny a studánek', amount: 96200 },
      { name: 'Nářadí, sekačka, benzín', amount: 58700 },
      { name: 'Arborista a rozbory vody', amount: 49400 },
      { name: 'Akce pro veřejnost a školy', amount: 34900 },
      { name: 'Nájem sadu, pojištění, účetní', amount: 28600 },
      { name: 'Web, banka, pošta', amount: 7500 },
    ],
    leftoverLabel: '*Zůstalo* a převedli jsme do letoška',
    docsHeading: 'Zprávy a závěrky *ke stažení*',
    docYears: 3,
    archive: 'Starší ročníky od roku 2011 jsou *v archivu dokumentů*.',
    supportersHeading: 'Kdo nás *podporuje*',
  },
  documents: {
    heading: 'Zprávy a závěrky *od roku 2011*',
    text: 'Výroční zprávy, účetní závěrky, stanovy a zápisy ze schůzí. Staré ročníky tu zůstávají.',
    // The files of the demo are one-page samples (seed/media/*.pdf).
    items: [
      { title: 'Výroční zpráva', year: 2025, file: 'zprava', note: 'PDF, 2,4 MB' },
      { title: 'Účetní závěrka', year: 2025, file: 'zaverka', note: 'PDF, 310 kB' },
      { title: 'Výroční zpráva', year: 2024, file: 'zprava', note: 'PDF, 1,9 MB' },
      { title: 'Účetní závěrka', year: 2024, file: 'zaverka', note: 'PDF, 290 kB' },
      { title: 'Výroční zpráva', year: 2023, file: 'zprava', note: 'PDF, 2,1 MB' },
      { title: 'Účetní závěrka', year: 2023, file: 'zaverka', note: 'PDF, 270 kB' },
      { title: 'Výroční zpráva', year: 2022, file: 'zprava', note: 'PDF, 1,7 MB' },
      { title: 'Účetní závěrka', year: 2022, file: 'zaverka', note: 'PDF, 260 kB' },
      { title: 'Výroční zpráva', year: 2021, file: 'zprava', note: 'PDF, 1,4 MB' },
      { title: 'Účetní závěrka', year: 2021, file: 'zaverka', note: 'PDF, 240 kB' },
      { title: 'Stanovy spolku', year: null, file: 'stanovy', note: 'znění 2021, PDF, 180 kB' },
      { title: 'Zápis ze schůze 30. 1. 2026', year: null, file: 'zapis', note: 'PDF, 120 kB' },
    ],
  },
  supporters: [
    { name: 'Město Jablonné nad Orlicí', kind: 'město', note: 'sad za korunu a roční dotace' },
    { name: 'Pardubický kraj', kind: 'kraj', note: 'program péče o krajinu' },
    { name: 'Nadace Krajina domova', kind: 'nadace', note: 'grant na výsadbu alejí' },
    { name: 'Truhlářství Doleček, Mistrovice', kind: 'firma', note: 'kůly a řezivo zdarma' },
    { name: '68 dárců', kind: 'lidé', note: 'loni poslali od 100 do 5 000 Kč' },
  ],
  people: {
    heading: 'Kdo to *táhne*',
    text: 'Výbor volí členská schůze na tři roky. Účty jednou ročně projde kontrolní komise: Jan Dostál a Ivana Šimková.',
    helloLabel: 'Jdete poprvé?',
    helloText: 'Dobrovolníky má na starosti Tereza. Zavolejte nebo napište, řekne vám, co a kde.',
    items: [
      { name: 'Marie Kubíčková', role: 'předsedkyně', text: 'Zahradnice. Spolek v roce 2011 zakládala a starý sad zná od dětství, chodila do něj na třešně.', photo: 'marie' as const },
      { name: 'Petr Hanuš', role: 'hospodář', text: 'Učí fyziku na gymnáziu. Hlídá účty, píše žádosti o dotace a na podzim obsluhuje lis.', photo: 'petr' as const },
      { name: 'Tereza Vondrová', role: 'členka výboru, dobrovolníci', text: 'Krajinářka. Domlouvá brigády, vede seznam nářadí a ví, komu chybí rukavice.', photo: 'tereza' as const, phone: '123 456 701', email: 'tereza@hruska.example', volunteers: true },
    ],
  },
  news: {
    heading: 'Co je *nového*',
    count: 4,
    allLabel: 'Všechny aktuality',
    // `in` is the number of days after the nearest event (negative: before it).
    items: [
      { title: 'Sušárna má novou střechu', slug: 'susarna-ma-novou-strechu', in: -10, photo: 'susarna' as const, summary: 'Šindel je položený a před zimou dostal první nátěr. Zaplatil ho grant kraje, 86 000 Kč, a čtrnáct dobrovolníků.', body: ['Stará střecha protékala od jara a sušárna je přitom jediné místo, kde máme nářadí, lis i konvici. Šindele se štípaly z jedlového dřeva a kladly po dvou sobotách. Kdo přišel, ten ví, že to nešlo bez rukavic a bez polévky.', 'Poslední nátěr přijde na jaře. Do té doby se v sušárně klidně lisuje, nasucho a pod novou střechou.'] },
      { title: 'Stromky na sobotní sázení dorazily', slug: 'stromky-na-sobotni-sazeni-dorazily', in: -19, summary: 'Šedesát vysokokmenů čeká v zakládce za sušárnou. Hledáme ještě pět lidí s rýčem a jedno auto s vozíkem.', body: ['Stromky přivezla školka z Mistrovic, třešně, hrušně a jeřáby. Každý má kůl, chránič proti okusu a štítek s odrůdou. Sázet se bude v sobotu od devíti.'] },
      { title: 'Letos se vylisovalo 3 400 litrů moštu', slug: 'letos-se-vylisovalo-3-400-litru-mostu', in: -38, summary: 'Moštárna byla otevřená devět sobot. Výtěžek 31 800 Kč půjde na jarní dosadbu sadu.', body: ['Přišlo 212 lidí a většina z nich s vlastními bedýnkami. Nejvíc se lisovalo v říjnu, kdy dozrály pozdní odrůdy.'] },
      { title: 'Výroční zpráva za rok 2025 je venku', slug: 'vyrocni-zprava-za-rok-2025-je-venku', in: -57, summary: 'Dvacet stran o tom, co se udělalo a co to stálo. Ke stažení mezi dokumenty.', body: ['Zpráva se píše pro členskou schůzi, ale čte se i bez ní. Najdete v ní čísla ze studánek, z louky i z moštárny a seznam všech, kdo nám loni pomohli.'] },
    ],
  },
  contact: {
    heading: '*Stavte se* ve čtvrtek',
    text: 'V sušárně na kraji sadu máme nářadí, lis a konvici. Když se svítí, někdo tam je.',
    formHeading: 'Napište nám',
    formText: 'Přihláška na akci, členství, dar, nebo jen dotaz. Odpovídáme do dvou dnů.',
    topics: ['Chci se stát členem', 'Dar a potvrzení o daru', 'Něco jiného'],
    formNote: 'Údaje použijeme jen k odpovědi a nikomu je nepředáme.',
  },
  pages: {
    events: { title: 'Kalendář akcí', slug: 'akce', heading: 'Kdy se *uvidíme*', text: 'Všechny nadcházející akce a ohlédnutí za těmi, které už proběhly.' },
    news: { title: 'Aktuality', slug: 'aktuality', heading: 'Co je *nového*' },
    documents: { title: 'Dokumenty', slug: 'dokumenty' },
    privacy: { title: 'Ochrana osobních údajů', slug: 'ochrana-osobnich-udaju' },
  },
  privacy: {
    lead: 'Ukázkový text. Před zveřejněním popište, jak se spolek skutečně stará o údaje svých členů a návštěvníků.',
    list: ['jméno, e-mail nebo telefon', 'akce nebo členství, na které se hlásíte', 'údaje potřebné k potvrzení o daru, pokud o ně požádáte'],
    sections: [
      { heading: 'Jaké údaje zpracováváme', text: 'Z formuláře máme vaše jméno, e-mail nebo telefon a zprávu. Když se přihlásíte na akci nebo do spolku, zapíšeme si i to, na co jste se přihlásili.' },
      { heading: 'Proč údaje potřebujeme', text: 'Abychom vám odpověděli, věděli, kolik lidí přijde na brigádu, a mohli vám vystavit potvrzení o daru.' },
      { heading: 'Jak dlouho je uchováváme', text: 'Přihlášky na akce smažeme do měsíce po akci. Údaje členů uchováváme po dobu členství a údaje o darech tak dlouho, jak to ukládá zákon.' },
    ],
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    hero: 'Starý sad na svahu nad městem v říjnu, mezi stromy hrabou a nosí větve čtyři dobrovolníci',
    sad: 'Člověk na žebříku v koruně staré jabloně při zimním řezu',
    studanka: 'Lesní studánka s novou šindelovou stříškou, u ní kbelík a hrábě',
    louka: 'Dva lidé kosí ručními kosami mokrou louku pod lesem, v popředí kvetou orchideje',
    mostovani: 'Lisování jablek na dvorku sušárny, bedýnky jablek a lis na stole',
    alej: 'Tři lidé s rýči sázejí řadu mladých stromků podél polní cesty',
    naradi: 'Hrábě, kosy a rýče opřené o stěnu sušárny',
    ohen: 'Pět lidí sedí za soumraku u ohně v sadu',
    bedynky: 'Bedýnky s jablky starých odrůd v trávě pod jabloní',
    vychazka: 'Skupina lidí jde po polní cestě mezi kvetoucími třešněmi',
    susarna: 'Stará dřevěná sušárna ovoce s novou šindelovou střechou',
    marie: 'Marie Kubíčková',
    petr: 'Petr Hanuš',
    tereza: 'Tereza Vondrová',
  },
}

// What a look's design words differently from the texts above: a site made in that look gets
// these (the seed is told the look). This template has one look, so nothing differs yet.
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {}
