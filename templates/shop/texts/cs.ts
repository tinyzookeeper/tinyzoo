// Every Czech text of the Shop template, in one place: the website's own words (what is not
// content: "Otevřeno", "Zeptat se", the anchors of the sections) and the demo content the seed
// puts in (with what a look's design words differently: `demoByLook`). Another language is a
// file beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

/** What the "Open now" sign says besides its word: until when, or when the shop opens next. */
export type OpeningDetail =
  | { kind: 'until'; time: string }
  | { kind: 'later'; time: string }
  | { kind: 'tomorrow'; time: string }
  /** `day` counts from Monday (0) to Sunday (6) */
  | { kind: 'day'; day: number; time: string }
  | { kind: 'never' }

export interface Words extends KitWords {
  skip: string
  open: string
  closed: string
  /** "zavřeno": a day without opening hours */
  closedDay: string
  /** "Dnes" */
  today: string
  /** "dnes": the mark on today's row of the week */
  todayMark: string
  /** Weekdays from Monday: "Pondělí" */
  days: string[]
  /** "Po" */
  daysShort: string[]
  /** "pondělí": a weekday inside a sentence */
  daysLower: string[]
  /** "po": a weekday in a short date */
  daysShortLower: string[]
  /** "Otevřeno dnes do 17:00." / "Zavřeno, otevíráme zítra v 7:30." */
  openSentence: (open: boolean, detail: OpeningDetail) => string
  openDetail: (detail: OpeningDetail) => string
  address: string
  ask: string
  /** The long button of the mobile menu and the footer */
  askLong: string
  holdDefault: string
  /** "Máte skladem: Mlýnek na mák?" */
  askMessage: (product: string) => string
  /** "Prosím o odložení: Mlýnek na mák." */
  holdMessage: (product: string) => string
  /** The addresses of the sections on a page (`/#sortiment`), by block type. */
  anchors: Record<'ranges' | 'picks' | 'services' | 'news' | 'people' | 'ask' | 'where', string>
  /** The footer's four headings */
  footerShop: string
  footerOnWeb: string
  footerOperator: string
  /** "(SMS, WhatsApp)" beside the mobile number in the footer */
  smsNote: string
  /** "Parkoviště" before the name of the car park */
  parking: string
  /** The sketch of the street, for screen readers */
  sketch: (name: string, address: string) => string
  /** The sign above the logo, for screen readers */
  toTop: (name: string) => string
  nahacku: {
    contactPhone: string
    contactSms: string
    contactEmail: string
    /** The small card hanging by the door sign */
    whereWeAre: string
  }
  regal: {
    contactPhone: string
    contactSms: string
    contactEmail: string
    /** "Č. 58" on the sketch */
    number: (n: string) => string
  }
  portal: {
    /** The row of three panels under the window */
    phone: string
    contactPhone: string
    contactSms: string
    contactEmail: string
    ways: string
  }
}

// "v 7:30", "ve 12:30": Czech says "ve" before two, three, four, twelve to fourteen and twenty onwards.
const at = (time: string): string => {
  const hour = Number.parseInt(time, 10)
  return [2, 3, 4, 12, 13, 14, 20, 21, 22, 23].includes(hour) ? 've' : 'v'
}
const DAYS_IN = ['v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu', 'v neděli']

