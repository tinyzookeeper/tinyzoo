// Every Czech text of the Builders and architects template, in one place: the website's own
// words (what is not content: "Plocha", "Stav k", the anchors of the sections) and the demo
// content the seed puts in (with what a look's design words differently: `demoByLook`).
// Another language is a file beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

type Kind = 'new' | 'renovation' | 'extension' | 'roof'

export interface Words extends KitWords {
  /** The monogram's label for screen readers: the way to the top of the page. */
  toTop: (name: string) => string
  openMenu: string
  closeMenu: string
  /** "nebo zavolejte": before the phone number beside the opening's button. */
  orCall: string
  /** The addresses of the sections on a page (`/#realizace`), by block type. */
  anchors: Record<'building' | 'projects' | 'services' | 'process' | 'team' | 'testimonials' | 'enquiry' | 'contact', string>
  /** The kinds of job: as a label ("Novostavba") and as a filter ("Novostavby"). */
  kinds: Record<Kind, { one: string; many: string }>
  all: string
  filterLabel: string
  filterEmpty: string
  /** The construction systems; `short` is the word Výkres sets in a narrow cell. */
  systems: Record<'masonry' | 'timber', { long: string; short: string }>
  /** "3 týdny" */
  weeks: (n: number) => string
  /** "9 měsíců" */
  months: (n: number) => string
  /** "5 let" */
  years: (n: number) => string
  /** The length of a build: in weeks up to eight of them, in months above. */
  buildTime: (weeks: number) => string
  /** "24 fotografií" */
  photos: (n: number) => string
  /** "3 stavby" */
  sites: (n: number) => string
  /** "týden 14 z 38" */
  weekOf: (week: number, of: number) => string
  /** "týden 14" */
  weekNo: (week: number) => string
  /** "z 38", "ze 40" */
  ofTotal: (total: number) => string
  /** "210 m² střechy" for a roof, "112 m²" otherwise */
  areaWith: (area: number, measure: 'usable' | 'roof') => string
  /** "Po předání" */
  afterHandover: string
  /** "Mimo cenu": what is not in the price, as Harmonogram says it. */
  outOfPrice: string
  /** "předáno o 2 týdny dřív" */
  earlier: (weeks: number) => string
  // ── the project's facts
  year: string
  area: Record<'usable' | 'roof', string>
  /** "Plocha" on a card, "Plocha střechy" for a roof. */
  areaShort: Record<'usable' | 'roof', string>
  areaBrick: Record<'usable' | 'roof', string>
  /** "128 m² užitné plochy" */
  areaOf: Record<'usable' | 'roof', string>
  buildLasted: string
  buildShort: string
  system: string
  systemShort: string
  archive: string
  price: string
  priceKey: string
  priceBrick: string
  handedOver: string
  contractTerm: string
  actual: string
  scaleNote: (weeks: number) => string
  fullProject: (photos: number) => string
  // ── the project's page
  backToProjects: string
  parameters: string
  gallery: string
  similar: string
  // ── under construction
  stateOn: string
  handoverByContract: string
  // ── the build
  phases: Record<'before' | 'build' | 'after', string>
  buildTotal: (weeks: number) => string
  weekLabel: (n: number) => string
  readFromBelow: string
  hatches: Record<'masonry' | 'concrete' | 'insulation' | 'timber', string>
  section: string
  // ── services
  stage: string
  kindOfWork: string
  included: string
  excluded: string
  priceFrom: string
  // ── contact
  office: string
  address: string
  openHours: string
  phone: string
  email: string
  regionAria: string
  kmAway: (km: number) => string
  companyId: string
  vatId: string
  // ── the opening
  slotTitle: string
  // ── the enquiry
  consentSeparator: string
  // ── the legal pages
  legalMenu: string
}

const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

// "ze 40", "z 38": Czech says "ze" before a number whose spoken form starts with a cluster of consonants.
const of = (n: number) => ([2, 3, 4, 6, 7].includes(n) || (n >= 40 && n < 50) || (n >= 70 && n < 80) || n >= 100 ? 'ze' : 'z')

