// Every Czech text of the Trades template, in one place: the website's own words (what is not
// content: "Před", "Po", the anchors of the sections) and the demo content the seed puts in.
// Another language is a file beside this one with the same two exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

export interface Words extends KitWords {
  /** The monogram's label for screen readers: the name, as a link to the top of the page. */
  toTop: (name: string) => string
  openMenu: string
  closeMenu: string
  /** "Zavolat 123 456 701" */
  callNumber: (phone: string) => string
  /** The short button on a phone: "Zavolat". */
  call: string
  /** "Telefon zvedáme" before the hours in Mistr's top line. */
  answering: string
  /** "Zvedáme" before the hours in Reflex's phone band. */
  answeringShort: string
  /** "Havárie" before the emergency hours. */
  emergency: string
  /** The call bar of a phone in Reflex: the link to the enquiry. */
  enquiryShort: string
  /** The line above the phone number in Reflex's footer. */
  hoursTitle: string
  before: string
  after: string
  place: string
  finished: string
  tookTime: string
  /** "od" before a price that begins at a figure. */
  from: string
  /** The marking of the home town in the list of towns. */
  base: string
  /** "Všech 7 zakázek" */
  allJobs: (n: number) => string
  /** The small line above the link to all jobs in Reflex. */
  jobsArchive: string
  /** The back link of a job's page. */
  backToJobs: string
  /** The small line above a job's name. */
  jobLabel: string
  /** The footer's headings. */
  footerWeb: string
  footerContactBilling: string
  footerContact: string
  footerBilling: string
  /** "IČO 12345678" */
  companyId: (id: string) => string
  /** The addresses of the sections on a page (`/#cenik`), by block type. */
  anchors: Record<'prices' | 'jobs' | 'steps' | 'about' | 'area' | 'enquiry', string>
}

export const words: Words = {
  ...KIT_WORDS.cs,
  toTop: (name) => `${name}, na začátek stránky`,
  openMenu: 'Otevřít menu', closeMenu: 'Zavřít menu',
  callNumber: (phone) => `Zavolat ${phone}`, call: 'Zavolat',
  answering: 'Telefon zvedáme', answeringShort: 'Zvedáme', emergency: 'Havárie', enquiryShort: 'Poptávka', hoursTitle: 'Telefon',
  before: 'Před', after: 'Po', place: 'Místo', finished: 'Dokončeno', tookTime: 'Trvalo',
  from: 'od', base: 'sídlo',
  allJobs: (n) => `Všech ${n} zakázek`, jobsArchive: 'Archiv zakázek', backToJobs: 'Všechny zakázky', jobLabel: 'Zakázka',
  footerWeb: 'Web', footerContactBilling: 'Kontakt a fakturační údaje', footerContact: 'Kontakt', footerBilling: 'Fakturační údaje',
  companyId: (id) => `IČO ${id}`,
  anchors: { prices: 'cenik', jobs: 'zakazky', steps: 'postup', about: 'o-nas', area: 'oblast', enquiry: 'poptavka' },
  defaultName: 'Řemeslník',
}