export const words: Words = {
  ...KIT_WORDS.cs,
  skip: 'Přeskočit na obsah',
  open: 'Otevřeno', closed: 'Zavřeno', closedDay: 'zavřeno',
  today: 'Dnes', todayMark: 'dnes',
  days: ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'],
  daysShort: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
  daysLower: ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'],
  daysShortLower: ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'],
  openDetail: (d) => {
    switch (d.kind) {
      case 'until': return `dnes do ${d.time}`
      case 'later': return `dnes otevíráme ${at(d.time)} ${d.time}`
      case 'tomorrow': return `otevíráme zítra ${at(d.time)} ${d.time}`
      case 'day': return `otevíráme ${DAYS_IN[d.day]} ${at(d.time)} ${d.time}`
      default: return 'momentálně zavřeno'
    }
  },
  openSentence: (open, detail) => `${open ? 'Otevřeno' : 'Zavřeno,'} ${words.openDetail(detail)}.`,
  address: 'Adresa',
  ask: 'Zeptat se', askLong: 'Zeptat se, jestli to máme', holdDefault: 'Odložit',
  askMessage: (product) => `Máte skladem: ${product}?`,
  holdMessage: (product) => `Prosím o odložení: ${product}.`,
  anchors: { ranges: 'sortiment', picks: 'vyloha', services: 'sluzby', news: 'novinky', people: 'lide', ask: 'dotaz', where: 'kde' },
  footerShop: 'Prodejna', footerOnWeb: 'Na webu', footerOperator: 'Provozovatel',
  smsNote: '(SMS, WhatsApp)',
  parking: 'Parkoviště',
  sketch: (name, address) => `Nákres ulice: ${name}, ${address}`,
  toTop: (name) => `${name}, úvodní stránka`,
  nahacku: { contactPhone: 'Telefonem do krámu', contactSms: 'SMS nebo WhatsApp', contactEmail: 'E-mailem', whereWeAre: 'Kde nás najdete' },
  regal: { contactPhone: 'Telefonem', contactSms: 'SMS, WhatsApp', contactEmail: 'E-mailem', number: (n) => `Č. ${n}` },
  portal: {
    phone: 'Telefon',
    contactPhone: 'Telefonem do krámu', contactSms: 'SMS nebo WhatsApp', contactEmail: 'E-mailem',
    ways: 'Jak se k nám dostat',
  },
  defaultName: 'Náš krám',
}

