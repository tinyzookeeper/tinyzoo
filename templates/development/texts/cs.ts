// Every Czech text of the Development template, in one place: the website's own words (what is
// not content: "Byt", "Volný", "Mám zájem", the anchors of the sections) and the demo content
// the seed puts in (with what a look's design words differently: `demoByLook`). Another
// language is a file beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

type State = 'free' | 'reserved' | 'sold'
type Orientation = 'J' | 'JV' | 'JZ' | 'V' | 'Z' | 'S' | 'SV' | 'SZ'
type OutdoorKind = 'none' | 'balcony' | 'terrace' | 'garden' | 'loggia'

export interface Words extends KitWords {
  /** The addresses of the sections on a page (`/#cenik`), by block type. */
  anchors: Record<'opening' | 'overview' | 'pricelist' | 'standards' | 'surroundings' | 'progress' | 'gallery' | 'financing' | 'developer' | 'enquiry', string>
  /** The label of the logo, a link to the top: "Starý sad, úvod". */
  toTop: (name: string) => string

  // ── flats ──
  flat: string
  /** "3. NP" */
  floorNp: (floor: number) => string
  groundFloor: string
  states: Record<State, string>
  /** The states as the filter names them: "Volné". */
  stateFilters: Record<State, string>
  /** "rezervace", in the line of a flat in the form's choice. */
  reservedMark: string
  all: string
  outdoor: Record<OutdoorKind, string>
  /** "jihozápad" */
  orientation: Record<Orientation, string>
  /** "Jihozápad" */
  orientationCap: Record<Orientation, string>
  /** When the sun is on the side the flat faces: "odpoledne a večer". */
  sun: Record<Orientation, string>
  /** "sedm je volných", "jeden je volný", "dva jsou volné". */
  freeCount: (n: number) => string
  noneFree: string
  companyId: string
  vatId: string
  /** "z 14 bytů" with "ze" where Czech says it. */
  fromTotal: (total: number) => string
  interested: string
  /** "Mám zájem o byt 2.04", for screen readers. */
  interestedIn: (number: string) => string
  /** "Byt 2.04, 2+kk, 56,1 m², volný" */
  flatLabel: (number: string, layout: string, area: string, state: string) => string

  // ── dates and prices ──
  months: string[]
  /** "v srpnu" */
  monthsIn: string[]
  /** "kolaudace v srpnu 2027" */
  approval: (inMonth: string) => string
  millionCrowns: string
  /** "58 %" */
  percent: (n: number) => string

  // ── forms ──
  unitUnknown: string
  wantsLegend: string
  consentBefore: string
  consentLink: string
  consentAfter: string

  // ── a flat's own page ──
  flatPage: {
    back: string
    facts: string
    floor: string
    layout: string
    area: string
    outdoor: string
    orientation: string
    sun: string
    price: string
    state: string
    plan: string
    planDownload: string
    planByMail: string
    ask: string
    soldNote: string
    otherFlats: string
    pricePending: string
  }

  // ── what only one look writes ──
  modrotisk: {
    elevationLabel: string
    cols: { flat: string; floor: string; layout: string; area: string; outdoor: string; orientation: string; price: string; state: string; ask: string }
    shown: string
    empty: string
    resetFilter: string
    priceValid: (date: string) => string
    standard: string
    walk: string
    car: string
    min: string
    nowUntil: (date: string) => string
    statusAsOf: (date: string) => string
    footer: { developer: string; site: string; sales: string; identity: string; documents: string; pricelist: string; standards: string; asOf: string; sheet: string; ground: string }
  }
  patra: {
    /** The question about the flat, as Patra words it. */
    unitLabel: string
    cols: { flat: string; layout: string; area: string; outdoor: string; orientation: string; price: string; state: string; ask: string }
    shown: string
    squares: string
    squareTitle: (number: string, layout: string, state: string) => string
    floorTable: (floor: number) => string
    emptyFloor: string
    walk: string
    car: string
    min: string
    nowUntil: (date: string) => string
    footer: { developer: string; site: string; sales: string; documents: string; pricelist: string; standards: string; office: string }
  }
  poSlunci: {
    /** The letters and names of the east, south and west on the sun's path. */
    compass: { east: [string, string]; south: [string, string]; west: [string, string] }
    /** "(byty .03)": the flats that face one side. */
    flatsOn: (places: string[]) => string
    floors: string
    plan: { street: string; morning: string; noon: string; evening: string; core: string; floorOf: (floor: number) => string }
    cols: { flat: string; floor: string; layout: string; area: string; outdoor: string; sun: string; price: string; state: string; ask: string }
    seen: string
    empty: string
    showAll: string
    priceValid: (date: string) => string
    walk: string
    car: string
    min: string
    now: string
    until: (date: string) => string
    footer: { developer: string; sales: string; documents: string; pricelist: string; standards: string; office: string }
  }
}

// "ve 14", "z 5": Czech says "ze" before sounds that need it ("ze čtrnácti", "ze šesti", "ze dvou").
const from = (total: number): string => (['2', '3', '4', '6', '7'].includes(String(total).slice(-1)) || (total > 10 && total < 20) ? `ze ${total}` : `z ${total}`)