export const words: Words = {
  ...KIT_WORDS.cs,
  toTop: (name) => `${name}, na začátek stránky`,
  openMenu: 'Otevřít menu', closeMenu: 'Zavřít menu',
  orCall: 'nebo zavolejte',
  anchors: { building: 'stavime', projects: 'realizace', services: 'sluzby', process: 'postup', team: 'lide', testimonials: 'reference', enquiry: 'poptavka', contact: 'kontakt' },
  kinds: {
    new: { one: 'Novostavba', many: 'Novostavby' },
    renovation: { one: 'Rekonstrukce', many: 'Rekonstrukce' },
    extension: { one: 'Přístavba', many: 'Přístavby' },
    roof: { one: 'Střecha', many: 'Střechy' },
  },
  all: 'Vše',
  filterLabel: 'Filtr podle typu stavby',
  filterEmpty: 'V tomto výběru zatím nic není.',
  systems: { masonry: { long: 'zděný', short: 'zděný' }, timber: { long: 'dřevostavba', short: 'dřevo' } },
  weeks: (n) => `${n} ${plural(n, 'týden', 'týdny', 'týdnů')}`,
  months: (n) => `${n} ${plural(n, 'měsíc', 'měsíce', 'měsíců')}`,
  years: (n) => `${n} ${plural(n, 'rok', 'roky', 'let')}`,
  buildTime: (weeks) => (weeks <= 8 ? words.weeks(weeks) : words.months(Math.round(weeks / 4.33))),
  photos: (n) => `${n} ${plural(n, 'fotografie', 'fotografie', 'fotografií')}`,
  sites: (n) => `${n} ${plural(n, 'stavba', 'stavby', 'staveb')}`,
  weekOf: (week, total) => `týden ${week} ${of(total)} ${total}`,
  weekNo: (week) => `týden ${week}`,
  ofTotal: (total) => `${of(total)} ${total}`,
  areaWith: (area, measure) => `${area} m²${measure === 'roof' ? ' střechy' : ''}`,
  afterHandover: 'Po předání',
  outOfPrice: 'Mimo cenu',
  earlier: (n) => `předáno o ${n} ${plural(n, 'týden', 'týdny', 'týdnů')} dřív`,
  year: 'Rok dokončení',
  area: { usable: 'Užitná plocha', roof: 'Plocha střechy' },
  areaShort: { usable: 'Plocha', roof: 'Plocha střechy' },
  areaBrick: { usable: 'užitná plocha', roof: 'plocha střechy' },
  areaOf: { usable: 'užitné plochy', roof: 'plochy střechy' },
  buildLasted: 'Stavba trvala', buildShort: 'Stavba',
  system: 'Konstrukční systém', systemShort: 'Systém', archive: 'Archiv', price: 'Cena na klíč', priceKey: 'Cena', priceBrick: 'na klíč',
  handedOver: 'předáno',
  contractTerm: 'Termín ve smlouvě', actual: 'Skutečnost',
  scaleNote: (weeks) => `Stupnice u každé stavby: ${weeks} týdnů, dílek = 1 týden.`,
  fullProject: (n) => `Celá realizace, ${words.photos(n)}`,
  backToProjects: 'Všechny realizace',
  parameters: 'Parametry', gallery: 'Fotografie',
  similar: 'Poptat podobnou stavbu',
  stateOn: 'Stav k',
  handoverByContract: 'Předání podle smlouvy',
  phases: { before: 'Před stavbou', build: 'Stavba', after: 'Po stavbě' },
  buildTotal: (weeks) => `Stavba · ${words.weeks(weeks)}`,
  weekLabel: (n) => `${n}. týden`,
  readFromBelow: 'Čtěte odspodu, tak jak se staví',
  hatches: { masonry: 'zdivo', concrete: 'beton', insulation: 'izolace', timber: 'dřevo v řezu' },
  section: 'Schematický řez rodinným domem: základy, zdivo, strop, krov',
  stage: 'Etapa', kindOfWork: 'Druh práce', included: 'V ceně', excluded: 'Není v ceně', priceFrom: 'Cena od',
  office: 'Kancelář', address: 'Adresa', openHours: 'Otevřeno', phone: 'Telefon', email: 'E-mail',
  regionAria: 'Města, kde stavíme, podle vzdálenosti od sídla firmy',
  kmAway: (km) => `${km} km`,
  companyId: 'IČO', vatId: 'DIČ',
  slotTitle: 'Tady může stát ten váš',
  consentSeparator: ' ',
  legalMenu: 'Právní odkazy',
  defaultName: 'Stavební firma',
}

// ── the demo content: the fictional firm Stavby Doubrava of Chotěboř (Vysočina), builder of
//    family houses, renovations and roofs. The people, the phone numbers, the addresses and the
//    figures are invented; the photographs are a series of houses of one May on the highlands.
//    This is Výkres's design: Harmonogram and Zdivo word what differs in `demoByLook` below. ──

/** A service as the demo words it: the lists are plain texts. */
const service = (name: string, text: string, included: string[], excluded: string[], price: string, unit: string) => ({ name, text, included, excluded, price, unit })

const KINDS = ['Dům na klíč', 'Hrubou stavbu', 'Rekonstrukci', 'Přístavbu', 'Střechu', 'Zateplení a fasádu']
const STARTS = ['Na jaře 2027', 'Na podzim 2027', 'V roce 2028', 'Zatím zjišťuji']
const TOWNS: Array<{ name: string; shortName?: string; km: number; seat?: boolean }> = [
  { name: 'Chotěboř', km: 0, seat: true },
  { name: 'Ždírec nad Doubravou', shortName: 'Ždírec n. D.', km: 12 },
  { name: 'Havlíčkův Brod', shortName: 'Havl. Brod', km: 17 },
  { name: 'Přibyslav', km: 22 },
  { name: 'Hlinsko', km: 27 },
  { name: 'Čáslav', km: 31 },
  { name: 'Chrudim', km: 35 },
  { name: 'Žďár nad Sázavou', shortName: 'Žďár n. S.', km: 40 },
]