// ── the demo content: the fictional plumber and heating engineer Ondřej Jirsák and his crew of
//    three in Nová Paka. The street, the people, the phone numbers and the addresses are
//    invented; the photographs are one November's work and its tools. ──
export const demo = {
  settings: {
    siteName: 'Jirsák',
    trade: 'voda · topení · plyn',
    phone: '123 456 701',
    hoursLine: 'po–pá 7–17, so 8–12',
    hours: [{ days: 'Po–pá', time: '7.00–17.00' }, { days: 'Sobota', time: '8.00–12.00' }],
    emergency: 'denně do 20 hodin',
    email: 'ondrej@jirsak-topeni.example',
    ctaLabel: 'Nezávazná poptávka',
    legalName: 'Ondřej Jirsák',
    address: 'Trubní 412\n509 01 Nová Paka',
    companyId: '12345678',
    register: 'Zapsán v živnostenském rejstříku',
    areaLine: 'Jezdíme po Nové Pace, Jičíně, Hořicích, Lomnici nad Popelkou a vesnicích mezi nimi.',
    footerText: 'Instalatérské a topenářské práce na Novopacku, Jičínsku a Hořicku.',
    metaDescription: 'Instalatér a topenář z Nové Paky. Opravy vody a odpadů, výměny kotlů, radiátory a podlahové topení na Novopacku, Jičínsku a Hořicku. Hodinová sazba 590 Kč, výjezd 350 Kč.',
  },
  menu: { prices: 'Ceník', jobs: 'Zakázky', steps: 'Jak to probíhá', about: 'O nás', area: 'Kam jezdíme' },
  legalLink: 'Zpracování osobních údajů',
  home: { title: 'Úvod' },
  opening: {
    eyebrow: 'Instalatér a topenář · Nová Paka',
    heading: 'Voda, topení a plyn na Novopacku a Jičínsku',
    photo: true,
    text: 'Opravíme kapající baterii, vyměníme kotel a uděláme rozvody v celém domě. Jsme tři, jezdíme do 25 km od Nové Paky a cenu znáte dřív, než začneme.',
    imageCaption: 'Ondřej Jirsák, instalatér a topenář. Vyučený v roce 2003, na vlastní živnost od roku 2011.',
    secondaryLabel: 'Nezávazná poptávka',
    note: '*Telefon zvedáme po–pá 7–17 a v sobotu 8–12.* Havárie, jako je prasklé potrubí, bereme do 20 hodin i o víkendu.',
  },
  facts: [
    { label: 'Hodinová sazba', value: '590 Kč' },
    { label: 'Výjezd do 15 km', value: '350 Kč' },
    { label: 'Prohlídka a nabídka', value: 'zdarma' },
    { label: 'Záruka na práci', value: '24 měsíců' },
  ],
  prices: {
    eyebrow: 'Ceník',
    heading: 'Ceník prací',
    text: 'Orientační ceny za práci včetně DPH. Přesnou cenu dostanete písemně po prohlídce a platí až do předání.',
    includedTitle: 'V ceně je vždy',
    included: ['prohlídka na místě a písemná nabídka', 'drobný materiál: těsnění, konopí, hadičky', 'tlaková zkouška a předávací protokol', 'úklid a odvoz starého zařízení'],
    note: 'U bytů a rodinných domů počítáme sníženou sazbu DPH 12 %.',
    linkLabel: 'Poslat poptávku',
    linkNote: 'Nenašli jste svou práci? Zavolejte, cenu řekneme po telefonu.',
    items: [
      { group: 'Sazby a výjezd', name: 'Hodinová sazba', text: 'Jeden instalatér. Účtujeme po započatých půlhodinách.', price: 590, unit: 'hod', main: true },
      { group: 'Sazby a výjezd', name: 'Výjezd', text: 'Nová Paka a do 15 km. Dál 14 Kč za každý kilometr navíc.', price: 350, main: true },
      { group: 'Sazby a výjezd', name: 'Havarijní výjezd', text: 'Večer do 20 hodin, v neděli a ve svátek. Místo běžného výjezdu.', price: 1200, main: true },
      { group: 'Voda a odpady', name: 'Výměna vodovodní baterie', text: 'Dřezová, umyvadlová i vanová. Baterii přivezeme, nebo namontujeme vaši.', price: 690, from: true },
      { group: 'Voda a odpady', name: 'Oprava nebo výměna WC', text: 'Splachovač, napouštěcí ventil, celé kombi i závěsné WC.', price: 1400, from: true },
      { group: 'Voda a odpady', name: 'Čištění ucpaného odpadu', text: 'Spirálou do 15 metrů. Prohlídka kamerou za 900 Kč.', price: 1200, from: true },
      { group: 'Voda a odpady', name: 'Výměna bojleru', text: 'Demontáž, montáž, zapojení a odvoz starého.', price: 2900, from: true },
      { group: 'Voda a odpady', name: 'Rozvody vody a odpadů v koupelně', text: 'Nové stoupačky a přípojky ke všem zařizovacím předmětům.', price: 19000, from: true },
      { group: 'Topení a plyn', name: 'Roční servis plynového kotle', text: 'Vyčištění, seřízení, měření spalin a zápis do servisní knížky.', price: 1490 },
      { group: 'Topení a plyn', name: 'Výměna radiátoru', text: 'Včetně ventilů a odvzdušnění soustavy.', price: 1800, from: true, unit: 'ks' },
      { group: 'Topení a plyn', name: 'Výměna kotle za kondenzační', text: 'Cena práce. S kotlem a odkouřením obvykle 75 až 120 tisíc Kč.', price: 16000, from: true },
      { group: 'Topení a plyn', name: 'Podlahové topení', text: 'Systémová deska, trubky, rozdělovač a tlaková zkouška.', price: 980, from: true, unit: 'm²' },
    ],
  },
  widePhotoCaption: 'Ondřej Jirsák, úterý ráno v Nové Pace',
  jobs: {
    eyebrow: 'Zakázky',
    heading: 'Dokončené zakázky',
    text: 'Co jsme letos dělali, kde to bylo a jak dlouho to trvalo.',
    count: 5,
    items: [
      { title: 'Výměna plynového kotle za kondenzační', slug: 'vymena-plynoveho-kotle', place: 'Nová Paka', date: '2026-09-30T22:00:00Z', duration: '2 dny', featured: true, text: 'Stacionární kotel z roku 1998 nahradil závěsný kondenzační se zásobníkem na 120 litrů. Nové odkouření do komína, vyvážení soustavy a revize plynu. Rodina byla bez teplé vody jednu noc.' },
      { title: 'Koupelna v panelovém bytě', slug: 'koupelna-v-panelovem-byte', place: 'Jičín', date: '2026-08-31T22:00:00Z', duration: '9 pracovních dnů', featured: true, text: 'Vybourané umakartové jádro, nové rozvody vody a odpadů, sprchový kout místo vany a závěsné WC. Obklady položil náš obkladač.' },
      { title: 'Podlahové topení v novostavbě', slug: 'podlahove-topeni-v-novostavbe', place: 'Lázně Bělohrad', date: '2026-07-31T22:00:00Z', duration: '4 dny', featured: true, text: '128 m² ve dvou podlažích, devět okruhů a dva rozdělovače. Tlakovou zkoušku jsme nechali běžet přes noc, ráno se betonovalo.' },
      { title: 'Nové radiátory na chalupě', slug: 'radiatory-na-chalupe', place: 'Pecka', date: '2026-05-31T22:00:00Z', duration: '3 dny', featured: true, text: 'Šest deskových radiátorů místo litinových, měděné rozvody vedené po zdi a termostatické hlavice. Bez sekání do kamenných zdí.' },
      { title: 'Rozvody pro koupelnu v podkroví', slug: 'rozvody-pro-koupelnu-v-podkrovi', place: 'Hořice', date: '2026-04-30T22:00:00Z', duration: '5 dnů', featured: true, text: 'Voda a odpady vytažené z přízemí do půdní vestavby, předstěnový modul pro závěsné WC a příprava pro obkladače.' },
      { title: 'Radiátor do rodinného domu', slug: 'radiator-do-rodinneho-domu', place: 'Lomnice nad Popelkou', date: '2026-03-31T22:00:00Z', duration: '1 den', featured: false, text: 'Výměna starého radiátoru v obývacím pokoji za deskový s termostatickou hlavicí. Odvzdušnění a vyvážení celé větve.' },
      { title: 'Měděné rozvody pro dům v rekonstrukci', slug: 'medene-rozvody-pro-dum', place: 'Železnice', date: '2026-02-28T23:00:00Z', duration: '6 dnů', featured: false, text: 'Rozvody teplé a studené vody a cirkulace v celém domě. Trubky jsme si připravili v dílně, na místě zbývalo jen spojit.' },
    ],
  },
  steps: {
    eyebrow: 'Postup',
    heading: 'Jak to probíhá',
    text: 'Od prvního telefonu po předání. U běžné opravy stihneme všechny čtyři kroky při jedné návštěvě.',
    items: [
      { title: 'Zavoláte nebo napíšete', text: 'Popíšete, co se děje, a klidně přiložíte fotku. Ozveme se týž den, nejpozději další pracovní den ráno.' },
      { title: 'Prohlídka a nabídka', text: 'Přijedeme se podívat, zdarma. Do tří dnů dostanete písemnou nabídku s rozpisem práce a materiálu.' },
      { title: 'Práce', text: 'V domluvený den a za domluvenou cenu. Když se ve zdi objeví něco navíc, voláme dřív, než to uděláme.' },
      { title: 'Předání a záruka', text: 'Tlaková zkouška, zaškolení k obsluze, protokol a revize. Na práci dáváme záruku 24 měsíců.' },
    ],
  },
  about: {
    eyebrow: 'O nás',
    heading: 'Kdo k vám přijede',
    text: 'Jmenuji se Ondřej Jirsák. Instalatérem jsem se vyučil v roce 2003 v Nové Pace a od roku 2011 pracuji na sebe. Dnes jsme tři: se mnou jezdí Míra Šulc, topenář s třiceti lety praxe, a Standa Erban, který se u nás vyučil.\n\nNa zakázku přijede vždy někdo z nás tří. Subdodavatele si bereme jen na obklady a zednické práce a víte o nich předem.',
    ownerPhoto: false,
    crewCaption: 'Míra Šulc a Standa Erban s radiátorem pro zakázku v Lomnici nad Popelkou.',
    licencesTitle: 'Oprávnění a pojištění',
    licences: ['Výuční list v oboru instalatér, 2003', 'Osvědčení TIČR pro montáž a opravy plynových zařízení', 'Oprávnění k instalaci kotlů a tepelných čerpadel podle zákona o hospodaření energií', 'Pojištění odpovědnosti za škodu do 5 milionů Kč'],
  },
  reviews: {
    eyebrow: 'Recenze',
    heading: 'Co říkají zákazníci',
    count: 3,
    items: [
      { text: 'V sobotu ráno nám praskla hadička pod dřezem. Pan Jirsák přijel do hodiny, za dvacet minut bylo hotovo a účtoval jen výjezd a půl hodiny práce.', name: 'Jana Machová', town: 'Stará Paka' },
      { text: 'Kotel vyměnili za dva dny, jak slíbili. Cena seděla s nabídkou na korunu a kotelnu po sobě uklidili líp, než jsme ji měli my.', name: 'Petr Vaníček', town: 'Nová Paka' },
      { text: 'Koupelnu v paneláku udělali za devět dní. Každé ráno volali, v kolik přijdou, a večer po nich zůstala zametená chodba.', name: 'Lenka Drahoňovská', town: 'Jičín' },
    ],
  },
  area: {
    eyebrow: 'Oblast',
    heading: 'Kam jezdíme',
    text: 'Do 25 km od Nové Paky. Prvních 15 km je v ceně výjezdu, dál počítáme 14 Kč za kilometr. Vesnice mezi vyjmenovanými městy bereme samozřejmě taky.',
    photo: true,
    note: 'Bydlíte o kus dál? U větších zakázek, jako je výměna kotle nebo rozvody v celém domě, jezdíme po domluvě i do Turnova a Dvora Králové.',
    towns: ['Nová Paka', 'Stará Paka', 'Pecka', 'Lázně Bělohrad', 'Lomnice nad Popelkou', 'Jičín', 'Železnice', 'Hořice', 'Miletín', 'Jilemnice', 'Studenec', 'Libštát', 'Košťálov', 'Semily', 'Mlázovice'],
  },
  enquiry: {
    eyebrow: 'Nezávazná poptávka',
    heading: 'Nezávazná poptávka',
    text: 'Napište, co potřebujete, a přiložte fotku: ušetří to jednu cestu. Ozveme se týž den, nejpozději další pracovní den ráno.',
    callLabel: 'Spěchá to? Volejte.',
    note: 'Poptávka vás k ničemu nezavazuje. Údaje použijeme jen k odpovědi.',
  },
  jobsPage: { title: 'Zakázky', slug: 'zakazky', heading: 'Naše zakázky', text: 'Všechno, co jsme letos dokončili: kde to bylo, co se dělalo a jak dlouho to trvalo.' },
  privacy: {
    title: 'Ochrana osobních údajů', slug: 'ochrana-osobnich-udaju',
    intro: 'Ukázkový text. Před zveřejněním popište, jak s údaji zákazníků nakládáte vy.',
    sections: [
      { heading: 'Jaké údaje zpracováváme', text: 'Z poptávkového formuláře máme vaše jméno, telefon, obec a popis práce. Když si práci objednáte, zpracováváme i fakturační údaje.' },
      { heading: 'Proč údaje potřebujeme', items: ['abychom vám mohli odpovědět a domluvit prohlídku', 'abychom s vámi uzavřeli smlouvu a vystavili fakturu', 'abychom splnili záruku na provedenou práci'] },
      { heading: 'Jak dlouho je uchováváme', text: 'Poptávku, ze které se zakázka nestala, smažeme do půl roku. Doklady o provedené práci uchováváme po dobu záruky a dál po dobu, kterou nám ukládá zákon.' },
    ],
  },
  photos: {
    hero: 'Ondřej Jirsák jde s bednou nářadí od bílé dodávky k rodinnému domu',
    portrait: 'Ondřej Jirsák stojí v kotelně u nového závěsného kotle',
    boilerBefore: 'Kotelna před výměnou: starý stacionární plynový kotel a zrezlé trubky',
    boilerAfter: 'Kotelna po výměně: závěsný kondenzační kotel se zásobníkem a měděnými rozvody',
    bathBefore: 'Koupelna v paneláku před rekonstrukcí: umakartové stěny a stará vana',
    bathAfter: 'Koupelna po rekonstrukci: sprchový kout, šedé obklady a závěsné WC',
    floorHeating: 'Rozložené trubky podlahového topení v novostavbě',
    radiator: 'Nový deskový radiátor pod oknem ve staré chalupě',
    attic: 'Rozvody vody a odpadů připravené pro koupelnu v podkroví',
    van: 'Otevřená bílá dodávka s regály plnými tvarovek a trubek',
    crew: 'Dva kolegové nesou nový radiátor brankou k rodinnému domu',
    workshop: 'Pracovní stůl v dílně: měděné trubky a mosazné tvarovky v dřevěných bednách, klíč na trubky a řezák',
  },
}