// ── the demo content: the fictional shop U Dvou klíčů, household goods and hardware on a
//    street of the town of Chrudim that the town does not have. The people, the phone numbers
//    and the addresses are invented; the makers are invented too. The shared texts are
//    those of the first design, Portál; `demoByLook` holds what the others word differently. ──
export const demo = {
  settings: {
    siteName: 'U Dvou klíčů',
    tagline: 'Domácí potřeby / Železářství',
    address: 'Cínová 11',
    postalCode: '537 01',
    town: 'Chrudim',
    locationNote: 'Naproti lékárně, dvě minuty ze Starého náměstí.',
    hoursNote: 'O státních svátcích máme zavřeno. V sobotu 5. 12. děláme inventuru.',
    phone: '123 456 701',
    mobile: '123 456 702',
    email: 'kram@klice.example',
    ctaLabel: 'Zeptat se',
    operator: 'Petr Kalous – U Dvou klíčů',
    companyId: '12345678',
    vatId: 'CZ12345678',
    register: 'Zapsán v živnostenském rejstříku MěÚ Chrudim',
    metaDescription: 'Domácí potřeby a železářství na Cínové ulici v Chrudimi. Smalt, kartáče, nářadí, vruty po jednom, klíče na počkání. Od roku 1992.',
  },
  hours: [
    { day: 'mon', from: '7:30', to: '17:00' }, { day: 'tue', from: '7:30', to: '17:00' }, { day: 'wed', from: '7:30', to: '17:00' },
    { day: 'thu', from: '7:30', to: '17:00' }, { day: 'fri', from: '7:30', to: '17:00' }, { day: 'sat', from: '8:00', to: '11:30' },
  ] as Array<{ day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; from: string; to: string }>,
  menu: { ranges: 'Sortiment', picks: 'Ve výloze', services: 'Služby', news: 'Novinky', people: 'Za pultem', ask: 'Zeptat se', where: 'Kde a kdy' },
  footerMenu: { ranges: 'Sortiment', services: 'Služby a ceník', news: 'Novinky' },
  home: { title: 'Úvod' },
  newsPage: { title: 'Novinky', heading: 'Co je u nás nového' },
  privacy: { title: 'Ochrana osobních údajů' },
  intro: {
    eyebrow: '',
    heading: 'Domácí potřeby a železářství v Chrudimi',
    text: 'Smaltované hrnce, kartáče ze žíní, nářadí, vruty po jednom a klíče na počkání. Na Cínové ulici od roku 1992. Co nemáme v regálu, do týdne objednáme.',
    primaryLabel: 'Zeptat se, jestli to máme',
    primaryUrl: '/#dotaz',
    secondaryLabel: 'Kudy k nám',
    secondaryUrl: '/#kde',
    phoneNote: 'Zavolejte, podíváme se do regálu.',
  },
  ranges: {
    eyebrow: 'Sortiment',
    heading: 'Šest oddělení a jeden pult',
    text: 'Vedeme věci, které se dají opravit, nabrousit a předat dál. Tady je, co kde najdete. Každému oddělení věnuje pár slov pan Kalous.',
    items: [
      { name: 'Kuchyň a pečení', image: 'rangeKitchen', text: 'Smalt, litina a nože, které se dají nabrousit. Plast u nás skoro nenajdete.', makers: 'Smaltovna Bělá, litina Brandl, nože Sedlák, vařečky z Lipové Studánky', priceFrom: 35, priceTo: 2490 },
      { name: 'Úklid a prádlo', image: 'rangeCleaning', text: 'Kartáč ze žíní vydrží deset let a smeták se dá znovu nasadit. Poradíme, který je na co.', makers: 'Kartáčovna Peřina, mýdlárna Mečík, utěrky z tkalcovny Úval', priceFrom: 19, priceTo: 890 },
      { name: 'Nářadí a dílna', image: 'rangeTools', text: 'Vedeme to, čím sami doma pracujeme. Kladivo si u pultu potěžkáte, než ho koupíte.', makers: 'Kovárna Dolany, dláta Bystré, pily Hronov, svěrky Kovák', priceFrom: 49, priceTo: 3900 },
      { name: 'Šrouby a kování', image: 'rangeFasteners', text: 'Vruty a hřebíky prodáváme po kusech i na váhu. Přineste starý, najdeme k němu stejný.', makers: 'Spojovací materiál na váhu, kování Tovačka, řetězy a lana na metry', priceFrom: 1, priceTo: 1450 },
      { name: 'Zahrada a dvůr', image: 'rangeGarden', text: 'Konve z pozinku, rýče s jasanovou násadou a semínka od února do podzimu.', makers: 'Kovárna Dolany, Semena Lipka, provaznictví Lomnička', priceFrom: 25, priceTo: 2300 },
      { name: 'Zavařování a sklep', image: 'rangePreserving', text: 'Sklenice, víčka všech průměrů a hrnce s teploměrem. V sezóně i lisy na mošt.', makers: 'Sklárna Rosická, Smaltovna Bělá, demižony v proutí', priceFrom: 6, priceTo: 4500 },
    ],
  },
  picks: {
    eyebrow: 'Ve výloze tento týden',
    heading: 'Právě dorazilo a pár tipů pod stromeček',
    text: 'Výlohu měníme každé pondělí. Koupit se dá jen u pultu: napište nebo zavolejte a zboží vám na tři pracovní dny odložíme.',
    count: 9,
    emptyTitle: 'Nevidíte tu, co sháníte?',
    emptyText: 'V krámě je přes čtyři tisíce položek. Napište, podíváme se.',
    items: [
      { name: 'Smaltovaný kastrol 2 l', image: 'picksKitchen', cropX: 19.7, cropY: 56, zoom: 100, price: 489, tag: 'Právě dorazilo', tagKind: 'new', note: 'S poklicí, krémový nebo modrý. Skladem.', holdLabel: '' },
      { name: 'Mlýnek na mák', image: 'picksKitchen', cropX: 53.2, cropY: 56, zoom: 100, price: 890, tag: 'Na vánoční pečení', tagKind: 'new', note: 'Litinový, se svěrkou na stůl. Poslední tři kusy.', holdLabel: '' },
      { name: 'Vykrajovátka, sada 12 ks', image: 'picksKitchen', cropX: 84, cropY: 56, zoom: 105, price: 159, tag: 'Právě dorazilo', tagKind: 'new', note: 'Hvězdy, srdce a kometa. Skladem.', holdLabel: '' },
      { name: 'Pozinkovaná konev 5 l', image: 'picksYard', cropX: 18.1, cropY: 46, zoom: 92, price: 379, tag: 'Stálice', tagKind: 'new', note: 'Skladem. Desetilitrová na objednávku do týdne.', holdLabel: '' },
      { name: 'Petrolejová lucerna', image: 'picksYard', cropX: 49.4, cropY: 46, zoom: 92, price: 449, tag: 'Tip na dárek', tagKind: 'gift', note: 'V červené poslední kus, černá skladem.', holdLabel: '' },
      { name: 'Smetáček s lopatkou', image: 'picksYard', cropX: 81.7, cropY: 46, zoom: 92, price: 229, tag: 'Stálice', tagKind: 'new', note: 'Bukové dřevo a žíně. Skladem.', holdLabel: '' },
      { name: 'Smaltovaný hrnek 0,4 l', image: 'picksGift', cropX: 16, cropY: 52, zoom: 105, price: 129, tag: 'Tip na dárek', tagKind: 'gift', note: 'Čtyři barvy. Skladem.', holdLabel: '' },
      { name: 'Kované zahradní nůžky', image: 'picksGift', cropX: 49, cropY: 54, zoom: 90, price: 749, tag: 'Tip na dárek', tagKind: 'order', note: 'Z kovárny v Dolanech. Na objednávku do týdne.', holdLabel: 'Objednat' },
      { name: 'Kapesní nůž rybička', image: 'picksGift', cropX: 82, cropY: 56, zoom: 105, price: 169, tag: 'Tip na dárek', tagKind: 'gift', note: 'Ta z dětství. Skladem.', holdLabel: '' },
    ] as Array<{ name: string; image: 'picksKitchen' | 'picksYard' | 'picksGift'; cropX: number; cropY: number; zoom: number; price: number; tag: string; tagKind: 'new' | 'last' | 'gift' | 'order'; note: string; holdLabel: string }>,
  },
  services: {
    eyebrow: 'Služby u pultu',
    heading: 'Co ještě děláme',
    text: 'Vzadu za šuplíky je brus a stroj na klíče. Většinu věcí uděláme, než si vyberete vařečku.',
    items: [
      { name: 'Klíče na počkání', text: 'Běžné, dozické i od schránek. Bezpečnostní od 180 Kč, hotové do druhého dne.', price: 'od 60 Kč', icon: 'key-round' },
      { name: 'Broušení nožů a nůžek', text: 'Nůž 50 Kč, nůžky 80 Kč, sekera 120 Kč. Přineste do čtvrtka, v sobotu si je vyzvednete.', price: 'od 50 Kč', icon: 'scissors' },
      { name: 'Nasazení násad a topůrek', text: 'Sekery, kladiva, rýče a motyky. Cena je za práci, násadu si vyberete u nás.', price: '90 Kč', icon: 'hammer' },
      { name: 'Půjčovna', text: 'Lis na mošt, zavařovací hrnec, vrtací kladivo a čistič koberců. Záloha 1 000 Kč.', price: 'od 150 Kč / den', icon: 'calendar-days' },
      { name: 'Řezání na míru', text: 'Řetězy, lana, závitové tyče a lišty uřízneme na délku, kterou potřebujete.', price: 'v ceně zboží', icon: 'ruler' },
      { name: 'Dovoz po Chrudimi', text: 'Pytle, sudy a všechno, co neunesete. Vozíme v úterý a v pátek odpoledne.', price: '100 Kč', icon: 'truck' },
    ] as Array<{ name: string; text: string; price: string; icon: 'key-round' | 'scissors' | 'hammer' | 'calendar-days' | 'ruler' | 'truck' }>,
  },
  news: {
    eyebrow: 'Novinky z krámu',
    heading: 'Co je u nás nového',
    count: 4,
    moreLabel: 'Starší zprávy',
    items: [
      { date: '2026-11-19T23:00:00Z', title: 'Formičky a vykrajovátka jsou tady', text: 'Dorazily plechové formičky na cukroví, válečky a mlýnky na mák. Vosí hnízda letos máme ve třech velikostech.' },
      { date: '2026-11-11T23:00:00Z', title: 'V sobotu 28. 11. brousíme na počkání', text: 'Od 8 do 11 hodin bude na dvoře brusič pan Zeman. Nože, nůžky i brusle, bez objednání.' },
      { date: '2026-11-02T23:00:00Z', title: 'Posypová sůl a hrabla skladem', text: 'Sůl v pytlích po 10 a 25 kg, hrabla hliníková i dřevěná. Větší množství dovezeme.' },
      { date: '2026-10-25T23:00:00Z', title: 'V sobotu 5. 12. zavřeno', text: 'Děláme inventuru. V pondělí 7. 12. otevíráme jako vždy v půl osmé.' },
      { date: '2026-10-08T22:00:00Z', title: 'Zavařovací víčka všech průměrů', text: 'Doplnili jsme víčka 66, 82 a 100 mm a gumové těsnění do zavařovacích sklenic.' },
      { date: '2026-09-14T22:00:00Z', title: 'Brousíme do čtvrtka, vyzvednete v sobotu', text: 'Nože, nůžky a sekery přineste do čtvrtka, v sobotu na ně dopoledne čekáme na pultu.' },
    ],
  },
  people: {
    eyebrow: 'Za pultem',
    heading: 'Na Cínové ulici od roku 1992',
    text: 'Krám otevřel Václav Kalous v domě, kde se železem obchodovalo už za první republiky. Dnes ho vede jeho syn. Šuplíky za pultem jsou pořád ty původní.',
    quote: 'Když něco nemáme, řekneme vám, kdo to v Chrudimi má.',
    shopTitle: 'Krám na Cínové',
    shopRail: 'od roku 1992',
    shopText: 'Sto dvacet metrů, čtyři tisíce položek a šuplíky, které pamatují tři majitele. Když něco nemáme, řekneme vám, kdo to v Chrudimi má.',
    items: [
      { name: 'Petr Kalous', role: 'Majitel, za pultem od roku 1996', image: 'owner', text: 'Vyučený nástrojař. Dělá klíče, brousí a nejvíc ho baví hledat, ke kterému závitu patří přinesený šroubek.' },
      { name: 'Hana Dvořáková', role: 'Prodavačka, u nás od roku 2008', image: 'assistant', text: 'Ví, ve kterém šuplíku co leží. Poradí s kuchyní, zavařováním i úklidem. V sobotu ji střídá syn Vojta.' },
    ],
  },
  ask: {
    eyebrow: 'Dotaz a odložení zboží',
    heading: 'Máte to skladem? Zeptejte se, než pojedete.',
    text: 'Podíváme se do regálu a do hodiny se ozveme. Zboží odložíme na tři pracovní dny. Co nemáme, objednáme do týdne a bez příplatku.',
    formHeading: 'Napište nám, co sháníte',
    formText: 'Stačí pár slov. Odpovíme v otevírací době, nejpozději druhý den ráno.',
    voucherLabel: 'Dárkové poukazy',
    voucherValues: '300, 500 a 1 000 Kč',
    voucherValidity: 'platí rok',
    voucherText: 'Platí rok na cokoliv v krámě včetně broušení a půjčovny. Vypíšeme na počkání a zabalíme do papíru s provázkem.',
  },
  where: {
    eyebrow: 'Kde a kdy',
    heading: 'Otevírací doba',
    ways: [
      { icon: 'car' as const, label: 'Autem', title: '', text: 'Parkoviště U Staré lípy je 150 m, první hodina zdarma. Pro těžký nákup zajeďte do dvora z Hřebíkové ulice.' },
      { icon: 'bike' as const, label: 'Na kole a pěšky', title: '', text: 'Stojan na šest kol je přímo před výlohou. Ze Starého náměstí jsou to dvě minuty.' },
    ],
    landmark: 'Staré náměstí',
    walk: '2 minuty pěšky',
    parking: 'U Staré lípy',
    parkingDistance: '150 m',
    across: 'naproti lékárně',
    opposite: 'Lékárna',
    sideStreet: 'Hřebíková',
  },
  photos: {
    front: 'Zelený dřevěný portál prodejny s výlohou na Cínové ulici',
    interior: 'Pohled do prodejny: regály se smaltovaným nádobím, kartáči a košíky, vzadu stěna se šuplíky',
    counter: 'Dubový pult s mosaznou váhou a balicím papírem, za ním stěna se šuplíky',
    owner: 'Petr Kalous za pultem prodejny',
    assistant: 'Hana Dvořáková za pultem prodejny',
    rangeKitchen: 'Smaltované hrnce, litinová pánev a vařečky na polici',
    rangeCleaning: 'Kartáče, smetáky a košťata zavěšené na stěně',
    rangeTools: 'Kladiva, pila, kleště a šroubováky zavěšené na dřevěné stěně',
    rangeFasteners: 'Otevřené šuplíky s vruty, hřebíky a podložkami',
    rangeGarden: 'Pozinkované konve, rýč, hrábě a květináče u stěny',
    rangePreserving: 'Zavařovací sklenice, smaltovaný zavařovací hrnec a demižon',
    picksKitchen: 'Krémový smaltovaný kastrol, litinový mlýnek na mák a plechová vykrajovátka v řadě na pultu',
    picksYard: 'Pozinkovaná konev, petrolejová lucerna a dřevěný smetáček na lopatce v řadě na pultu',
    picksGift: 'Smaltovaný hrnek, kované zahradní nůžky a kapesní nůž v řadě na pultu',
  },
  privacyBody: {
    intro: 'Ukázkový text. Před zveřejněním popište, jak s údaji zákazníků nakládáte vy.',
    h1: 'Jaké údaje zpracováváme',
    p1: 'Z dotazového formuláře máme vaše jméno, telefon nebo e-mail a text dotazu. Když si zboží necháte odložit, zapíšeme si ho na lístek u pultu.',
    h2: 'Proč údaje potřebujeme',
    items: ['abychom vám mohli odpovědět', 'abychom pro vás zboží odložili nebo objednali'],
    h3: 'Jak dlouho je uchováváme',
    p3: 'Dotaz po vyřízení do tří měsíců smažeme. Lístek s odloženým zbožím vyhodíme, jakmile si zboží vyzvednete nebo uplyne doba odložení.',
  },
}