export const demo = {
  settings: {
    siteName: 'Stavby Doubrava',
    // (numbers no phone has: Czech numbers do not start with 1)
    phone: '123 456 701',
    email: 'info@stavbydoubrava.example',
    street: 'Sokolohradská 842',
    postcode: '583 01',
    town: 'Chotěboř',
    hours: [{ days: 'Po–čt', time: '7.00–16.00' }, { days: 'Pá', time: '7.00–14.00' }],
    hoursShort: 'po–čt 7–16, pá 7–14',
    ctaLabel: 'Poptat nabídku',
    legalName: 'Stavby Doubrava s.r.o.',
    companyId: '12345678',
    vatId: 'CZ12345678',
    registry: 'Zapsáno v obchodním rejstříku u Krajského soudu v Hradci Králové, oddíl C, vložka 24816.',
    metaDescription: 'Stavební firma z Chotěboře. Zděné domy, dřevostavby, rekonstrukce a střechy do 40 km od Chotěboře, s pevnou cenou a termínem ve smlouvě.',
    menuNotes: [{ link: '/#realizace', note: '96 staveb' }, { link: '/#postup', note: '38 týdnů' }],
  },
  home: { title: 'Úvod' },
  // The menu: label and the section it leads to (a key of `words.anchors`).
  menu: [
    { label: 'Realizace', to: 'projects' }, { label: 'Co stavíme', to: 'services' }, { label: 'Jak stavba probíhá', to: 'process' },
    { label: 'Lidé', to: 'team' }, { label: 'Kontakt', to: 'contact' },
  ] as Array<{ label: string; to: keyof Words['anchors'] }>,
  hero: {
    eyebrow: 'Stavební firma · Chotěboř · od roku 2008',
    heading: 'Rodinné domy, rekonstrukce a\u00A0střechy na\u00A0Vysočině',
    lead: '',
    text: 'Stavíme zděné domy i dřevostavby do 40 km od Chotěboře. Zedníky a tesaře máme vlastní, cenu i termín předání píšeme do smlouvy. Ročně předáme šest až osm domů.',
    primaryLabel: 'Poptat nabídku',
    caption: 'Dům ve Ždírci nad Doubravou · novostavba 2022 · 154 m²',
    captionShort: 'Ždírec n. D. · 2022 · 154 m²',
    note: '10 měsíců stavby',
    /** The photograph: a key of seed/photos.ts. */
    photo: 'zdirec' as string,
  },
  facts: {
    heading: '',
    text: '',
    items: [
      { label: 'Záruka', figure: '5 let', text: 'na celé dílo, 10 let na nosné konstrukce a krov.' },
      { label: 'Vlastní čety', figure: '12 lidí', text: 'zedníci, tesaři, pokrývači. Elektřinu a topení dělají tři stálé firmy.' },
      { label: 'Pojištění', figure: '20 mil. Kč', text: 'odpovědnost firmy. Každá stavba má vlastní stavební pojištění.' },
      { label: 'Autorizace', figure: 'ČKAIT', text: 'Ing. Pavel Doubrava, autorizovaný stavitel pro pozemní stavby, č.\u00A00601234.' },
      { label: 'Domů ročně', figure: '6–8', text: 'a kolem dvaceti rekonstrukcí a střech. Víc zakázek nebereme.' },
    ],
    ctaLabel: '',
  },
  projects: {
    eyebrow: '96 domů a 240 rekonstrukcí a střech od roku 2008',
    heading: 'Realizace',
    text: '',
    featuredLabel: 'Vybraná realizace',
    moreHeading: 'Další stavby',
    archiveLabel: 'Projít archiv',
    archiveTitle: 'Všech 96 domů\na 240 rekonstrukcí',
    figure: '',
    figureText: '',
  },
  archive: {
    title: 'Všechny realizace',
    heading: 'Všechny realizace',
    text: 'Stavby, které jsme od roku 2008 předali. Každá má svou stránku s parametry a fotografiemi.',
    moreHeading: '',
  },
  // The project the home page shows large: its words per look (the summary, and the captions of the photographs).
  libice: {
    summary: 'Přízemní dům pro rodinu se dvěma dětmi na mírně svažitém pozemku. Základová deska na pasech, broušená cihla 44 cm bez zateplení, sedlová střecha, podlahové topení s tepelným čerpadlem. Začali jsme v březnu, klíče jsme předali 5. prosince: dva týdny před termínem ze smlouvy.',
    // The photographs in their order: a key of seed/photos.ts and the caption.
    photos: [
      { photo: 'libice', caption: '' },
      { photo: 'libiceInterior', caption: 'Obývací pokoj s kuchyní, prosinec 2025' },
      { photo: 'krov', caption: 'Krov s glajchou, červen 2025' },
    ],
  },
  // The other finished projects: a short text of each, for its page.
  projectTexts: {
    krucemburk: 'Dvoupodlažní dřevostavba s modřínovým obkladem, který časem zešedne. Stěny vyrostly z dřevěného skeletu za šest měsíců.',
    sobinov: 'Stará chalupa s kamenným soklem, nová okna, omítky a střecha z pálených tašek. Po odkrytí stropů jsme vyměnili trámy a cenu nejdřív odsouhlasili.',
    pribyslav: 'Dům z třicátých let dostal nový krov, pálenou krytinu, žlaby a dvě střešní okna. Střechu jsme stihli za čtyři týdny.',
    brod: 'Přízemní přístavba z dřevěného skeletu s tmavým obkladem a velkým prosklením do zahrady. Ke starému domu ji napojili za dva týdny.',
    zdirec: 'Dvoupodlažní dům se sedlovou střechou, garáží obloženou dřevem a markýzou nad vchodem. Dostavěli jsme ho za deset měsíců.',
  },
  services: {
    eyebrow: '',
    heading: 'Co stavíme a\u00A0co je v\u00A0ceně',
    text: 'Nejvíc sporů na stavbách vzniká z toho, co si kdo myslel, že v ceně je. Proto to píšeme rovnou sem a pak ještě jednou, po položkách, do nabídky.',
    note: 'Ceny jsou bez DPH a platí pro rok 2026. Přesnou cenu dostanete v položkové nabídce.',
    items: [
      service('Dům na klíč', 'Od základové desky po kolaudaci. Stěhujete se do hotového domu s koupelnami, podlahami a fasádou.',
        ['základy a hrubá stavba', 'střecha, okna a dveře', 'rozvody, topení, koupelny', 'omítky, podlahy, fasáda', 'kolaudace a dokumentace'],
        ['projekt a stavební povolení', 'kuchyňská linka a nábytek', 'přípojky za hranicí pozemku', 'plot a zahrada'], '52 000 Kč', 'za m² užitné plochy'),
      service('Hrubá stavba', 'Pro ty, kdo si vnitřek chtějí dodělat sami nebo po částech. Dům předáme pod střechou.',
        ['základová deska', 'nosné zdivo a příčky', 'stropy a komín', 'krov a krytina', 'na přání okna a vchodové dveře'],
        ['rozvody a topení', 'omítky a podlahy', 'fasáda'], '24 000 Kč', 'za m² užitné plochy'),
      service('Rekonstrukce', 'Starší domy a chalupy, od výměny stropů po celou přestavbu. Než řekneme cenu, dům si prokopeme a proměříme.',
        ['průzkum domu a statika', 'bourání a odvoz suti', 'nové stropy, příčky a podlahy', 'rozvody a omítky', 'sanace vlhkosti'],
        ['restaurátorské práce', 'nábytek a kuchyně'], 'po průzkumu', 'pevná cena za celek'),
      service('Střechy', 'Nové krovy i výměna krytiny na starém domě. Tesaři a pokrývači jsou naši zaměstnanci.',
        ['krov nový nebo opravený', 'bednění, fólie a laťování', 'krytina a klempířské prvky', 'střešní okna a hromosvod'],
        ['fotovoltaika', 'půdní vestavba (děláme ji jako rekonstrukci)'], '2 900 Kč', 'za m² střechy'),
      service('Zateplení a fasády', 'Zateplení starších domů polystyrenem nebo minerální vatou, nové omítky a sokly.',
        ['lešení', 'zateplení stěn a soklu', 'omítka a nátěr', 'parapety a oplechování'],
        ['výměna oken', 'energetický posudek'], '2 400 Kč', 'za m² fasády'),
    ],
  },
  process: {
    eyebrow: '',
    heading: 'Jak stavba probíhá',
    text: 'Dům o 130 m² stavíme 38 týdnů. Před tím počítejte zhruba šest týdnů na nabídku a smlouvu, po předání pět let záruky.',
    totalLabel: 'od výkopů po kolaudaci',
    inspectionEvery: 2,
    inspectionTitle: 'Kontrolní den každých 14 dní.',
    inspectionText: 'Projdeme stavbu spolu, dostanete zápis s fotkami a plán na další dva týdny.',
    paymentsTitle: 'Platíte až po dokončené etapě.',
    paymentsText: 'Žádné zálohy na materiál dopředu, první faktura přijde po základech.',
    steps: [
      { phase: 'before', name: 'První schůzka', text: 'Přijedeme na pozemek nebo k domu, projdeme projekt a řekneme, co půjde a co ne. Zdarma a bez závazku.', duration: 'do 7 dnů od zavolání' },
      { phase: 'before', name: 'Nabídka s pevnou cenou', text: 'Položkový rozpočet podle projektu. Po podpisu se cena nemění, vícepráce jen s vaším písemným souhlasem a předem naceněné.', duration: 'do 3 týdnů' },
      { phase: 'before', name: 'Smlouva o dílo', text: 'Je v ní datum předání, platební kalendář a pokuta 0,05 % z ceny za každý den našeho zpoždění.', duration: '1–2 týdny' },
      { phase: 'build', name: 'Základy', text: 'Výkopy, základové pasy, ležatá kanalizace, deska.', weeks: 3, payment: 10 },
      { phase: 'build', name: 'Hrubá stavba', text: 'Obvodové zdivo, příčky, strop a komín.', weeks: 8, payment: 25 },
      { phase: 'build', name: 'Střecha a okna', text: 'Krov, krytina, klempířské prvky, okna a vchodové dveře. Dům je zavřený.', weeks: 5, payment: 20 },
      { phase: 'build', name: 'Rozvody a omítky', text: 'Elektřina, voda, topení, větrání a vnitřní omítky.', weeks: 8, payment: 15 },
      { phase: 'build', name: 'Podlahy a fasáda', text: 'Podlahové topení, potěry, obklady a dlažby, fasáda, podlahy, dveře.', weeks: 10, payment: 20 },
      { phase: 'build', name: 'Dokončení', text: 'Kompletace, revize, zaměření a kolaudace.', weeks: 4, payment: 10 },
      { phase: 'after', name: 'Předání', text: 'Projdeme dům místnost po místnosti. Dostanete klíče, revize, návody a dokumentaci skutečného provedení.', duration: '1 den' },
      { phase: 'after', name: 'Záruka', text: 'Po první zimě přijedeme na prohlídku sami, bez vyzvání. Když něco nahlásíte, jsme u vás do pěti pracovních dnů. Telefon, na který jste volali při stavbě, platí dál.', duration: '5 let · 10 let na nosné konstrukce a krov' },
    ] as Array<{ phase: 'before' | 'build' | 'after'; name: string; text: string; duration?: string; weeks?: number; payment?: number }>,
  },
  team: {
    eyebrow: '',
    heading: 'Kdo vám bude stavět',
    text: 'Tři lidé, se kterými budete mluvit. A dalších dvanáct, které potkáte na stavbě: šest zedníků, čtyři tesaři a pokrývači, dva klempíři. Všichni jsou naši zaměstnanci.',
    note: '',
    people: [
      { name: 'Ing. Pavel Doubrava', role: 'Majitel, autorizovaný stavitel', text: 'Firmu založil v roce 2008. Každou nabídku počítá sám a je u každého předání.', phone: '123 456 702', quote: '', photo: 'pavel' },
      { name: 'Martin Kříž', role: 'Stavbyvedoucí, novostavby', text: 'Vyučený zedník, u firmy čtrnáct let. Na stavbě je každý den a telefon bere i v sobotu.', phone: '123 456 703', quote: '', photo: 'martin' },
      { name: 'Ing. Lucie Marešová', role: 'Stavbyvedoucí, rekonstrukce a střechy', text: 'Vede rekonstrukce, kde se půlka věcí ukáže až po odkrytí. Každou vícepráci nejdřív nacení.', phone: '123 456 704', quote: '', photo: 'lucie' },
    ],
  },
  testimonials: {
    eyebrow: '',
    heading: 'Co říkají ti, kdo už bydlí',
    items: [
      { text: 'Pan Kříž zvedal telefon i v sobotu. Po každém kontrolním dnu přišel zápis s fotkami a věděli jsme, co se bude dělat další dva týdny.', name: 'Petra a Tomáš Havlíkovi', place: 'Krucemburk', built: 'dřevostavba 2024' },
      { text: 'Po odkrytí stropů se ukázaly shnilé trámy. Paní Marešová poslala do dvou dnů cenu výměny a pokračovalo se, až když jsme ji odsouhlasili.', name: 'Jaroslav Bárta', place: 'Sobíňov', built: 'rekonstrukce chalupy 2023' },
      { text: 'Střechu na domě po rodičích stihli za čtyři týdny, i když dva dny pršelo. Uklizeno po sobě nechali líp, než jsme měli my před nimi.', name: 'Marie Dvořáková', place: 'Přibyslav', built: 'střecha 2025' },
    ],
  },
  enquiry: {
    eyebrow: 'Poptávka',
    heading: 'Napište, co chcete stavět',
    text: 'Schůzka i nabídka jsou zdarma a k ničemu vás nezavazují. Co bude po odeslání:',
    steps: [
      { text: 'Zavolá vám Pavel Doubrava', when: 'do 2 dnů' },
      { text: 'Schůzka na pozemku', when: 'do 7 dnů' },
      { text: 'Nabídka s pevnou cenou', when: 'do 3 týdnů' },
    ],
    callLabel: 'Raději zavoláte?',
    signature: '',
    consent: 'Údaje použijeme jen k vyřízení poptávky.',
    kinds: KINDS,
    starts: STARTS,
  },
  contact: {
    officeEyebrow: '',
    officeHeading: 'Kancelář',
    officeNote: 'Schůzky na pozemku i večer a v sobotu, po domluvě.',
    regionEyebrow: '',
    regionHeading: 'Kde stavíme',
    regionText: 'Do 40 km od Chotěboře. Dál nejezdíme: stavbyvedoucí má být na stavbě každý den, ne jednou týdně.',
    otherPlaces: 'Stavíme i v obcích mezi městy na ose: Libice nad Doubravou, Maleč, Krucemburk, Sobíňov, Golčův Jeníkov, Světlá nad Sázavou, Třemošnice, Nasavrky.',
    rangeKm: 40,
    towns: TOWNS,
    seatNote: 'sídlo firmy',
  },
  // The builds under construction (Harmonogram's "Právě stavíme"): the week each is in is counted from its start, so the seed sets the starts to put them there today.
  building: {
    eyebrow: '',
    heading: 'Právě stavíme',
    text: '',
    items: [
      { name: 'Dům v Maleči', slug: 'dum-v-maleci', kind: 'new', place: 'Maleč', area: 136, weeks: 38, week: 14, stage: 'hrubá stavba', handover: '2027-05-14', photo: 'stavba' },
      { name: 'Statek v Nové Vsi u Chotěboře', slug: 'statek-v-nove-vsi', kind: 'renovation', place: 'Nová Ves u Chotěboře', area: 210, weeks: 40, week: 22, stage: 'rozvody a omítky', handover: '2027-03-26', photo: 'sobinov' },
      { name: 'Střecha v Hlinsku', slug: 'strecha-v-hlinsku', kind: 'roof', place: 'Hlinsko', area: 180, weeks: 4, week: 3, stage: 'krytina a klempíři', handover: '2026-12-04', photo: 'pribyslav' },
    ],
  },
  privacy: {
    title: 'Ochrana osobních údajů',
    intro: 'Tato stránka je ukázka. Nahraďte ji vlastním zněním o tom, jak s údaji z poptávek nakládáte.',
    sections: [
      { heading: 'Jaké údaje zpracováváme', text: 'Z poptávkového formuláře jméno, telefon, e-mail, místo stavby a zprávu, kterou nám napíšete.' },
      { heading: 'K čemu je používáme', text: 'Jen k vyřízení vaší poptávky: zavoláme vám, domluvíme schůzku na pozemku a pošleme nabídku. Nikomu je nepředáváme.' },
      { heading: 'Jak dlouho je uchováváme', text: 'Poptávku, která nevedla ke smlouvě, smažeme do jednoho roku. Na žádost dřív: napište nám na e-mail v zápatí.' },
    ],
  },
  cookies: {
    title: 'Nastavení cookies',
    intro: 'Tato stránka je ukázka. Nahraďte ji vlastním zněním podle toho, co váš web používá.',
    sections: [
      { heading: 'Co ukládáme do prohlížeče', text: 'Web si pamatuje jen to, co potřebuje k provozu. Žádné reklamní cookies nepoužíváme.' },
    ],
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    zdirec: 'Dvoupodlažní dům se sedlovou střechou a dřevem obloženou garáží ve Ždírci nad Doubravou, pohled ze zahrady',
    libice: 'Přízemní dům s bílou omítkou a tmavou sedlovou střechou v Libici nad Doubravou, pohled ze zahrady',
    libiceInterior: 'Obývací pokoj s kuchyní a dubovou podlahou v novém domě',
    krov: 'Nový krov rodinného domu se stromkem ozdobeným pentlemi na hřebeni',
    krucemburk: 'Dřevostavba s modřínovým obkladem v Krucemburku, pohled ze zahrady',
    sobinov: 'Opravená chalupa s bílou omítkou a novou pálenou střechou v Sobíňově, pohled ze zahrady se starou jabloní',
    pribyslav: 'Starší dům s novou střechou z pálených tašek v Přibyslavi',
    brod: 'Přízemní přístavba s tmavým dřevěným obkladem u staršího domu v Havlíčkově Brodě',
    stavba: 'Hrubá stavba rodinného domu z cihelných bloků s lešením, v pozadí vesnice a lesy',
    pavel: 'Ing. Pavel Doubrava, majitel firmy, na stavbě',
    martin: 'Martin Kříž, stavbyvedoucí, na stavbě',
    lucie: 'Ing. Lucie Marešová, stavbyvedoucí, na stavbě',
  },
}