const NUMBERS = ['nula', 'jeden', 'dva', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět', 'deset', 'jedenáct', 'dvanáct', 'třináct', 'čtrnáct', 'patnáct', 'šestnáct', 'sedmnáct', 'osmnáct', 'devatenáct', 'dvacet']

export const words: Words = {
  ...KIT_WORDS.cs,
  anchors: {
    opening: 'uvod', overview: 'slunce', pricelist: 'cenik', standards: 'standardy', surroundings: 'misto',
    progress: 'stavba', gallery: 'galerie', financing: 'financovani', developer: 'developer', enquiry: 'kontakt',
  },
  toTop: (name) => `${name}, úvod`,

  flat: 'Byt',
  floorNp: (floor) => `${floor}. NP`,
  groundFloor: 'přízemí',
  states: { free: 'Volný', reserved: 'Rezervace', sold: 'Prodáno' },
  stateFilters: { free: 'Volné', reserved: 'Rezervace', sold: 'Prodané' },
  reservedMark: 'rezervace',
  all: 'Vše',
  outdoor: { none: '', balcony: 'balkon', terrace: 'terasa', garden: 'zahrada', loggia: 'lodžie' },
  orientation: { J: 'jih', JV: 'jihovýchod', JZ: 'jihozápad', V: 'východ', Z: 'západ', S: 'sever', SV: 'severovýchod', SZ: 'severozápad' },
  orientationCap: { J: 'Jih', JV: 'Jihovýchod', JZ: 'Jihozápad', V: 'Východ', Z: 'Západ', S: 'Sever', SV: 'Severovýchod', SZ: 'Severozápad' },
  sun: { J: 'celý den', JV: 'ráno a dopoledne', JZ: 'odpoledne a večer', V: 'ráno', Z: 'večer', S: 'bez přímého slunce', SV: 'brzy ráno', SZ: 'podvečer' },
  freeCount: (n) => (n === 1 ? `${NUMBERS[1]} je volný` : n >= 2 && n <= 4 ? `${NUMBERS[n]} jsou volné` : `${NUMBERS[n] ?? n} je volných`),
  noneFree: 'žádný není volný',
  companyId: 'IČO',
  vatId: 'DIČ',
  fromTotal: (total) => ` ${from(total)} ${total === 1 ? 'bytu' : 'bytů'}`,
  interested: 'Mám zájem',
  interestedIn: (number) => `Mám zájem o byt ${number}`,
  flatLabel: (number, layout, area, state) => `Byt ${number}, ${layout}, ${area}, ${state}`,

  months: ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'],
  monthsIn: ['v lednu', 'v únoru', 've březnu', 'v dubnu', 'v květnu', 'v červnu', 'v červenci', 'v srpnu', 'v září', 'v říjnu', 'v listopadu', 'v prosinci'],
  approval: (inMonth) => `kolaudace ${inMonth}`,
  millionCrowns: 'mil. Kč',
  percent: (n) => `${n} %`,

  unitUnknown: 'Ještě nevím, poraďte mi',
  wantsLegend: 'Co pro vás máme udělat',
  consentBefore: 'Odesláním souhlasíte se ',
  consentLink: 'zpracováním osobních údajů',
  consentAfter: ' pro vyřízení dotazu.',

  flatPage: {
    back: 'Zpět na ceník', facts: 'Údaje o bytu', floor: 'Podlaží', layout: 'Dispozice', area: 'Podlahová plocha', outdoor: 'Venkovní plocha',
    orientation: 'Orientace', sun: 'Slunce', price: 'Cena s DPH', state: 'Stav', plan: 'Půdorys', planDownload: 'Půdorys ke stažení',
    planByMail: 'Půdorys a kartu bytu vám pošleme e-mailem.', ask: 'Zeptat se na tento byt', soldNote: 'Tento byt je prodaný.',
    otherFlats: 'Další byty', pricePending: 'cena na dotaz',
  },

  modrotisk: {
    elevationLabel: 'Pohled na dům po podlažích',
    cols: { flat: 'Byt', floor: 'Podlaží', layout: 'Dispozice', area: 'Plocha', outdoor: 'Balkon, terasa, zahrada', orientation: 'Orientace', price: 'Cena s DPH', state: 'Stav', ask: 'Poptat' },
    shown: 'Zobrazeno ',
    empty: 'Tomuto výběru neodpovídá žádný byt. ',
    resetFilter: 'Zrušit filtr',
    priceValid: (date) => `Ceník platí k ${date}.`,
    standard: 'S',
    walk: 'Pěšky', car: 'Autem', min: 'min',
    nowUntil: (date) => `Teď · do ${date}`,
    statusAsOf: (date) => `Stav k ${date}`,
    footer: { developer: 'Investor a zhotovitel', site: 'Adresa stavby', sales: 'Prodej', identity: 'Identifikace', documents: 'Dokumenty', pricelist: 'Ceník ke stažení (PDF)', standards: 'Standardy (PDF)', asOf: 'Stav k datu', sheet: 'list 01 z 01', ground: 'přízemí' },
  },
  patra: {
    unitLabel: 'Který byt',
    cols: { flat: 'Byt', layout: 'Dispozice', area: 'Plocha', outdoor: 'Balkon, terasa, zahrada', orientation: 'Orientace', price: 'Cena s DPH', state: 'Stav', ask: 'Poptat' },
    shown: 'Zobrazeno ',
    squares: 'Byty podle stavu',
    squareTitle: (number, layout, state) => `Byt ${number} · ${layout} · ${state}`,
    floorTable: (floor) => `Byty ve ${floor}. nadzemním podlaží`,
    emptyFloor: 'V tomto patře výběru nic neodpovídá.',
    walk: 'Pěšky', car: 'Autem', min: 'min',
    nowUntil: (date) => `Teď · do ${date}`,
    footer: { developer: 'Investor a zhotovitel', site: 'Adresa stavby', sales: 'Prodej', documents: 'Ke stažení', pricelist: 'Ceník (PDF)', standards: 'Standardy (PDF)', office: 'kancelář na stavbě,' },
  },
  poSlunci: {
    compass: { east: ['V', 'východ'], south: ['J', 'jih'], west: ['Z', 'západ'] },
    flatsOn: (places) => `(byty ${places.join(', ')})`,
    floors: 'Podlaží',
    plan: { street: 'S', morning: 'ráno', noon: 'v poledne', evening: 'večer', core: 'schodiště a výtah', floorOf: (floor) => `${floor}. NP` },
    cols: { flat: 'Byt', floor: 'Patro', layout: 'Dispozice', area: 'Plocha', outdoor: 'Venku', sun: 'Slunce', price: 'Cena s DPH', state: 'Stav', ask: 'Poptat' },
    seen: 'Vidíte ',
    empty: 'Takový byt v domě teď není. ',
    showAll: 'Ukázat všechny',
    priceValid: (date) => `Ceník platí k ${date}.`,
    walk: 'Pěšky od domu', car: 'Autem', min: 'min',
    now: 'právě teď',
    until: (date) => `do ${date}`,
    footer: { developer: 'Investor a zhotovitel', sales: 'Stavba a prodej', documents: 'Ke stažení', pricelist: 'Ceník (PDF)', standards: 'Standardy (PDF)', office: 'kancelář' },
  },
  defaultName: 'Nový projekt',
}

// ── the demo content: the fictional building Starý sad, fourteen flats on the site of an old
//    orchard in Olomouc-Neředín, built and sold by the family firm Zdráhal & Polách. The street,
//    the people, the firm, the phone numbers and the addresses are invented; the pictures are
//    visualisations and photos made for the demo. Worded as the design of Modrotisk words it. ──
const FLATS: Array<{ number: string; floor: number; layout: '1+kk' | '2+kk' | '3+kk' | '4+kk'; area: number; outdoorKind: 'balcony' | 'terrace' | 'garden'; outdoorArea: number; orientation: 'J' | 'JV' | 'JZ' | 'SZ'; price: number | null; state: State }> = [
  { number: '4.01', floor: 4, layout: '3+kk', area: 84.6, outdoorKind: 'terrace', outdoorArea: 34, orientation: 'JZ', price: 9450000, state: 'free' },
  { number: '4.02', floor: 4, layout: '4+kk', area: 104.9, outdoorKind: 'terrace', outdoorArea: 48, orientation: 'JV', price: 11900000, state: 'sold' },
  { number: '3.01', floor: 3, layout: '2+kk', area: 54.2, outdoorKind: 'balcony', outdoorArea: 6.8, orientation: 'JZ', price: 5590000, state: 'free' },
  { number: '3.02', floor: 3, layout: '1+kk', area: 32.6, outdoorKind: 'balcony', outdoorArea: 4.1, orientation: 'J', price: 3650000, state: 'reserved' },
  { number: '3.03', floor: 3, layout: '3+kk', area: 78.4, outdoorKind: 'balcony', outdoorArea: 9.6, orientation: 'JV', price: 7890000, state: 'sold' },
  { number: '3.04', floor: 3, layout: '2+kk', area: 56.1, outdoorKind: 'balcony', outdoorArea: 6.8, orientation: 'SZ', price: 5390000, state: 'free' },
  { number: '2.01', floor: 2, layout: '2+kk', area: 54.2, outdoorKind: 'balcony', outdoorArea: 6.8, orientation: 'JZ', price: 5390000, state: 'sold' },
  { number: '2.02', floor: 2, layout: '1+kk', area: 32.6, outdoorKind: 'balcony', outdoorArea: 4.1, orientation: 'J', price: 3490000, state: 'sold' },
  { number: '2.03', floor: 2, layout: '3+kk', area: 78.4, outdoorKind: 'balcony', outdoorArea: 9.6, orientation: 'JV', price: 7690000, state: 'free' },
  { number: '2.04', floor: 2, layout: '2+kk', area: 56.1, outdoorKind: 'balcony', outdoorArea: 6.8, orientation: 'SZ', price: 5190000, state: 'free' },
  { number: '1.01', floor: 1, layout: '2+kk', area: 54.2, outdoorKind: 'garden', outdoorArea: 38, orientation: 'JZ', price: 5490000, state: 'sold' },
  { number: '1.02', floor: 1, layout: '1+kk', area: 32.6, outdoorKind: 'garden', outdoorArea: 19, orientation: 'J', price: 3590000, state: 'free' },
  { number: '1.03', floor: 1, layout: '3+kk', area: 78.4, outdoorKind: 'garden', outdoorArea: 62, orientation: 'JV', price: 7990000, state: 'reserved' },
  { number: '1.04', floor: 1, layout: '2+kk', area: 56.1, outdoorKind: 'garden', outdoorArea: 27, orientation: 'SZ', price: 5290000, state: 'free' },
]

export const demo = {
  settings: {
    siteName: 'Starý sad',
    tagline: 'Bytový dům · Olomouc',
    address: 'U Starého sadu 4\n779 00 Olomouc-Neředín',
    elevationCaption: 'Pohled jižní, do zahrady · schéma',
    sellerName: 'Mgr. Lucie Ambrožová',
    sellerRole: 'Prodej bytů',
    // (numbers no phone has: Czech numbers do not start with 1)
    phone: '123 456 701',
    email: 'byty@starysad.example',
    officeHours: 'čtvrtek 15–18 h',
    ctaLabel: 'Domluvit prohlídku',
    developerName: 'Zdráhal & Polách stavitelé s.r.o.',
    developerAddress: 'Zahradnická cesta 12, 779 00 Olomouc',
    companyId: '12345678',
    vatId: 'CZ12345678',
    registry: 'C 12345, Krajský soud v Ostravě',
    footerText: 'Bytový dům se 14 byty v Olomouci-Neředíně. Dokončení v říjnu 2027.',
    legalText: 'Vizualizace jsou ilustrativní a mohou se v detailech lišit od skutečného provedení. Informace na webu nejsou nabídkou ve smyslu § 1732 občanského zákoníku. Průkaz energetické náročnosti budovy: třída B. © 2026 Zdráhal & Polách stavitelé s.r.o.',
    metaDescription: 'Bytový dům Starý sad v Olomouci-Neředíně: 14 bytů 1+kk až 4+kk, dokončení v říjnu 2027, ceny od 3 590 000 Kč včetně DPH.',
  },
  // The menu of each design (its desktop links; the phone's panel lists the same).
  menu: {
    pricelist: 'Ceník bytů', standards: 'Standardy', surroundings: 'Místo', progress: 'Stavba', financing: 'Financování', developer: 'Kdo staví', overview: 'Dům a slunce',
    privacy: 'Ochrana osobních údajů',
  },
  menuOrder: ['pricelist', 'standards', 'surroundings', 'progress', 'financing', 'developer'],
  home: {
    title: 'Úvod',
    // The sections of the page in the order of the design (Blueprint draws the building in its price list).
    blocks: ['opening', 'pricelist', 'standards', 'surroundings', 'progress', 'gallery', 'financing', 'developer', 'enquiry'],
  },
  opening: {
    primaryTo: 'pricelist',
    secondaryTo: 'enquiry',
    eyebrow: 'Bytový dům · Olomouc-Neředín',
    // (only By the Sun sets a sentence instead of the name)
    headline: '',
    text: 'Dům o čtyřech podlažích a čtrnácti bytech na místě bývalého ovocného sadu. Na tramvaj čtyři minuty pěšky, do centra jedenáct minut. Stavíme od září 2025, klíče předáme v říjnu 2027.',
    imageCaption: 'Pohled z ulice · Vizualizace',
    primaryLabel: 'Ceník bytů',
    secondaryLabel: 'Prohlídka stavby',
    facts: [
      { kind: 'flats' as const, label: 'Bytů v domě', value: '', note: '' },
      { kind: 'layouts' as const, label: 'Dispozice', value: '', note: '' },
      { kind: 'completion' as const, label: 'Dokončení', value: '', note: '' },
      { kind: 'price' as const, label: 'Ceny od', value: '', note: 'včetně DPH a sklepa' },
    ],
  },
  // (Blueprint draws the building in its price list and has no block of its own for it)
  overview: {
    eyebrow: '',
    heading: 'Sedm ze čtrnácti bytů je volných',
    text: 'Dva jsou rezervované, pět prodaných. Stav k 23. 11. 2026, ceník upravujeme v den podpisu smlouvy.',
    northLabel: 'ulice U Starého sadu',
    southLabel: 'zahrada se starým sadem',
  },
  pricelist: {
    eyebrow: 'Ceník bytů',
    heading: 'Čtrnáct bytů, sedm z nich je volných',
    text: 'Ceny jsou konečné, včetně DPH a sklepní kóje. Garážové stání stojí 390 000 Kč. Kliknutím na byt v pohledu ho najdete v tabulce, půdorys a kartu bytu pošleme e-mailem.',
    note: 'Plochy jsou podlahové plochy bytu podle projektu. Rezervace platí 14 dní od složení rezervačního poplatku 100 000 Kč.',
  },
  standards: {
    eyebrow: 'Standardy',
    heading: 'Z čeho je dům postaven a čím je byt vybaven',
    text: 'Všechno níže je v ceně bytu. Vzorky podlah, obkladů a dveří uvidíte v prodejní kanceláři na stavbě, klientské změny přijímáme do 31. ledna 2027.',
    photos: [{ caption: 'Byt 3+kk, obývací pokoj · Vizualizace' }],
    items: [
      { title: 'Okna', text: 'Dřevohliníková s izolačním trojsklem, Uw 0,74. Na jižní a západní straně venkovní žaluzie na elektrický pohon.', note: '', icon: 'blinds' as const, closing: false },
      { title: 'Podlahy', text: 'V pokojích třívrstvá dubová podlaha, olejovaná. V koupelně a na WC dlažba 60 × 60 cm, na výběr ze šesti dekorů.', note: '', icon: 'layers' as const, closing: false },
      { title: 'Vytápění', text: 'Tepelné čerpadlo země–voda pro celý dům, podlahové topení ve všech místnostech, v létě mírné chlazení stropem.', note: '', icon: 'thermometer-sun' as const, closing: false },
      { title: 'Větrání', text: 'Řízené větrání s rekuperací tepla v každém bytě. Čerstvý vzduch i při zavřených oknech, bez plísní a bez průvanu.', note: '', icon: 'wind' as const, closing: false },
      { title: 'Koupelna', text: 'Sprchový kout se žlabem v podlaze nebo vana, závěsné WC, umyvadlo se skříňkou, baterie v černé nebo chromové barvě.', note: '', icon: 'shower-head' as const, closing: false },
      { title: 'Dveře', text: 'Vstupní bezpečnostní třídy RC3 s požární odolností. Vnitřní dveře výšky 210 cm s obložkovou zárubní.', note: '', icon: 'door-closed' as const, closing: false },
      { title: 'Parkování', text: '16 stání v podzemní garáži s výtahem do všech pater, u každého příprava pro dobíjení elektromobilu. Cena stání 390 000 Kč.', note: '', icon: 'car' as const, closing: false },
      { title: 'Sklep a kola', text: 'Ke každému bytu sklepní kóje 3 až 5 m² v ceně. V přízemí kolárna a kočárkárna se vstupem bez schodů.', note: '', icon: 'bike' as const, closing: false },
      { title: 'Dům', text: 'Zděná stavba z broušených cihel, světlá výška 2,75 m, fasáda z cihelných pásků. Energetická třída B, fotovoltaika na střeše.', note: '', icon: 'house' as const, closing: false },
    ],
  },
  surroundings: {
    eyebrow: 'Místo',
    heading: 'Neředín: klidná ulice, čtyři minuty od tramvaje',
    text: 'Dům stojí v ulici U Starého sadu mezi rodinnými domy z třicátých let. Ze zahrady zůstalo jedenáct původních jabloní a třešní. Školu, obchod i zastávku máte v dochozí vzdálenosti, auto potřebujete až na dálnici.',
    note: 'Tramvají jste na Horním náměstí za 11 minut, ve špičce jezdí každých pět minut.',
    photos: [{ caption: 'Zastávka, 4 min' }, { caption: 'Park, 3 min' }],
    items: [
      { name: 'Park s hřištěm', minutes: 3, mode: 'walk' as const },
      { name: 'Tramvaj 2 a 7', minutes: 4, mode: 'walk' as const },
      { name: 'Supermarket', minutes: 5, mode: 'walk' as const },
      { name: 'Mateřská škola', minutes: 5, mode: 'walk' as const },
      { name: 'Základní škola', minutes: 6, mode: 'walk' as const },
      { name: 'Lékař a lékárna', minutes: 8, mode: 'walk' as const },
      { name: 'Dálnice D35', minutes: 5, mode: 'car' as const },
      { name: 'Fakultní nemocnice', minutes: 6, mode: 'car' as const },
      { name: 'Horní náměstí', minutes: 9, mode: 'car' as const },
      { name: 'Hlavní nádraží', minutes: 12, mode: 'car' as const },
    ],
  },
  progress: {
    eyebrow: 'Harmonogram stavby',
    heading: 'Hrubá stavba stojí, osazujeme okna',
    text: 'Všechny dosavadní termíny jsme dodrželi. Stavbu si můžete prohlédnout každý čtvrtek od 15 hodin, helmu a vestu půjčíme.',
    percentLabel: 'Hotovo z rozpočtu stavby',
    photos: [{ caption: 'Stavba, 14. 11. 2026 · Fotografie' }],
    status: 'Ve 2. a 3. podlaží jsou osazená okna, ve 4. podlaží se montují tento týden. Elektrikáři a instalatéři táhnou rozvody odspodu nahoru.',
    facts: [{ label: 'Vzorový byt 2.03', value: 'od května 2027' }, { label: 'Prohlídky stavby', value: 'čtvrtek 15–18 h' }],
    // The month is when the stage ends; the first stage that is not done is "now".
    items: [
      { date: '2025-02-28T23:00:00Z', title: 'Stavební povolení', done: true },
      { date: '2025-08-31T22:00:00Z', title: 'Zahájení stavby', done: true },
      { date: '2026-01-31T23:00:00Z', title: 'Základy a podzemní garáž', done: true },
      { date: '2026-09-30T22:00:00Z', title: 'Hrubá stavba a střecha', done: true },
      { date: '2027-01-31T23:00:00Z', title: 'Okna, rozvody a omítky', done: false },
      { date: '2027-04-30T22:00:00Z', title: 'Fasáda a podlahy', done: false },
      { date: '2027-07-31T22:00:00Z', title: 'Kolaudace', done: false },
      { date: '2027-09-30T22:00:00Z', title: 'Předání bytů', done: false },
    ],
  },
  gallery: {
    eyebrow: 'Galerie',
    heading: 'Vizualizace a fotografie ze stavby',
    text: 'Fotografie ze stavby přidáváme každý měsíc, vždy po kontrolním dnu.',
    note: 'Vizualizace ukazují dům podle projektu. Zařízení bytů na obrázcích není součástí standardu.',
    // The photographs in the order of the design, and what each is called there.
    order: ['garden', 'detail', 'bathroom', 'terrace', 'windows'],
    captions: { garden: 'Pohled ze zahrady', detail: 'Fasáda', bathroom: 'Koupelna', terrace: 'Terasa bytu 4.01', windows: 'Byt 3.01, listopad 2026' },
  },
  financing: {
    eyebrow: 'Financování',
    heading: 'Platíte ve třech krocích, většinu až po kolaudaci',
    text: 'Všechny platby jdou na vázaný účet u banky, která stavbu financuje. Příklad počítáme pro byt 2.04 za 5 190 000 Kč.',
    exampleFlat: '2.04',
    payments: [
      { share: 10, when: 'Při podpisu smlouvy', note: 'Včetně rezervačního poplatku 100 000 Kč.' },
      { share: 20, when: 'Po dokončení hrubé stavby', note: 'Hrubá stavba je hotová, splatné do 30 dnů od smlouvy.' },
      { share: 70, when: 'Po kolaudaci, před předáním bytu', note: 'Obvykle z hypotéky. Banka ji čerpá až proti zápisu vlastnictví do katastru.' },
    ],
    advisorLabel: 'Hypoteční poradce',
    advisorLead: 'Hypotéku s vámi projde Ing. Radim Vychodil.',
    advisorText: 'Porovná nabídky šesti bank a spočítá splátku pro konkrétní byt.',
    advisorNote: 'Konzultace je zdarma a nezávazná.',
    advisorPhone: '123 456 702',
    advisorEmail: 'hypoteky@starysad.example',
  },
  developer: {
    eyebrow: 'Kdo staví',
    heading: 'Zdráhal & Polách stavitelé, Olomouc',
    text: 'Rodinná stavební firma, v Olomouci stavíme od roku 2008. Starý sad je náš pátý bytový dům. Jsme investor i dodavatel stavby, takže za dům ručí jedna firma a jedni lidé, se kterými se potkáte na stavbě.',
    imageCaption: 'Hejčínské louky, dokončeno 2023 · Fotografie',
    listLabel: 'Dokončené projekty',
    note: 'Architekt: Kubíček Navrátil architekti, Olomouc. Do kteréhokoli z dokončených domů vás po domluvě vezmeme.',
    items: [
      { year: 2023, name: 'Bytový dům Hejčínské louky', size: '31 bytů' },
      { year: 2021, name: 'Řadové domy Slavonín', size: '9 domů' },
      { year: 2019, name: 'Bytový dům Na Šibeníku', size: '22 bytů' },
      { year: 2016, name: 'Bytový dům Dvořákova', size: '18 bytů' },
      { year: 2012, name: 'Bytový dům Řepčínská', size: '12 bytů' },
    ],
  },
  enquiry: {
    eyebrow: 'Dotaz a prohlídka',
    heading: 'Zeptejte se na byt nebo si domluvte prohlídku',
    text: 'Odpovíme do druhého pracovního dne. Pošleme půdorys, kartu bytu a návrh smlouvy, na stavbě vám ukážeme přímo váš byt.',
    office: [
      { label: 'Prodejní kancelář', value: 'na stavbě, U Starého sadu 4, Olomouc-Neředín' },
      { label: 'Otevřeno', value: 'čtvrtek 15–18 h, jinak po domluvě' },
    ],
    wants: ['Domluvit prohlídku stavby', 'Poslat půdorys a kartu bytu', 'Spočítat hypotéku', 'Zavolat zpět'],
  },
  floors: [
    { number: 4, level: '+9,300', note: 'Dva byty s terasou' },
    { number: 3, level: '+6,200', note: 'Čtyři byty s balkonem' },
    { number: 2, level: '+3,100', note: 'Čtyři byty s balkonem' },
    { number: 1, level: '±0,000', note: 'Čtyři byty se zahradou' },
  ],
  // A few words on the page of some flats.
  flatNotes: {
    '4.01': 'Střešní terasa o ploše 34 m² s výhledem přes sad a střechy Neředína. Ložnice a pracovna jsou otočené do ticha, obývací pokoj k jihozápadu.',
    '3.02': 'Nejmenší byt v domě, praktický pro jednoho nebo dva. Balkon na jih, kuchyňský kout otevřený do pokoje.',
    '2.03': 'Vzorový byt otevřeme v květnu 2027. Obývací pokoj s kuchyní se dvěma okny na jihovýchod, dvě oddělené ložnice.',
    '2.04': 'Příklad, podle kterého počítáme splátky. Dvě ložnice, balkon na severozápad, od odpoledne do podvečera slunce v obýváku.',
    '1.02': 'Přízemní byt s vlastní zahradou o ploše 19 m², živým plotem z habru a vchodem přímo z ulice.',
  } as Record<string, string>,
  privacy: {
    title: 'Ochrana osobních údajů',
    intro: 'Ukázkový text. Před zveřejněním popište, jak s údaji zájemců nakládáte vy.',
    parts: [
      { heading: 'Jaké údaje zpracováváme', text: 'Z formuláře máme vaše jméno, telefon, e-mail, byt, na který se ptáte, a zprávu. Při uzavření rezervační smlouvy zpracováváme i údaje, které smlouva vyžaduje.' },
      { heading: 'Proč údaje potřebujeme', items: ['abychom vám odpověděli a poslali půdorys', 'abychom s vámi domluvili prohlídku stavby', 'abychom s vámi uzavřeli rezervační a kupní smlouvu'] },
      { heading: 'Jak dlouho je uchováváme', text: 'Pokud byt nekoupíte, dotaz do roku smažeme. Smlouvy uchováváme po dobu, kterou předepisuje zákon.' },
    ],
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    street: 'Čtyřpodlažní bytový dům Starý sad s cihelným obkladem, balkony a ustupujícím horním patrem, pohled z ulice',
    garden: 'Dům ze strany zahrady se starými ovocnými stromy a lavičkou',
    detail: 'Nároží domu: cihelné pásky, okna v antracitových rámech a balkony s dřevěným podhledem',
    livingRoom: 'Obývací pokoj s kuchyní: dubová podlaha, bílá kuchyňská linka a francouzské okno na balkon',
    bathroom: 'Koupelna se sprchovým koutem, dubovou skříňkou a kulatým zrcadlem',
    terrace: 'Střešní terasa bytu ve 4. podlaží s výhledem přes střechy na město',
    crane: 'Hrubá stavba čtyřpodlažního domu z cihelných bloků s lešením a věžovým jeřábem',
    windows: 'Hrubá stavba bytu s čerstvě osazeným oknem v antracitovém rámu',
    tram: 'Ulice s tramvajovou tratí a zastávkou pod lipami',
    park: 'Park se vzrostlými stromy, pískovou cestou a dětským hřištěm',
    seller: 'Lucie Ambrožová, prodej bytů',
    reference: 'Dokončený třípodlažní bytový dům s bílou omítkou a modřínovým obkladem',
  },
}

export const FLAT_DATA = FLATS

// What a look's design words differently from the texts above: a site made in that look gets
// these (the seed is told the look). Blueprint is the shared wording; Floors and By the Sun
// each have their own headings, lines, buttons and menu.
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  patra: {
    settings: {
      footerText: '14 bytů v Olomouci-Neředíně, dokončení v říjnu 2027.',
    },
    menu: { pricelist: 'Ceník', standards: 'Standardy', surroundings: 'Místo', progress: 'Stavba', financing: 'Financování', developer: 'Kdo staví' },
    menuOrder: ['pricelist', 'progress', 'standards', 'surroundings', 'financing', 'developer'],
    home: { blocks: ['opening', 'overview', 'pricelist', 'progress', 'standards', 'surroundings', 'gallery', 'financing', 'developer', 'enquiry'] },
    floors: [
      { number: 4, level: '+9,300', note: 'Ustupující patro, dva byty s terasou' },
      { number: 3, level: '+6,200', note: 'Čtyři byty s balkonem' },
      { number: 2, level: '+3,100', note: 'Čtyři byty s balkonem' },
      { number: 1, level: '±0,000', note: 'Přízemí, čtyři byty se zahradou' },
    ],
    opening: {
      eyebrow: 'Bytový dům · Olomouc-Neředín · ve výstavbě',
      text: 'Čtrnáct bytů ve čtyřech patrech, čtyři minuty pěšky od tramvaje. Hrubá stavba stojí, stěhovat se budete v říjnu 2027.',
      imageCaption: 'Pohled z ulice U Starého sadu, vizualizace',
      facts: [
        { kind: 'flats', label: 'Bytů v domě', value: '', note: '' },
        { kind: 'layouts', label: 'Dispozice', value: '', note: '' },
        { kind: 'completion', label: 'Dokončení', value: '', note: '' },
        { kind: 'price', label: 'Ceny od', value: '', note: 's DPH a sklepem' },
      ],
    },
    overview: {
      eyebrow: '',
      heading: 'Sedm ze čtrnácti bytů je volných',
      text: 'Dva jsou rezervované, pět prodaných. Stav k 23. 11. 2026, ceník upravujeme v den podpisu smlouvy.',
    },
    pricelist: {
      eyebrow: 'Ceník bytů',
      heading: 'Patro po patru, od teras po zahrady',
      text: 'Ceny jsou konečné, s DPH a se sklepní kójí. Garážové stání stojí 390 000 Kč. Půdorys a kartu bytu pošleme e-mailem ještě ten den.',
    },
    standards: {
      heading: 'Co je v ceně bytu',
      text: 'Žádné příplatky za to, co do bytu patří. Vzorky uvidíte v kanceláři na stavbě, změny přijímáme do 31. ledna 2027.',
      photos: [{ caption: 'Byt 3+kk, vizualizace' }],
      items: [
        { title: 'Okna', text: 'Dřevohliníková, izolační trojsklo. Na jih a západ venkovní žaluzie na elektrický pohon.', note: '', icon: 'blinds', closing: false },
        { title: 'Podlahy', text: 'Třívrstvý olejovaný dub v pokojích, dlažba 60 × 60 cm v koupelně, šest dekorů na výběr.', note: '', icon: 'layers', closing: false },
        { title: 'Vytápění', text: 'Tepelné čerpadlo země–voda, podlahové topení všude, v létě chlazení stropem. Vlastní měření.', note: '', icon: 'thermometer-sun', closing: false },
        { title: 'Větrání', text: 'Rekuperace v každém bytě: čerstvý vzduch při zavřených oknech, bez plísní.', note: '', icon: 'wind', closing: false },
        { title: 'Koupelna', text: 'Sprcha se žlabem nebo vana, závěsné WC, umyvadlo se skříňkou, černé nebo chromové baterie.', note: '', icon: 'shower-head', closing: false },
        { title: 'Dveře', text: 'Vstupní bezpečnostní RC3, vnitřní 210 cm vysoké s obložkovou zárubní.', note: '', icon: 'door-closed', closing: false },
        { title: 'Sklep a kola', text: 'Sklepní kóje 3 až 5 m² ke každému bytu. Kolárna a kočárkárna v přízemí bez schodů.', note: '', icon: 'bike', closing: false },
        { title: 'Parkování', text: '16 stání v podzemní garáži, výtah do všech pater, příprava na dobíjení elektromobilu.', note: '390 000 Kč', icon: 'car', closing: false },
        { title: 'Dům', text: 'Zděný z broušených cihel, světlá výška 2,75 m, fasáda z cihelných pásků, energetická třída B, fotovoltaika na střeše.', note: '', icon: 'house', closing: true },
      ],
    },
    surroundings: {
      eyebrow: 'Místo',
      heading: 'Neředín: tramvaj za rohem, sad za domem',
      text: 'Ulice U Starého sadu, mezi rodinnými domy z třicátých let. Na zahradě zůstalo jedenáct původních jabloní a třešní.',
      photos: [{ caption: 'Zastávka, 4 minuty pěšky' }, { caption: 'Park, 3 minuty pěšky' }],
    },
    progress: {
      eyebrow: 'Stavba',
      heading: 'Hrubá stavba stojí, teď osazujeme okna',
      text: '',
      percentLabel: 'rozpočtu stavby je prostavěno. Všechny termíny jsme zatím dodrželi.',
      photos: [{ caption: 'Dnes. Stavba 14. listopadu 2026' }, { caption: 'Říjen 2027. Pohled ze zahrady, vizualizace' }],
      status: 'Ve 2. a 3. patře jsou okna osazená, ve 4. se montují tento týden. Stavbu ukazujeme každý čtvrtek od 15 do 18 hodin, helmu a vestu půjčíme. Vzorový byt 2.03 otevřeme v květnu 2027.',
      facts: [],
      items: [
        { date: '2025-02-28T23:00:00Z', title: 'Stavební povolení', done: true },
        { date: '2025-08-31T22:00:00Z', title: 'Zahájení stavby', done: true },
        { date: '2026-01-31T23:00:00Z', title: 'Základy a garáž', done: true },
        { date: '2026-09-30T22:00:00Z', title: 'Hrubá stavba a střecha', done: true },
        { date: '2027-01-31T23:00:00Z', title: 'Okna, rozvody, omítky', done: false },
        { date: '2027-04-30T22:00:00Z', title: 'Fasáda a podlahy', done: false },
        { date: '2027-07-31T22:00:00Z', title: 'Kolaudace', done: false },
        { date: '2027-09-30T22:00:00Z', title: 'Předání bytů', done: false },
      ],
    },
    gallery: {
      order: ['terrace', 'detail', 'bathroom', 'windows'],
      heading: 'Jak bude dům vypadat',
      text: 'Vizualizace podle projektu a fotografie ze stavby. Nové přidáváme každý měsíc po kontrolním dnu.',
      note: '',
      captions: { garden: 'Pohled ze zahrady · vizualizace', detail: 'Fasáda · vizualizace', bathroom: 'Koupelna · vizualizace', terrace: 'Terasa bytu 4.01 · vizualizace', windows: 'Byt 3.01 · stavba, listopad 2026' },
    },
    financing: {
      heading: 'Tři platby, největší až po kolaudaci',
      text: 'Peníze jdou na vázaný účet u banky, která stavbu financuje. Příklad počítáme pro byt 2.04 za 5 190 000 Kč.',
      payments: [
        { share: 10, when: 'Při podpisu smlouvy', note: 'Počítá se do toho rezervační poplatek 100 000 Kč.' },
        { share: 20, when: 'Po dokončení hrubé stavby', note: 'Ta už stojí, platíte do 30 dnů od smlouvy.' },
        { share: 70, when: 'Po kolaudaci, před předáním bytu', note: 'Obvykle z hypotéky, kterou banka čerpá až proti zápisu do katastru.' },
      ],
      advisorNote: 'Zdarma a nezávazně.',
    },
    developer: {
      heading: 'Zdráhal & Polách, pátý bytový dům',
      text: 'Rodinná stavební firma z Olomouce, stavíme od roku 2008. Jsme investor i dodavatel: za dům ručí jedna firma a lidé, které potkáte na stavbě. Architekt: Kubíček Navrátil architekti.',
      imageCaption: 'Hejčínské louky, dokončeno 2023',
      listLabel: 'Co už stojí',
      note: 'Do kteréhokoli z nich vás po domluvě vezmeme.',
    },
    enquiry: {
      heading: 'Který byt chcete vidět?',
      text: 'Napište nebo zavolejte. Odpovíme do druhého pracovního dne, pošleme půdorys a návrh smlouvy a na stavbě vám ukážeme přímo váš byt.',
      office: [{ label: '', value: 'Kancelář na stavbě: U Starého sadu 4, Olomouc-Neředín. Čtvrtek 15–18 h, jinak po domluvě.' }],
      wants: ['Prohlídku stavby', 'Půdorys a kartu bytu', 'Spočítat hypotéku', 'Zavolat zpět'],
    },
  },
  'po-slunci': {
    settings: {
      sellerName: 'Lucie Ambrožová',
      footerText: 'Čtrnáct bytů v Olomouci-Neředíně, kde se slunce dostane do každého. Hotovo v říjnu 2027.',
    },
    menu: { pricelist: 'Ceník bytů', standards: 'Standardy', surroundings: 'Okolí', progress: 'Stavba', financing: 'Financování', developer: 'Kdo staví', overview: 'Dům a slunce', privacy: 'Osobní údaje' },
    menuOrder: ['overview', 'pricelist', 'surroundings', 'standards', 'progress', 'financing'],
    home: { blocks: ['opening', 'overview', 'pricelist', 'surroundings', 'standards', 'gallery', 'progress', 'financing', 'developer', 'enquiry'] },
    opening: {
      primaryTo: 'overview',
      secondaryTo: 'pricelist',
      eyebrow: 'Starý sad, Olomouc-Neředín',
      headline: 'Ráno slunce v kuchyni, večer na balkoně.',
      text: 'Čtrnáct bytů na místě bývalého ovocného sadu. Dům stojí delší stranou k jihu, a tak se slunce dostane do každého z nich. Stěhovat se budete v říjnu 2027.',
      imageCaption: '',
      primaryLabel: 'Vybrat byt podle slunce',
      secondaryLabel: 'Ceník bytů',
      facts: [
        { kind: 'flats', label: 'Bytů', value: '', note: '' },
        { kind: 'layouts', label: 'Dispozice', value: '', note: '' },
        { kind: 'completion', label: 'Hotovo', value: '', note: '' },
        { kind: 'price', label: 'Ceny od', value: '', note: 's DPH a sklepem' },
      ],
    },
    overview: {
      eyebrow: 'Dům a slunce',
      heading: 'Vyberte si, kdy chcete mít doma světlo',
      text: 'Ulice je na severu, zahrada se starými jabloněmi na jihu. Obývací pokoj a balkon má každý byt na slunečné straně, ložnice jsou otočené do klidu.',
    },
    pricelist: {
      eyebrow: 'Ceník bytů',
      heading: 'Sedm bytů ještě čeká na svoje lidi',
      text: 'Ceny jsou konečné, s DPH a se sklepní kójí. Garážové stání stojí 390 000 Kč. Půdorys a kartu bytu vám pošleme e-mailem.',
    },
    standards: {
      heading: 'Co je v bytě, když dostanete klíče',
      text: 'Vzorky podlah, obkladů a dveří si osaháte v kanceláři na stavbě. Změny přijímáme do 31. ledna 2027.',
      photos: [{ caption: 'Byt 3+kk · vizualizace' }, { caption: 'Koupelna · vizualizace' }],
      items: [
        { title: 'Okna', text: 'Dřevohliníková s izolačním trojsklem. Na jih a západ venkovní žaluzie na elektrický pohon, aby slunce v létě nehřálo víc, než chcete.', note: '', icon: 'blinds', closing: false },
        { title: 'Podlahy', text: 'V pokojích třívrstvý olejovaný dub. V koupelně a na WC dlažba 60 × 60 cm, na výběr ze šesti dekorů.', note: '', icon: 'layers', closing: false },
        { title: 'Vytápění', text: 'Tepelné čerpadlo země–voda pro celý dům, podlahové topení ve všech místnostech, v létě mírné chlazení stropem.', note: '', icon: 'thermometer-sun', closing: false },
        { title: 'Větrání', text: 'Rekuperace v každém bytě. Čerstvý vzduch i při zavřených oknech, bez plísní a bez průvanu.', note: '', icon: 'wind', closing: false },
        { title: 'Koupelna', text: 'Sprchový kout se žlabem nebo vana, závěsné WC, umyvadlo se skříňkou, baterie černé nebo chromové.', note: '', icon: 'shower-head', closing: false },
        { title: 'Dveře', text: 'Vstupní bezpečnostní třídy RC3. Vnitřní dveře 210 cm vysoké s obložkovou zárubní.', note: '', icon: 'door-closed', closing: false },
        { title: 'Parkování', text: '16 stání v podzemní garáži s výtahem do všech pater a přípravou na dobíjení. Stání stojí 390 000 Kč.', note: '', icon: 'car', closing: false },
        { title: 'Sklep a kola', text: 'Sklepní kóje 3 až 5 m² ke každému bytu v ceně. Kolárna a kočárkárna v přízemí, bez schodů.', note: '', icon: 'bike', closing: false },
        { title: 'Dům', text: 'zděný z broušených cihel, světlá výška 2,75 m, fasáda z cihelných pásků, energetická třída B, fotovoltaika na střeše.', note: '', icon: 'house', closing: true },
      ],
    },
    surroundings: {
      eyebrow: 'Okolí',
      heading: 'Do školy pěšky, do centra tramvají',
      text: 'Neředín je čtvrť rodinných domů ze třicátých let. Bydlíte v ulici U Starého sadu, kde auta jezdí jen k domům, a přitom jste za jedenáct minut na Horním náměstí.',
      note: '',
      photos: [{ caption: '' }, { caption: '' }],
    },
    progress: {
      eyebrow: 'Stavba',
      heading: 'Hrubá stavba stojí, právě osazujeme okna',
      text: 'Ve 2. a 3. patře už okna jsou, ve 4. se montují tento týden. Všechny termíny jsme zatím dodrželi a z rozpočtu stavby je prostavěno 58 %.',
      percentLabel: '',
      photos: [{ caption: 'Stavba 14. 11. 2026' }],
      status: 'Přijďte se podívat: stavbu ukazujeme každý čtvrtek od 15 do 18 hodin, helmu a vestu půjčíme.',
      facts: [],
      items: [
        { date: '2025-02-28T23:00:00Z', title: 'Stavební povolení', done: true },
        { date: '2025-08-31T22:00:00Z', title: 'Zahájení stavby', done: true },
        { date: '2026-01-31T23:00:00Z', title: 'Základy a podzemní garáž', done: true },
        { date: '2026-09-30T22:00:00Z', title: 'Hrubá stavba a střecha', done: true },
        { date: '2027-01-31T23:00:00Z', title: 'Okna, rozvody a omítky', done: false },
        { date: '2027-04-30T22:00:00Z', title: 'Fasáda, podlahy, vzorový byt', done: false },
        { date: '2027-07-31T22:00:00Z', title: 'Kolaudace', done: false },
        { date: '2027-09-30T22:00:00Z', title: 'Předání bytů', done: false },
      ],
    },
    gallery: {
      order: ['garden', 'detail', 'windows', 'terrace'],
      heading: 'Jak dům vyroste a jak roste teď',
      text: 'Vizualizace podle projektu a fotografie ze stavby. Nové přidáváme každý měsíc.',
      note: '',
      captions: { garden: 'Ze zahrady · vizualizace', detail: 'Fasáda', bathroom: 'Koupelna · vizualizace', terrace: 'Terasa bytu 4.01 · vizualizace', windows: 'Byt 3.01 · 11/2026' },
    },
    financing: {
      heading: 'Většinu platíte, až když je dům hotový',
      payments: [
        { share: 10, when: 'Při podpisu smlouvy', note: 'Počítá se do toho rezervační poplatek 100 000 Kč.' },
        { share: 20, when: 'Po dokončení hrubé stavby', note: 'Ta už stojí, platíte do 30 dnů od smlouvy.' },
        { share: 70, when: 'Po kolaudaci, před předáním bytu', note: 'Obvykle z hypotéky, kterou banka čerpá až proti zápisu do katastru.' },
      ],
      advisorText: 'Porovná nabídky šesti bank a spočítá splátku pro váš byt.',
    },
    developer: {
      heading: 'Zdráhal & Polách, stavitelé z Olomouce',
      text: 'Rodinná stavební firma, stavíme tu od roku 2008 a Starý sad je náš pátý bytový dům. Jsme investor i dodavatel, takže za dům ručí lidé, které potkáte na stavbě. Navrhli ho Kubíček Navrátil architekti.',
      imageCaption: 'Hejčínské louky · hotovo 2023',
      note: 'Do kteréhokoli z nich vás po domluvě vezmeme.',
    },
    enquiry: {
      heading: 'Přijďte se podívat, kam vám bude svítit',
      text: 'Napište nám, o který byt stojíte. Odpovíme do druhého pracovního dne, pošleme půdorys a na stavbě vás zavedeme přímo do vašeho obýváku.',
      office: [{ label: '', value: 'Kancelář na stavbě, U Starého sadu 4, Olomouc-Neředín. Otevřeno ve čtvrtek 15–18 h, jindy po domluvě.' }],
    },
  },
}