// What Reflex's design words differently from the texts above (the shared ones are Mistr's):
// a site made in Reflex gets these. Its page also has the photograph across the page and not
// the key figures (seed/index.ts), the owner's portrait only in the about section, and no
// photograph in the opening or the area.
const reflexRates: Record<string, { name?: string; text: string }> = {
  'Hodinová sazba': { name: 'Hodina práce', text: 'Jeden instalatér, po započatých půlhodinách.' },
  'Výjezd': { text: 'Do 15 km od Nové Paky. Dál 14 Kč za kilometr.' },
  'Havarijní výjezd': { text: 'Večer do 20 hodin, v neděli a ve svátek.' },
  'Výměna vodovodní baterie': { text: 'Dřezová, umyvadlová i vanová. Přivezeme ji, nebo namontujeme vaši.' },
}
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  reflex: {
    settings: { register: 'Fyzická osoba zapsaná v živnostenském rejstříku' },
    menu: { steps: 'Postup', area: 'Kam jedeme' },
    opening: {
      eyebrow: 'Instalatér a topenář — Nová Paka, Jičín, Hořice a 25 km okolo',
      heading: 'Teče? Netopí? *Volejte.*',
      text: 'Voda, topení a plyn. Opravy obvykle do druhého dne, havárie hned. Hodina práce 590 Kč, výjezd 350 Kč a cenu znáte dřív, než začneme.',
      photo: false,
    },
    prices: {
      heading: 'Kolik to stojí.',
      text: 'Ceny práce včetně DPH. Přesnou částku dostanete písemně po prohlídce a platí až do předání.',
      included: ['prohlídka a písemná nabídka', 'drobný materiál', 'tlaková zkouška a protokol', 'úklid', 'odvoz starého zařízení'],
      items: demo.prices.items.map((i) => ({ ...i, ...(reflexRates[i.name] ?? {}) })),
    },
    jobs: { heading: 'Hotovo.', text: 'Pět z letošních osmatřiceti zakázek: kde to bylo, co se dělalo a jak dlouho.' },
    steps: { heading: 'Čtyři kroky.' },
    about: { heading: 'Tři lidi, jedna dodávka.', ownerPhoto: true },
    reviews: { heading: 'Říkají o nás.' },
    area: {
      heading: 'Kam jedeme.',
      text: 'Do 25 km od Nové Paky. Prvních 15 km je v ceně výjezdu, dál 14 Kč za kilometr. Vesnice mezi městy bereme taky.',
      photo: false,
    },
    enquiry: {
      heading: 'Napište, co se děje.',
      text: 'Přiložte fotku, ušetří to jednu cestu. Ozveme se týž den, nejpozději další pracovní den ráno.',
      callLabel: 'Spěchá to? Volejte',
      note: 'K ničemu vás nezavazuje. Údaje použijeme jen k odpovědi.',
    },
  },
}