// ── What a look's design words differently from the texts above: a site made in that look gets
//    these (the seed is told the look). Lists are replaced whole. ──

// Harmonogram and Zdivo word the services alike, a little shorter than Výkres.
const shorterServices = (unit: string, restPrice: string) => [
  service('Dům na klíč', 'Od základové desky po kolaudaci. Stěhujete se do hotového.', ['základy a hrubá stavba', 'střecha, okna a dveře', 'rozvody, topení, koupelny', 'omítky, podlahy, fasáda', 'kolaudace a dokumentace'],
    ['projekt a stavební povolení', 'kuchyňská linka a nábytek', 'přípojky za hranicí pozemku', 'plot a zahrada'], 'od 52 000 Kč', unit),
  service('Hrubá stavba', 'Dům pod střechou. Vnitřek si doděláte sami nebo po částech.', ['základová deska', 'nosné zdivo a příčky', 'stropy a komín', 'krov a krytina', 'na přání okna a dveře'],
    ['rozvody a topení', 'omítky a podlahy', 'fasáda'], 'od 24 000 Kč', unit),
  service('Rekonstrukce', 'Starší domy a chalupy, od výměny stropů po celou přestavbu.', ['průzkum domu a statika', 'bourání a odvoz suti', 'nové stropy, příčky, podlahy', 'rozvody a omítky', 'sanace vlhkosti'],
    ['restaurátorské práce', 'nábytek a kuchyně'], restPrice, ''),
  service('Střechy', 'Nové krovy i výměna krytiny. Tesaři a pokrývači jsou naši.', ['krov nový nebo opravený', 'bednění, fólie, laťování', 'krytina a klempířské prvky', 'střešní okna a hromosvod'],
    ['fotovoltaika', 'půdní vestavba (děláme ji jako rekonstrukci)'], 'od 2 900 Kč', unit),
  service('Zateplení a fasády', 'Zateplení starších domů polystyrenem nebo minerální vatou.', ['lešení', 'zateplení stěn a soklu', 'omítka a nátěr', 'parapety a oplechování'],
    ['výměna oken', 'energetický posudek'], 'od 2 400 Kč', unit),
]