type Kind = 'new' | 'last' | 'gift' | 'order'
/** A product of the window as a design words it: the label, its kind, the note and the second button. */
const pick = (tag: string, tagKind: Kind, note: string, holdLabel = ''): { tag: string; tagKind: Kind; note: string; holdLabel: string } => ({ tag, tagKind, note, holdLabel })
const crops = demo.picks.items.map(({ name, image, cropX, cropY, zoom, price }) => ({ name, image, cropX, cropY, zoom, price }))
const picksOf = (labels: ReturnType<typeof pick>[]) => crops.map((c, n) => ({ ...c, ...labels[n]! }))

/** What the other designs word differently from Portál: headings, the lines above them, buttons, menus. */
export const demoByLook: Record<string, DemoOverride<typeof demo>> = {
  // Regál: the shelf. "Máme to skladem." and a shorter, plainer tone; the order button and the phone beside the menu.
  regal: {
    settings: { hoursNote: 'O státních svátcích zavřeno. V sobotu 5. 12. inventura.', register: 'Živnostenský rejstřík MěÚ Chrudim' },
    menu: { picks: 'Právě v regálu', services: 'Dílna', people: 'Lidé', ask: '' },
    footerMenu: { services: 'Dílna a ceník' },
    intro: {
      eyebrow: 'Domácí potřeby a železářství / Chrudim / od roku 1992',
      heading: 'Máme to skladem.',
      text: 'Hrnce, kartáče, nářadí, vruty po jednom a klíče na počkání. A co v regálu není, do týdne objednáme.',
      secondaryLabel: '123 456 701',
      secondaryUrl: 'tel:123456701',
      phoneNote: '',
    },
    ranges: { eyebrow: '', heading: 'Sortiment / šest oddělení', text: 'Ceny od–do, slovy pana Kalouse' },
    picks: {
      eyebrow: '',
      heading: 'Právě v regálu',
      text: 'Devět věcí, které tenhle týden stojí vpředu. Košík tu nehledejte: zeptejte se nebo si je nechte odložit a zaplatíte u pultu.',
      items: picksOf([
        pick('Právě dorazilo', 'new', 'S poklicí, krémový nebo modrý. Skladem.'),
        pick('Poslední 3 kusy', 'last', 'Litinový, se svěrkou na stůl. Na vánoční pečení.'),
        pick('Právě dorazilo', 'new', 'Hvězdy, srdce a kometa. Skladem.'),
        pick('', 'new', 'Skladem. Desetilitrová na objednávku do týdne.'),
        pick('Poslední kus', 'last', 'Červená je poslední, černá skladem. Tip na dárek.'),
        pick('', 'new', 'Bukové dřevo a žíně. Skladem.'),
        pick('Tip na dárek', 'gift', 'Čtyři barvy. Skladem.'),
        pick('Na objednávku do týdne', 'order', 'Z kovárny v Dolanech, jasanové rukojeti.', 'Objednat'),
        pick('Tip na dárek', 'gift', 'Ta z dětství. Skladem.'),
      ]),
    },
    services: {
      eyebrow: 'Služby s ceníkem',
      heading: 'Dílna za pultem',
      text: 'Vzadu je brus a stroj na klíče. Většinu věcí uděláme, než si vyberete vařečku.',
      items: [
        { name: 'Klíče na počkání', text: 'Běžné, dozické i od schránek. Bezpečnostní od 180 Kč, do druhého dne.', price: 'od 60 Kč', icon: 'key-round' },
        { name: 'Broušení nožů a nůžek', text: 'Nůž 50 Kč, nůžky 80 Kč, sekera 120 Kč. Přineste do čtvrtka, v sobotu jsou hotové.', price: 'od 50 Kč', icon: 'scissors' },
        { name: 'Nasazení násad a topůrek', text: 'Sekery, kladiva, rýče a motyky. Cena je za práci, násadu si vyberete u nás.', price: '90 Kč', icon: 'hammer' },
        { name: 'Půjčovna', text: 'Lis na mošt, zavařovací hrnec, vrtací kladivo, čistič koberců. Záloha 1 000 Kč.', price: 'od 150 Kč / den', icon: 'calendar-days' },
        { name: 'Řezání na míru', text: 'Řetězy, lana, závitové tyče a lišty uřízneme na délku, kterou potřebujete.', price: 'v ceně', icon: 'ruler' },
        { name: 'Dovoz po Chrudimi', text: 'Pytle, sudy a všechno, co neunesete. Vozíme v úterý a v pátek odpoledne.', price: '100 Kč', icon: 'truck' },
      ],
    },
    news: { eyebrow: '', heading: 'Z krámu', moreLabel: 'Starší novinky' },
    people: {
      eyebrow: '',
      heading: '34 let za jedním pultem',
      text: 'Krám otevřel v roce 1992 Václav Kalous v domě, kde se železem obchodovalo už za první republiky. Dnes ho vede jeho syn.',
      items: [
        { name: 'Petr Kalous', role: 'majitel', image: 'owner', text: 'Vyučený nástrojař, za pultem od roku 1996. Dělá klíče, brousí a pozná závit po hmatu.' },
        { name: 'Hana Dvořáková', role: 'prodavačka', image: 'assistant', text: 'U nás od roku 2008. Ví, ve kterém šuplíku co leží. V sobotu ji střídá syn Vojta.' },
      ],
    },
    ask: {
      eyebrow: 'Dotaz / odložení / objednávka',
      heading: 'Máte to? Zeptejte se.',
      formHeading: 'Napište, co sháníte',
      formText: 'Odpovídáme v otevírací době, nejpozději druhý den ráno.',
      voucherLabel: 'Dárkový poukaz',
      voucherValues: '300 / 500 / 1 000 Kč',
      voucherText: 'Na cokoliv v krámě včetně broušení a půjčovny. Vypíšeme na počkání a zabalíme.',
    },
    where: {
      eyebrow: '',
      heading: 'Kde a kdy',
      ways: [
        { icon: 'car', label: 'Autem', title: 'Parkoviště U Staré lípy, 150 m', text: 'První hodina zdarma. Pro těžký nákup zajeďte do dvora z Hřebíkové.' },
        { icon: 'bike', label: 'Na kole', title: 'Stojan na šest kol', text: 'Přímo před výlohou, na dohled od pultu.' },
      ],
    },
  },

  // Na háčku: the pegboard. Warmer and chattier; the rounded rows of services with their icons.
  'na-hacku': {
    settings: { hoursNote: 'O státních svátcích máme zavřeno. V sobotu 5. 12. děláme inventuru a neotevřeme.', register: 'Živnostenský rejstřík MěÚ Chrudim' },
    menu: { picks: 'Na háčku', ask: '' },
    footerMenu: { services: 'Služby a ceník' },
    intro: {
      eyebrow: 'Domácí potřeby a železářství, Chrudim',
      heading: 'Co doma chybí, u nás visí na háčku.',
      text: 'Hrnce, kartáče, nářadí, vruty po jednom a klíče na počkání. Na Cínové ulici od roku 1992. Napište, co sháníte, a my vám to odložíme.',
      phoneNote: '',
    },
    ranges: {
      eyebrow: 'Sortiment',
      heading: 'Šest koutů jednoho krámu',
      text: 'Vedeme věci, které se dají opravit, nabrousit a předat dál. Ke každému koutu pár slov od pana Kalouse a ceny od nejmenší po největší.',
    },
    picks: {
      eyebrow: '',
      heading: 'Tenhle týden na háčku',
      text: 'Co právě dorazilo a pár tipů na dárek. Kupuje se u pultu: napište nebo zavolejte a na tři pracovní dny vám to odložíme.',
      items: picksOf([
        pick('Právě dorazilo', 'new', 'S poklicí, krémový nebo modrý. Skladem.'),
        pick('Poslední 3 kusy', 'last', 'Litinový, se svěrkou na stůl. Na vánoční pečení.'),
        pick('Právě dorazilo', 'new', 'Hvězdy, srdce a kometa. Skladem.'),
        pick('', 'new', 'Skladem. Desetilitrová na objednávku do týdne.'),
        pick('Poslední kus', 'last', 'Červená je poslední, černá skladem.'),
        pick('', 'new', 'Bukové dřevo a žíně. Skladem.'),
        pick('Tip na dárek', 'gift', 'Čtyři barvy. Skladem.'),
        pick('Na objednávku do týdne', 'order', 'Z kovárny v Dolanech, jasanové rukojeti.', 'Objednat'),
        pick('Tip na dárek', 'gift', 'Ta z dětství. Skladem.'),
      ]),
    },
    services: {
      eyebrow: 'Služby u pultu',
      heading: 'Klíč, než zaplatíte',
      text: 'Vzadu za šuplíky je brus a stroj na klíče. Většinu věcí uděláme, než si vyberete vařečku.',
      items: [
        { name: 'Klíče na počkání', text: 'Běžné, dozické i od schránek. Bezpečnostní od 180 Kč, do druhého dne.', price: 'od 60 Kč', icon: 'key-round' },
        { name: 'Broušení nožů a nůžek', text: 'Nůž 50 Kč, nůžky 80 Kč, sekera 120 Kč. Přineste do čtvrtka, v sobotu jsou hotové.', price: 'od 50 Kč', icon: 'scissors' },
        { name: 'Nasazení násad a topůrek', text: 'Sekery, kladiva, rýče a motyky. Cena je za práci, násadu si vyberete u nás.', price: '90 Kč', icon: 'hammer' },
        { name: 'Půjčovna', text: 'Lis na mošt, zavařovací hrnec, vrtací kladivo, čistič koberců. Záloha 1 000 Kč.', price: 'od 150 Kč / den', icon: 'calendar-days' },
        { name: 'Řezání na míru', text: 'Řetězy, lana, závitové tyče a lišty uřízneme na délku, kterou potřebujete.', price: 'v ceně zboží', icon: 'ruler' },
        { name: 'Dovoz po Chrudimi', text: 'Pytle, sudy a všechno, co neunesete. Vozíme v úterý a v pátek odpoledne.', price: '100 Kč', icon: 'truck' },
      ],
    },
    people: {
      eyebrow: 'Za pultem',
      heading: 'Na Cínové od roku 1992',
      text: 'Krám otevřel Václav Kalous v domě, kde se železem obchodovalo už za první republiky. Dnes ho vede jeho syn a šuplíky za pultem jsou pořád ty původní.',
      items: [
        { name: 'Petr Kalous', role: 'majitel, za pultem od roku 1996', image: 'owner', text: 'Vyučený nástrojař. Dělá klíče, brousí a nejvíc ho baví hledat, ke kterému závitu patří přinesený šroubek.' },
        { name: 'Hana Dvořáková', role: 'prodavačka, u nás od roku 2008', image: 'assistant', text: 'Ví, ve kterém šuplíku co leží. Poradí s kuchyní, zavařováním i úklidem. V sobotu ji střídá syn Vojta.' },
      ],
    },
    ask: {
      eyebrow: '',
      heading: 'Máte to skladem? Zeptejte se.',
      formHeading: '',
      formText: '',
      voucherLabel: 'Dárkový poukaz',
      voucherValues: '300, 500 nebo 1 000 Kč',
      voucherValidity: '',
      voucherText: 'Platí rok na cokoliv v krámě včetně broušení a půjčovny. Vypíšeme na počkání a zabalíme.',
    },
    where: {
      eyebrow: 'Kde a kdy',
      heading: 'Šest dní v týdnu na Cínové',
      ways: [
        { icon: 'car', label: 'Autem', title: 'Parkoviště U Staré lípy', text: '150 m, první hodina zdarma. S těžkým nákupem do dvora z Hřebíkové.' },
        { icon: 'bike', label: 'Na kole', title: 'Stojan na šest kol', text: 'Přímo před výlohou, na dohled od pultu.' },
      ],
    },
  },
}