// The same three people and testimonials, in Zdivo's first person.
const zdivoServices = shorterServices('za m²', 'pevná cena po průzkumu').map((s, i) => (i === 0
  ? { ...s, text: 'Od základové desky po kolaudaci. Stěhujete se do hotového domu s koupelnami, podlahami a fasádou.' }
  : i === 1 ? { ...s, text: 'Dům pod střechou. Pro ty, kdo si vnitřek chtějí dodělat sami nebo po částech.' }
  : i === 2 ? { ...s, text: 'Starší domy a chalupy, od výměny stropů po celou přestavbu. Než řekneme cenu, dům si prokopeme a proměříme.' }
  : i === 3 ? { ...s, text: 'Nové krovy i výměna krytiny na starém domě. Tesaři a pokrývači jsou naši zaměstnanci.' }
  : { ...s, text: 'Zateplení starších domů polystyrenem nebo minerální vatou, nové omítky a sokly.' }))

export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  harmonogram: {
    settings: { ctaLabel: 'Chci nabídku', menuNotes: [{ link: '/#stavime', note: '3 stavby' }, { link: '/#realizace', note: '96 domů' }] },
    menu: [
      { label: 'Právě stavíme', to: 'building' }, { label: 'Hotovo', to: 'projects' }, { label: 'Harmonogram', to: 'process' },
      { label: 'Co stavíme', to: 'services' }, { label: 'Lidé', to: 'team' }, { label: 'Kontakt', to: 'contact' },
    ],
    hero: {
      heading: 'Dům za *38 týdnů.*',
      lead: 'Datum předání i cenu máte ve smlouvě. Za každý den zpoždění platíme pokutu my.',
      text: 'Stavíme rodinné domy, rekonstrukce a střechy na Vysočině, do 40 km od Chotěboře. Vlastní zedníci a tesaři, šest až osm domů ročně.',
      primaryLabel: 'Chci nabídku s pevnou cenou',
      caption: 'Dům v Maleči · hrubá stavba, 14. týden',
      captionShort: '',
      note: '',
      photo: 'stavba',
    },
    facts: {
      heading: 'Černé na\u00A0bílém.',
      text: 'Na co se ptá každý, kdo se chystá utratit několik milionů. Ptejte se taky, a ne jen nás.',
      items: [
        { label: 'Záruka', figure: '5 let', text: 'na celé dílo, 10 let na nosné konstrukce a krov. Po první zimě přijedeme na prohlídku sami.' },
        { label: 'Pokuta za zpoždění', figure: '0,05 %', text: 'z ceny díla za každý den po termínu. U domu za 6,8 mil. Kč je to 3 400 Kč denně.' },
        { label: 'Vlastní čety', figure: '12 lidí', text: 'zedníci, tesaři, pokrývači a klempíři na naší výplatnici. Elektřinu, vodu a topení dělají tři stálé firmy.' },
        { label: 'Pojištění', figure: '20 mil. Kč', text: 'pojištění odpovědnosti firmy. Každá stavba má navíc vlastní stavebně-montážní pojištění.' },
        { label: 'Domů ročně', figure: '6–8', text: 'a kolem dvaceti rekonstrukcí a střech. Víc nebereme, stavbyvedoucí by na stavbě nebyl každý den.' },
        { label: 'Autorizace', figure: 'ČKAIT', text: 'Ing. Pavel Doubrava, autorizovaný stavitel pro pozemní stavby, číslo autorizace 0601234.' },
      ],
    },
    projects: {
      eyebrow: '96 domů a 240 rekonstrukcí a střech od roku 2008',
      heading: 'Hotovo.',
      featuredLabel: 'Naposledy předáno',
      moreHeading: '',
      archiveLabel: 'Projít všechny stavby',
      archiveTitle: 'Dalších\n91 domů',
    },
    libice: {
      summary: 'Přízemní dům 4+kk pro rodinu se dvěma dětmi. Broušená cihla 44 cm bez zateplení, sedlová střecha, podlahové topení s tepelným čerpadlem.',
      photos: [
        { photo: 'libice', caption: '' },
        { photo: 'krov', caption: 'Týden 14 · krov' },
        { photo: 'libiceInterior', caption: 'Týden 38 · předáno' },
      ],
    },
    services: {
      eyebrow: 'Co stavíme',
      heading: 'Pět druhů práce. U každé, co v ceně je a co není.',
      text: '',
      note: 'Ceny bez DPH, platí pro rok 2026.',
      items: shorterServices('/ m²', 'pevná cena po průzkumu'),
    },
    process: {
      eyebrow: 'Jak stavba probíhá',
      heading: 'Harmonogram dostanete se smlouvou.',
      text: 'Tohle je plán domu o 130 m². Váš bude mít data místo týdnů a každých čtrnáct dní si ho na stavbě projdeme spolu.',
      inspectionTitle: 'Kontrolní dny',
      inspectionText: 'Každých 14 dní na stavbě. Zápis s fotkami do druhého dne.',
      paymentsTitle: 'Platby',
      paymentsText: 'Vždy až po dokončené etapě. Žádné zálohy na materiál.',
      steps: [
        { phase: 'before', name: 'První schůzka', text: 'Přijedeme na pozemek nebo k domu, projdeme projekt a řekneme, co půjde a co ne. Zdarma.', duration: 'do 7 dnů' },
        { phase: 'before', name: 'Nabídka s pevnou cenou', text: 'Položkový rozpočet podle projektu. Po podpisu se cena nemění, vícepráce jen s vaším písemným souhlasem.', duration: 'do 3 týdnů' },
        { phase: 'before', name: 'Smlouva o dílo', text: 'Datum předání, platební kalendář a pokuta 0,05 % z ceny za každý den našeho zpoždění.', duration: '1–2 týdny' },
        { phase: 'build', name: 'Základy', text: 'Výkopy, pasy, ležatá kanalizace, deska.', weeks: 3, payment: 10 },
        { phase: 'build', name: 'Hrubá stavba', text: 'Obvodové zdivo, příčky, strop, komín.', weeks: 8, payment: 25 },
        { phase: 'build', name: 'Střecha a okna', text: 'Krov, krytina, okna, vchodové dveře. Dům je zavřený.', weeks: 5, payment: 20 },
        { phase: 'build', name: 'Rozvody a omítky', text: 'Elektřina, voda, topení, větrání, vnitřní omítky.', weeks: 8, payment: 15 },
        { phase: 'build', name: 'Podlahy a fasáda', text: 'Potěry, obklady, dlažby, fasáda, podlahy, dveře.', weeks: 10, payment: 20 },
        { phase: 'build', name: 'Dokončení', text: 'Kompletace, revize, zaměření, kolaudace.', weeks: 4, payment: 10 },
        { phase: 'after', name: 'Předání', text: 'Projdeme dům místnost po místnosti. Dostanete klíče, revize, návody a dokumentaci skutečného provedení.', duration: '1 den' },
        { phase: 'after', name: 'Záruka', text: 'Pět let na celé dílo, deset na nosné konstrukce a krov. Po první zimě přijedeme na prohlídku sami, bez vyzvání. Když něco nahlásíte, jsme u vás do pěti pracovních dnů.', duration: '5 let' },
      ],
    },
    team: {
      eyebrow: 'Lidé',
      heading: 'Tihle tři berou telefon.',
      text: 'Číslo na svého stavbyvedoucího dostanete při podpisu smlouvy. Dalších dvanáct lidí potkáte na stavbě: šest zedníků, čtyři tesaři a pokrývači, dva klempíři.',
    },
    testimonials: { heading: 'Říkají ti, kdo už bydlí' },
    enquiry: {
      heading: 'Řekněte nám, co chcete stavět.',
      text: '',
      steps: [
        { text: 'Zavolá vám Pavel Doubrava', when: 'do 2 dnů' },
        { text: 'Schůzka na pozemku, zdarma', when: 'do 7 dnů' },
        { text: 'Nabídka s pevnou cenou', when: 'do 3 týdnů' },
      ],
      callLabel: 'Nebo rovnou zavolejte',
    },
    contact: {
      officeEyebrow: 'Kancelář',
      officeHeading: 'Sokolohradská 842, Chotěboř',
      officeNote: 'Na pozemek přijedeme i večer nebo v sobotu, po domluvě. PSČ 583 01.',
      regionEyebrow: 'Kde stavíme',
      regionHeading: 'Do 40 km od Chotěboře. Dál ne.',
      regionText: 'Stavbyvedoucí má být na stavbě každý den, ne jednou týdně. Proto nejezdíme dál než hodinu cesty.',
      otherPlaces: 'A obce mezi nimi: Libice nad Doubravou, Maleč, Krucemburk, Sobíňov, Golčův Jeníkov, Světlá nad Sázavou, Třemošnice, Nasavrky.',
      seatNote: 'sídlo',
    },
  },
  zdivo: {
    settings: { ctaLabel: 'Chci nabídku', menuNotes: [] },
    menu: [
      { label: 'Co už stojí', to: 'projects' }, { label: 'Co děláme', to: 'services' }, { label: 'Jak stavíme', to: 'process' },
      { label: 'Kdo jsme', to: 'team' }, { label: 'Kontakt', to: 'contact' },
    ],
    hero: {
      eyebrow: 'Stavební firma z Chotěboře · od roku 2008',
      heading: 'Postavíme vám dům. Telefon bereme i po kolaudaci.',
      text: 'Rodinné domy, rekonstrukce chalup a střechy na Vysočině, do 40 km od Chotěboře. Je nás patnáct, zedníky a tesaře máme vlastní. Cenu i termín píšeme do smlouvy.',
      primaryLabel: 'Chci nabídku',
      caption: 'Chalupa v Sobíňově, rekonstrukce 2023',
      captionShort: '',
      note: '',
      photo: 'sobinov',
    },
    facts: {
      items: [
        { label: 'Od roku', figure: '2008', text: 'stavíme od roku' },
        { label: 'Dojezd', figure: '40 km', text: 'od Chotěboře, dál nejezdíme' },
        { label: 'Hotovo', figure: '96 domů', text: 'a 240 rekonstrukcí a střech' },
        { label: 'Záruka', figure: '5 let', text: 'záruka na celé dílo' },
        { label: 'Vlastní čety', figure: '12', text: 'vlastních zedníků a tesařů' },
        { label: 'Domů ročně', figure: '6–8', text: 'domů ročně, víc nebereme' },
      ],
      ctaLabel: 'Nabídka do 3 týdnů',
    },
    projects: {
      eyebrow: 'Realizace',
      heading: 'Co už stojí',
      text: 'Nejlepší reference je dům, do kterého se můžete jít podívat. U většiny z nich vám majitelé rádi otevřou.',
      featuredLabel: 'Naposledy jsme předali',
      archiveLabel: 'Všechny stavby',
      archiveTitle: 'Všech 96 domů',
      figure: '96',
      figureText: 'domů jsme předali od roku 2008',
    },
    libice: {
      summary: 'Přízemní dům 4+kk pro rodinu se dvěma dětmi. Broušená cihla 44 cm bez zateplení, sedlová střecha, podlahové topení s tepelným čerpadlem. Začali jsme v březnu, klíče jsme předali 5. prosince: dva týdny před termínem.',
      photos: [
        { photo: 'libice', caption: '' },
        { photo: 'krov', caption: 'Glajcha, červen 2025' },
        { photo: 'libiceInterior', caption: 'Stěhování, prosinec 2025' },
      ],
    },
    services: {
      eyebrow: 'Co děláme',
      heading: 'Pět druhů práce, a co je u každé v ceně',
      text: 'Nejvíc hádek na stavbách je o to, co kdo myslel, že v ceně je. Tak to píšeme sem, a pak ještě po položkách do nabídky.',
      note: 'Ceny jsou bez DPH a platí pro rok 2026.',
      items: zdivoServices,
    },
    process: {
      eyebrow: 'Jak stavíme',
      heading: 'Dům roste odspodu. Postup taky.',
      text: 'Dům o 130 m² stavíme 38 týdnů. Před tím počítejte zhruba šest týdnů na nabídku a smlouvu.',
      inspectionTitle: 'Kontrolní den každých 14 dní.',
      inspectionText: 'Projdeme stavbu spolu. Do druhého dne máte zápis s fotkami a plán na další dva týdny.',
      paymentsTitle: 'Platíte až po dokončené etapě.',
      paymentsText: 'Žádné zálohy na materiál. První faktura přijde, až stojí základy.',
      steps: [
        { phase: 'before', name: 'První schůzka', text: 'Přijedeme na pozemek, projdeme projekt, řekneme, co půjde. Zdarma.', duration: 'do 7 dnů' },
        { phase: 'before', name: 'Nabídka', text: 'Položkový rozpočet s pevnou cenou. Po podpisu se nemění.', duration: 'do 3 týdnů' },
        { phase: 'before', name: 'Smlouva o dílo', text: 'Datum předání, platby a pokuta 0,05 % za každý den zpoždění.', duration: '1–2 týdny' },
        { phase: 'build', name: 'Základy', text: 'Výkopy, pasy, ležatá kanalizace, deska.', weeks: 3, payment: 10 },
        { phase: 'build', name: 'Hrubá stavba', text: 'Obvodové zdivo, příčky, strop, komín.', weeks: 8, payment: 25 },
        { phase: 'build', name: 'Střecha a okna', text: 'Krov, krytina, okna, vchodové dveře. Dům je zavřený.', weeks: 5, payment: 20 },
        { phase: 'build', name: 'Rozvody a omítky', text: 'Elektřina, voda, topení, větrání, vnitřní omítky.', weeks: 8, payment: 15 },
        { phase: 'build', name: 'Podlahy a fasáda', text: 'Potěry, obklady, dlažby, fasáda, podlahy, dveře.', weeks: 10, payment: 20 },
        { phase: 'build', name: 'Dokončení', text: 'Kompletace, revize, zaměření, kolaudace.', weeks: 4, payment: 10 },
        { phase: 'after', name: 'Předání', text: 'Projdeme dům místnost po místnosti. Klíče, revize, návody, dokumentace.', duration: '1 den' },
        { phase: 'after', name: 'Záruka', text: 'Deset let na nosné konstrukce a krov. Po první zimě přijedeme na prohlídku sami.', duration: '5 let' },
      ],
    },
    team: {
      eyebrow: 'Kdo jsme',
      heading: 'Kdo vám bude stavět',
      text: '',
      note: 'A dalších dvanáct, které potkáte na stavbě: šest zedníků, čtyři tesaři a pokrývači, dva klempíři. Všichni jsou naši zaměstnanci.',
      people: [
        { name: 'Ing. Pavel Doubrava', role: 'majitel, autorizovaný stavitel', text: 'Firmu založil v roce 2008. Autorizace ČKAIT č. 0601234 pro pozemní stavby. Firma je pojištěná na 20 mil. Kč a každá stavba má vlastní stavební pojištění.', phone: '123 456 702', quote: 'Každou nabídku počítám sám a na každé předání jezdím osobně. Když se něco pokazí, voláte mně.', photo: 'pavel' },
        { name: 'Martin Kříž', role: 'stavbyvedoucí, novostavby', text: 'Vyučený zedník, u nás čtrnáct let. Na stavbě je každý den a telefon bere i v sobotu.', phone: '123 456 703', quote: '', photo: 'martin' },
        { name: 'Ing. Lucie Marešová', role: 'stavbyvedoucí, rekonstrukce a střechy', text: 'Vede rekonstrukce, kde se půlka věcí ukáže až po odkrytí. Každou vícepráci nejdřív nacení.', phone: '123 456 704', quote: '', photo: 'lucie' },
      ],
    },
    testimonials: { eyebrow: 'Reference', heading: 'Říkají ti, kdo už bydlí' },
    enquiry: {
      heading: 'Napište nám, co chcete stavět',
      text: 'Do dvou pracovních dnů vám zavolám a domluvíme se, kdy přijedu na pozemek. Nabídku s pevnou cenou máte do tří týdnů. Schůzka i nabídka jsou zdarma.',
      steps: [],
      signature: 'Pavel Doubrava',
    },
    contact: {
      officeEyebrow: 'Kancelář',
      officeHeading: 'Kde nás najdete',
      officeNote: 'Na pozemek přijedeme i večer nebo v sobotu, po domluvě.',
      regionEyebrow: 'Kde stavíme',
      regionHeading: 'Do 40 km od Chotěboře',
      regionText: 'Dál nejezdíme. Stavbyvedoucí má být na stavbě každý den, ne jednou týdně.',
      otherPlaces: 'A obce mezi nimi: Libice nad Doubravou, Maleč, Krucemburk, Sobíňov, Golčův Jeníkov, Světlá nad Sázavou, Třemošnice, Nasavrky.',
      seatNote: 'tady sídlíme',
    },
  },
}
