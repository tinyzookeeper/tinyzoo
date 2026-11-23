// Every Czech text of the Office template, in one place: the website's own words (what is not
// content: "Úřední hodiny", "Problém", the anchors of the sections) and the demo content the
// seed puts in (with what the second look's design words differently: `demoByLook`). Another
// language is a file beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

export interface Words extends KitWords {
  /** The name's label for screen readers: "Tesař & Vondrová, úvodní stránka". */
  toHome: (name: string) => string
  openMenu: string
  closeMenu: string
  /** The days of the week, Monday first: "Po", "pondělí", "po". */
  dayShort: string[]
  dayLong: string[]
  dayLower: string[]
  officeHours: string
  findUs: string
  /** "dnes je pondělí 23. 11. 2026" */
  todayIs: (weekday: string, date: string) => string
  today: string
  tomorrow: string
  /** "za 2 dny", "za 6 dní" */
  inDays: (n: number) => string
  inWeek: string
  /** "trvalo 5 měsíců" */
  took: (duration: string) => string
  problem: string
  whatWeDid: string
  result: string
  theWholeStory: string
  readTheCase: string
  readTheArticle: string
  backToCases: string
  backToArticles: string
  noDeadlines: string
  servicesLabel: string
  /** The shelf's label for screen readers. */
  shelfLabel: string
  /** "Spisová značka C 106542, Krajský soud v Brně" */
  registerLine: (register: string) => string
  companyNumber: string
  vatNumber: string
  companyDetails: string
  office: string
  documents: string
  hoursUnit: string
  /** "Telefon kanceláře 123 456 700, e-mail …" */
  officePhoneIs: string
  emailWord: string
  /** The addresses of the sections on a page (`/#sluzby`), by block type. */
  anchors: Record<'opening' | 'deadlines' | 'services' | 'audience' | 'people' | 'steps' | 'cases' | 'articles' | 'questions' | 'contact', string>
}

export const words: Words = {
  ...KIT_WORDS.cs,
  toHome: (name) => `${name}, úvodní stránka`,
  openMenu: 'Otevřít menu', closeMenu: 'Zavřít menu',
  dayShort: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
  dayLong: ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'],
  dayLower: ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'],
  officeHours: 'Úřední hodiny', findUs: 'Kde nás najdete',
  todayIs: (weekday, date) => `dnes je ${weekday} ${date}`,
  today: 'dnes', tomorrow: 'zítra',
  inDays: (n) => (n < 5 ? `za ${n} dny` : `za ${n} dní`),
  inWeek: 'za týden',
  took: (duration) => `trvalo ${duration}`,
  problem: 'Problém', whatWeDid: 'Co jsme udělali', result: 'Výsledek', theWholeStory: 'Jak to probíhalo',
  readTheCase: 'Celý případ', readTheArticle: 'Číst článek',
  backToCases: 'Další případy', backToArticles: 'Všechny články',
  noDeadlines: 'Nejbližší termíny doplníme.',
  servicesLabel: 'Služby a jejich ceny', shelfLabel: 'Služby a jejich ceny',
  registerLine: (register) => `Spisová značka ${register}`,
  companyNumber: 'IČO', vatNumber: 'DIČ',
  companyDetails: 'Údaje o firmě', office: 'Kancelář', documents: 'Dokumenty',
  hoursUnit: 'h',
  officePhoneIs: 'Telefon kanceláře', emailWord: 'e-mail',
  anchors: {
    opening: 'uvod', deadlines: 'terminy', services: 'sluzby', audience: 'klienti', people: 'lide',
    steps: 'spoluprace', cases: 'pripady', articles: 'clanky', questions: 'otazky', contact: 'kontakt',
  },
  defaultName: 'Kancelář',
}

// ── the demo content: the fictional office Tesař & Vondrová in Jihlava (the street, the people,
//    the phone numbers and the numbers of the company are invented). It is worded as the first
//    look's design words it (Lhůty); `demoByLook` has what the other design words differently. ──
export const demo = {
  settings: {
    siteName: 'Tesař & Vondrová',
    tagline: 'daně · účetnictví · mzdy',
    ctaLabel: 'První konzultace',
    ctaLongLabel: 'Domluvit první konzultaci',
    phone: '123 456 700',
    email: 'kancelar@tvkancelar.example',
    street: 'Vrbová 28',
    zip: '586 01',
    city: 'Jihlava',
    addressNote: 'první patro, zelené dveře vedle průjezdu',
    hours: [
      { day: 'mon' as const, from: '8:00', to: '16:30' },
      { day: 'tue' as const, from: '8:00', to: '16:30' },
      { day: 'wed' as const, from: '8:00', to: '16:30' },
      { day: 'thu' as const, from: '8:00', to: '16:30' },
      { day: 'fri' as const, from: '8:00', to: '13:00' },
    ],
    legalName: 'Tesař & Vondrová, daňová a účetní kancelář s.r.o.',
    about: 'Daňová a účetní kancelář s.r.o. Účetnictví, daně a mzdy pro živnostníky, firmy a spolky z Vysočiny od roku 2009.',
    companyId: '12345678',
    taxId: 'CZ12345678',
    register: 'C 106542, Krajský soud v Brně',
    membership: 'Zapsáni v seznamu Komory daňových poradců ČR: Ing. Radek Tesař, ev. č. 3187, Ing. Hana Vondrová, ev. č. 4520',
    insurance: 'Pojištění odpovědnosti do 10 mil. Kč',
    metaDescription: 'Účetnictví, daně a mzdy pro živnostníky, malé firmy a spolky z Vysočiny. Daňová a účetní kancelář v Jihlavě, první konzultace zdarma.',
  },
  menu: { services: 'Služby a ceny', people: 'Lidé', cases: 'Případy', articles: 'Články', contact: 'Kontakt' },
  home: { title: 'Úvod' },
  opening: {
    eyebrow: 'Daňová a účetní kancelář · Jihlava · od roku 2009',
    heading: 'Účetnictví a daně, které jsou hotové dřív, než přijde termín.',
    text: 'Jsme pět lidí ve Vrbové ulici v Jihlavě. Vedeme účetnictví, mzdy a daně živnostníkům, malým firmám a spolkům z Vysočiny. Daňová evidence od 1 400 Kč, účetnictví od 3 900 Kč měsíčně.',
    primaryLabel: 'Domluvit první konzultaci',
    note: '45 minut s daňovým poradcem,\nzdarma a bez závazku',
    imageCaption: 'První konzultace, zasedací místnost',
    imageCaptionNote: 'Vrbová 28',
  },
  deadlines: {
    heading: 'Nejbližší termíny, které hlídáme za klienty',
    // The seed writes each one this many days after the day it runs, so the ruler is never empty
    // or stale; the last ones are further than the ruler reaches and come into view later.
    items: [
      { days: 2, text: 'Přiznání k DPH a kontrolní hlášení za říjen' },
      { days: 7, text: 'Druhá splátka daně z nemovitých věcí' },
      { days: 22, text: 'Čtvrtletní a pololetní záloha na daň z příjmů' },
      { days: 35, text: 'Přiznání k DPH za listopad' },
      { days: 63, text: 'DPH za prosinec a za čtvrté čtvrtletí' },
      { days: 70, text: 'Přiznání k dani z nemovitých věcí, silniční daň' },
      { days: 105, text: 'Přiznání k dani z příjmů fyzických osob v běžném termínu' },
      { days: 130, text: 'Čtvrtletní zálohy na daň z příjmů právnických osob' },
    ],
  },
  photo: {
    caption: 'Vrbová 28, první patro. Pět lidí, kteří se starají o čísla 123 firem, živnostníků a spolků.',
  },
  services: {
    eyebrow: 'Služby a ceny',
    heading: 'Co děláme a kolik to stojí',
    text: 'Ceny jsou bez DPH. Přesnou částku dostanete písemně po první schůzce a nemění se, dokud se nezmění rozsah práce.',
    groups: [
      { name: 'Účetnictví a mzdy', note: 'Měsíční paušál podle počtu dokladů a zaměstnanců.' },
      { name: 'Daně', note: 'Pevná cena za přiznání, hodinová sazba za poradenství a zastupování.' },
      { name: 'Jednorázově', note: 'Pevná cena, kterou znáte, než začneme.' },
    ],
    items: [
      { group: 0, name: 'Vedení účetnictví', shortName: 'Vedení účetnictví', text: 'Podvojné účetnictví pro s.r.o., spolky a SVJ: doklady, banka, DPH. Do 15. dne v měsíci máte přehled, jak si firma stojí.', price: 'od 3 900 Kč', priceNote: 'měsíčně', spineNote: '' },
      { group: 0, name: 'Daňová evidence pro živnostníky', shortName: 'Daňová evidence', text: 'Příjmy a výdaje, přehledy pro sociální správu a zdravotní pojišťovnu. Doklady stačí vyfotit telefonem a poslat.', price: 'od 1 400 Kč', priceNote: 'měsíčně', spineNote: '' },
      { group: 0, name: 'Mzdy a personalistika', shortName: 'Mzdy a personalistika', text: 'Výplaty, pracovní smlouvy a dohody, přihlášky na pojišťovny, roční zúčtování. Výplatní pásky odcházejí do 8. dne v měsíci.', price: '290 Kč', priceNote: 'za zaměstnance měsíčně', spineNote: 'za osobu' },
      { group: 1, name: 'Daňová přiznání', shortName: 'Daňová přiznání', text: 'Daň z příjmů, DPH, silniční daň, daň z nemovitých věcí. S plnou mocí pro daňového poradce podáváme přiznání až do 1. července.', price: 'od 2 500 Kč', priceNote: 's.r.o. od 9 000 Kč', spineNote: '' },
      { group: 1, name: 'Zastupování při kontrole', shortName: 'Zastupování při kontrole', text: 'Výzva, místní šetření nebo daňová kontrola. Na plnou moc převezmeme veškerou komunikaci s finančním úřadem.', price: '1 600 Kč', priceNote: 'za hodinu', spineNote: 'hodina' },
      { group: 1, name: 'Daňové poradenství', shortName: 'Daňové poradenství', text: 'Prodej firmy nebo nemovitosti, přechod ze živnosti na s.r.o., příjmy ze zahraničí. Odpověď dostanete písemně.', price: '1 600 Kč', priceNote: 'za hodinu, stanovisko od 4 800 Kč', spineNote: 'hodina' },
      { group: 2, name: 'Začátek podnikání', shortName: 'Začátek podnikání', text: 'Živnost, nebo s.r.o.? Paušální daň, nebo evidence? Spočítáme varianty, vyřídíme registrace k daním a nastavíme fakturaci.', price: '6 500 Kč', priceNote: 'pevná cena', spineNote: 'pevně' },
      { group: 2, name: 'Převzetí a rekonstrukce účetnictví', shortName: 'Převzetí účetnictví', text: 'Zpětné zpracování, oprava po předchozí účetní, příprava podkladů pro banku nebo prodej firmy.', price: 'od 12 000 Kč', priceNote: 'odhad předem zdarma', spineNote: '' },
    ],
  },
  audience: {
    eyebrow: '',
    heading: 'Komu vedeme čísla',
    text: 'Většina klientů je z Jihlavy a do čtyřiceti kilometrů kolem. Největší má třicet zaměstnanců, nejmenší vystaví šest faktur za rok.',
    items: [
      { title: 'živnostníků', text: 'Řemeslníci, lékaři, lidé na volné noze. Paušální daň, výdaje procentem i skutečné.', count: '64', from: 'od 1 400 Kč měsíčně' },
      { title: 'malých firem', text: 'Společnosti s ručením omezeným do třiceti zaměstnanců, včetně mezd a DPH.', count: '41', from: 'od 3 900 Kč měsíčně' },
      { title: 'spolků a SVJ', text: 'Účetnictví, vyúčtování dotací, závěrka do sbírky listin a podklady pro shromáždění.', count: '18', from: 'od 1 900 Kč měsíčně' },
      { title: 'rodin a jednotlivců ročně', text: 'Pronájem bytu, prodej nemovitosti, dědictví, příjmy ze zahraničí, slevy na děti.', count: '90', from: 'přiznání od 2 500 Kč' },
    ],
  },
  people: {
    eyebrow: 'Lidé',
    heading: 'Pět lidí. Každý klient má jednoho z nich.',
    text: 'Vaše čísla zná jeden člověk a na toho máte přímý telefon. Když je na dovolené, zastoupí ho kolega, který o vás ví.',
    items: [
      { name: 'Ing. Radek Tesař', role: 'Společník · daňový poradce', text: 'Daň z příjmů firem, daňové kontroly, prodeje a předání firem. Sedm let pracoval na finančním úřadě.', email: 'tesar@tvkancelar.example', phone: '123 456 711', photo: 'radek' },
      { name: 'Ing. Hana Vondrová', role: 'Společnice · daňová poradkyně', text: 'DPH, živnostníci a malé firmy, příjmy ze zahraničí. Vede většinu prvních konzultací.', email: 'vondrova@tvkancelar.example', phone: '123 456 712', photo: 'hana' },
      { name: 'Jitka Malá', role: 'Mzdová účetní', text: 'Mzdy, pracovní smlouvy, pojišťovny a úřad práce. Mzdy dělá dvacet šest let.', email: 'mala@tvkancelar.example', phone: '123 456 713', photo: 'jitka' },
      { name: 'Bc. Petra Šimková', role: 'Hlavní účetní', text: 'Účetnictví s.r.o., roční závěrky, podklady pro banky a dotace.', email: 'simkova@tvkancelar.example', phone: '123 456 714', photo: 'petra' },
      { name: 'Martin Doležal', role: 'Účetní', text: 'Daňová evidence, živnostníci, spolky a SVJ. Naučí vás posílat doklady z telefonu.', email: 'dolezal@tvkancelar.example', phone: '123 456 715', photo: 'martin' },
    ] as Array<{ name: string; role: string; text: string; email: string; phone: string; photo: 'radek' | 'hana' | 'jitka' | 'petra' | 'martin' }>,
  },
  steps: {
    eyebrow: 'Jak začíná spolupráce',
    heading: 'Od prvního telefonátu k prvnímu výkazu',
    items: [
      { label: 'den 0', title: 'Zavoláte nebo napíšete', text: 'Ozveme se nejpozději druhý pracovní den a domluvíme termín schůzky.' },
      { label: 'do týdne', title: 'První konzultace, 45 minut zdarma', text: 'U nás ve Vrbové ulici nebo online. Projdeme, co potřebujete a v jakém stavu jsou podklady.' },
      { label: '+ 3 dny', title: 'Písemná nabídka', text: 'S pevnou měsíční částkou a přesným rozsahem práce. Nezavazuje vás k ničemu.' },
      { label: 'od 1. dne měsíce', title: 'Převezmeme podklady', text: 'S předchozí účetní se domluvíme sami. Od prvního měsíce máte jednoho člověka, který vaše čísla zná.' },
    ],
  },
  cases: {
    eyebrow: 'Případy',
    heading: 'Tři situace z posledního roku',
    text: 'Jména klientů neuvádíme, čísla jsou skutečná. Podobné věci řešíme každý měsíc.',
    items: [
      {
        title: 'Kontrola DPH tři roky zpátky', slug: 'kontrola-dph-tri-roky-zpatky', client: 'truhlářská dílna, 8 zaměstnanců', duration: '5 měsíců',
        problem: 'Dílně přišla výzva, aby prokázala nárok na odpočet DPH za roky 2022 až 2024. Úřad zpochybnil 41 faktur od dvou dodavatelů.',
        solution: 'Převzali jsme zastupování, dohledali dodací listy, fotografie zakázek a platby a předali je úřadu ve dvou podáních.',
        outcome: 'Kontrola skončila bez doměrku. Účtovali jsme 38 hodin práce.',
        body: [
          'Výzvu dílna dostala v polovině března a na odpověď měla třicet dní. Majitel měl faktury, ale ne to, co úřad chtěl vidět: že zboží skutečně dorazilo a že dodavatelé existují.',
          'První dva týdny jsme dohledávali. Dodací listy ležely v kabině dodávky, fotografie hotových zakázek v telefonech truhlářů, platby v bance. Každou z jedenačtyřiceti faktur jsme spárovali s dodáním a platbou a složili do jedné tabulky, kterou úřad snadno přečte.',
          'Podání jsme poslali ve dvou částech a k ústnímu jednání s majitelem šel Radek Tesař. Úřad se po druhém podání spokojil a kontrolu uzavřel.',
        ],
      },
      {
        title: 'Ze živnosti do s.r.o.', slug: 'ze-zivnosti-do-sro', client: 'programátor na volné noze', duration: '3 týdny',
        problem: 'Obrat přesáhl dva miliony korun a klient chtěl přijmout prvního zaměstnance. Nevěděl, jestli má zůstat živnostníkem.',
        solution: 'Spočítali jsme tři varianty na tři roky dopředu, založili společnost, zaregistrovali ji k DPH a nastavili výplatu.',
        outcome: 'Na daních a pojistném platí o 96 000 Kč ročně méně a ručí jen majetkem firmy.',
        body: [
          'Klient pracoval pro tři stálé zákazníky a obrat mu rostl rychleji, než čekal. Zeptal se nás, zda se mu vyplatí zůstat na živnosti, nebo založit společnost.',
          'Porovnali jsme živnost, s.r.o. s výplatou mzdy a s.r.o. s vyplácením podílu na zisku. U každé varianty jsme spočítali daně, pojistné i administrativu na tři roky dopředu a ukázali, kde se výhoda mění v nevýhodu.',
          'Společnost jsme založili za dva týdny, třetí týden zabrala registrace k DPH a nastavení výplaty. Klient dnes posílá doklady z telefonu a o účetnictví se nestará.',
        ],
      },
      {
        title: 'Spolek čtyři roky bez účetnictví', slug: 'spolek-ctyri-roky-bez-ucetnictvi', client: 'sportovní oddíl, 220 členů', duration: '6 týdnů',
        problem: 'Oddíl žádal kraj o dotaci, ale čtyři roky nezveřejnil účetní závěrku a pokladna neseděla s bankou.',
        solution: 'Zpětně jsme zpracovali účetnictví z výpisů a pokladních bloků, podali závěrky a zavedli jednoduchou pokladní knihu.',
        outcome: 'Dotaci 380 000 Kč oddíl dostal v termínu. Účetnictví mu vedeme za 1 900 Kč měsíčně.',
        body: [
          'Výbor oddílu se střídal a každý nový pokladník převzal krabici s doklady a výpisy z banky. Účetní závěrka nebyla zveřejněna čtyři roky, a kraj proto žádost o dotaci nepřijal.',
          'Z bankovních výpisů a pokladních bloků jsme složili účetnictví za všechny čtyři roky, vysvětlili rozdíly mezi pokladnou a bankou a podali chybějící závěrky do sbírky listin.',
          'Pokladní kniha, kterou jsme zavedli, má jednu stránku na měsíc a pokladník ji zvládne vyplnit za deset minut. Žádost o dotaci jsme pak podali s úplnými doklady.',
        ],
      },
    ],
  },
  articlesPage: { title: 'Články', heading: 'Všechny články' },
  articles: {
    eyebrow: 'Články',
    heading: 'Co se mění v daních a účetnictví',
    allLabel: 'Všechny články',
    items: [
      {
        title: 'Minimální zálohy živnostníků v roce 2027: kolik si připravit', slug: 'minimalni-zalohy-zivnostniku-2027', date: '2026-11-12',
        summary: 'Od ledna se znovu zvedají minimální zálohy na sociální i zdravotní pojištění. Spočítali jsme, co to udělá s rozpočtem při hlavní i vedlejší činnosti.',
        body: [
          'Minimální zálohy na pojistné se každý rok přepočítávají z průměrné mzdy. Pro živnostníky to znamená vyšší měsíční platbu už od ledna, a to bez ohledu na to, jak se jim v roce dařilo.',
          'U hlavní činnosti se zvýšení projeví na sociálním i zdravotním pojištění, u vedlejší hlavně na zdravotním. Částky si pro svůj případ vždy ověřte v aktuálních předpisech, v článku uvádíme postup, ne tabulku.',
          'Doporučujeme připravit si rezervu na první čtvrtletí, upravit trvalý příkaz a u paušální daně ověřit, zda se vám nezmění pásmo. Rádi to spočítáme na první konzultaci.',
        ],
      },
      {
        title: 'Jednotné měsíční hlášení po prvním roce: pět nejčastějších chyb', slug: 'jednotne-mesicni-hlaseni-pet-chyb', date: '2026-10-29',
        summary: 'Hlášení nahradilo řadu formulářů, ale přineslo nové termíny. Co letos opravujeme u nových klientů nejčastěji a jak se tomu vyhnout.',
        body: [
          'Jednotné hlášení sloučilo několik dřívějších formulářů do jednoho podání. Zaměstnavatelé si ale často nevšimli, že se změnily termíny a že se některé údaje podávají jinak než dřív.',
          'Nejčastější chyby jsou čtyři až pět: opožděné podání, chybějící změny u zaměstnanců, špatně vykázané dohody, překlep v čísle účtu a nesoulad mezi hlášením a mzdovou evidencí.',
          'Vyhnete se jim jednoduše: jeden člověk v kanceláři má hlášení na starosti a každý měsíc před odesláním porovná součty s výplatními páskami.',
        ],
      },
      {
        title: 'Prodej bytu a daň z příjmů: kdy platí osvobození', slug: 'prodej-bytu-a-dan-z-prijmu', date: '2026-10-06',
        summary: 'Dva roky bydliště, deset let vlastnictví, nebo peníze použité na vlastní bydlení. Kdy daň neplatíte a kdy musíte příjem úřadu oznámit.',
        body: [
          'Příjem z prodeje bytu je od daně osvobozen, pokud jsou splněny zákonné podmínky. Nejčastěji se rozhoduje o době vlastnictví, o době, po kterou jste v bytě bydleli, nebo o tom, na co jste peníze z prodeje použili.',
          'I když daň neplatíte, přiznání se může hodit: úřadu tím doložíte, že jste podmínky splnili, a vyhnete se dotazům po několika letech.',
          'Před prodejem proto doporučujeme sejít se s námi a ověřit, kterou z podmínek splňujete a které doklady si schovat.',
        ],
      },
      {
        title: 'Kdy podat přiznání k dani z příjmů a kdo má lhůtu delší', slug: 'kdy-podat-priznani-k-dani-z-prijmu', date: '2026-09-15',
        summary: 'Běžný termín je konec března, s daňovým poradcem se lhůta posouvá až do 1. července. Kdo to využije a jak plnou moc udělit.',
        body: [
          'Přiznání k dani z příjmů se obvykle podává do konce března. Kdo má povinný audit nebo využije daňového poradce na plnou moc, získává lhůtu delší.',
          'Plnou moc musí poradce podat ještě před koncem běžné lhůty. Pokud se vám to nepovede, přiznání je opožděné, i když ho následně podá poradce.',
          'Podklady proto potřebujeme od klientů nejpozději do konce února. Pošlete je e-mailem nebo je vyfoťte, na papír nejsme zvědaví.',
        ],
      },
      {
        title: 'Spolek a účetní závěrka: co se zveřejňuje a kam', slug: 'spolek-a-ucetni-zaverka', date: '2026-08-20',
        summary: 'Spolky mají povinnost ukládat závěrku do sbírky listin. Co v ní má být a proč se bez ní neobejdete při žádosti o dotaci.',
        body: [
          'Většina spolků je povinna vést účetnictví a každý rok ukládat účetní závěrku do sbírky listin. Dotační poskytovatelé se na ni při hodnocení žádostí ptají čím dál častěji.',
          'Do sbírky listin se ukládá rozvaha, výkaz zisku a ztráty a příloha. Dokumenty podává statutární orgán, účetní je ale může připravit.',
          'Pokud závěrku několik let nepodáte, můžete ji doplnit zpětně. Trvá to déle než včas, ale dá se to vyřešit.',
        ],
      },
      {
        title: 'Jak si vybrat mezi paušální daní a daňovou evidencí', slug: 'pausalni-dan-nebo-danova-evidence', date: '2026-06-30',
        summary: 'Paušální daň je jednoduchá, ale ne pro každého výhodná. Čtyři otázky, na které si odpovězte, než se rozhodnete.',
        body: [
          'Paušální daň nahrazuje zálohy na pojištění a daň z příjmů jedinou měsíční platbou. Pro živnostníka s menším obratem a malými výdaji je to nejjednodušší cesta.',
          'Nevyplatí se tam, kde jsou velké výdaje, kde je potřeba uplatnit slevy na dítě nebo kde se obrat přibližuje hranici pásma.',
          'Odpovězte si na čtyři otázky: kolik obvykle utratíte za materiál, kolik vyděláte, zda máte děti a zda plánujete přijmout zaměstnance. Odpovědi nám pošlete a my spočítáme obě cesty.',
        ],
      },
    ],
  },
  questions: {
    eyebrow: 'Časté otázky',
    heading: 'Na co se lidé ptají před první schůzkou',
    items: [
      { question: 'Kolik stojí první konzultace?', answer: 'Nic. Trvá 45 minut, vede ji daňový poradce a k ničemu vás nezavazuje. Odnesete si odpověď na to, s čím jste přišli, a do tří dnů písemnou nabídku.' },
      { question: 'Musím nosit doklady osobně?', answer: 'Ne. Většina klientů doklady fotí telefonem nebo je posílá e-mailem. Papírové můžete přivézt jednou za čtvrt roku.' },
      { question: 'Dá se změnit účetní uprostřed roku?', answer: 'Ano, kdykoli. Podklady si od předchozí účetní vyžádáme sami a navážeme od měsíce, na kterém se dohodneme.' },
      { question: 'Ručíte za chyby?', answer: 'Ano. Jsme pojištěni na škodu do 10 milionů Kč a pokutu za naši chybu platíme my. Stojí to i ve smlouvě.' },
      { question: 'Do kdy potřebujete podklady k daňovému přiznání?', answer: 'Do konce února, pokud podáváte v běžném termínu. S plnou mocí pro daňového poradce se lhůta posouvá do 1. července.' },
    ],
  },
  contact: {
    eyebrow: 'Kontakt',
    heading: 'Domluvte si první konzultaci',
    text: 'Napište, co potřebujete. Odpovíme nejpozději druhý pracovní den, obvykle Hana Vondrová.',
    formHeading: '',
    consent: 'Odesláním souhlasíte se zpracováním údajů pro vyřízení poptávky.',
    hoursNote: 'Schůzky po domluvě i do 18 hodin.',
    route: [
      { figure: '4 min', text: 'pěšky z Masarykova náměstí, Vrbovou ulicí dolů' },
      { figure: '250 m', text: 'zastávka trolejbusu Masarykovo náměstí' },
      { figure: '2 místa', text: 'pro klienty ve dvoře, vjezd průjezdem vlevo od vchodu. Jinak placené stání v ulici.' },
      { figure: 'výtah', text: 'ze dvora, bez schodů až do kanceláře' },
    ],
  },
  // The documents linked from the footer: demo texts, to be replaced by the office's own.
  documents: [
    {
      title: 'Ochrana osobních údajů', slug: 'ochrana-osobnich-udaju',
      paragraphs: [
        'Tento text je ukázkový. Nahraďte ho vlastním zněním zásad ochrany osobních údajů.',
        'Správcem údajů je Tesař & Vondrová, daňová a účetní kancelář s.r.o., IČO 12345678, se sídlem Vrbová 28, 586 01 Jihlava. Údaje z formuláře (jméno, e-mail, telefon a zpráva) používáme jen k odpovědi na vaši poptávku.',
        'Údaje o klientech zpracováváme na základě smlouvy a zákonných povinností. Uchováváme je po dobu, kterou předepisují účetní a daňové předpisy. Kdykoli nás můžete požádat o přístup k údajům, jejich opravu nebo výmaz, a to e-mailem na kancelar@tvkancelar.example.',
      ],
    },
    {
      title: 'Cookies', slug: 'cookies',
      paragraphs: [
        'Tento text je ukázkový. Nahraďte ho vlastním zněním.',
        'Web používá jen technické soubory cookies, které jsou potřeba k jeho provozu. Měřit návštěvnost můžeme bez ukládání osobních údajů; pokud si zvolíte jinak, uvedeme to zde.',
      ],
    },
    {
      title: 'Všeobecné podmínky', slug: 'vseobecne-podminky',
      paragraphs: [
        'Tento text je ukázkový. Nahraďte ho vlastním zněním všeobecných obchodních podmínek.',
        'Rozsah práce, cenu a termíny dodání dokladů si kancelář s klientem sjedná písemně v nabídce. Cena se nemění, dokud se nezmění rozsah práce.',
      ],
    },
    {
      title: 'Informace pro spotřebitele', slug: 'informace-pro-spotrebitele',
      paragraphs: [
        'Tento text je ukázkový. Nahraďte ho vlastním zněním informací pro spotřebitele.',
        'Spotřebitel se může se stížností obrátit na kancelář na adrese kancelar@tvkancelar.example. Mimosoudně lze spor řešit u příslušného orgánu dohledu.',
      ],
    },
  ],
  // What is in each photograph, for people who cannot see it.
  photos: {
    kancelar: 'Kancelář v prvním patře: Jitka Malá u stolu u okna, vedle ní stojí Radek Tesař',
    schuzka: 'Daňová poradkyně Hana Vondrová u jednacího stolu s klienty',
    zasedacka: 'Zasedací místnost s dubovým stolem a oknem do ulice',
    dum: 'Dům ve Vrbové ulici 28 se zelenými dveřmi a průjezdem do dvora',
    porada: 'Petra Šimková a Martin Doležal u počítače v kanceláři',
    sanony: 'Police se šanony v kanceláři',
    stul: 'Jednací stůl shora: dvě kávy, karafa s vodou a zavřená složka',
    radek: 'Ing. Radek Tesař',
    hana: 'Ing. Hana Vondrová',
    jitka: 'Jitka Malá',
    petra: 'Bc. Petra Šimková',
    martin: 'Martin Doležal',
  },
}

// What the second look's design (Šanony) words differently from the texts above: a site made in
// that look gets these (the seed is told the look). Lists are replaced whole.
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  sanony: {
    settings: {
      tagline: 'daně a účetnictví',
      ctaLongLabel: 'První konzultace zdarma',
      membership: 'Komora daňových poradců ČR: Ing. Radek Tesař, ev. č. 3187, Ing. Hana Vondrová, ev. č. 4520',
    },
    opening: {
      eyebrow: 'Daňová a účetní kancelář · Jihlava, Vrbová 28',
      heading: 'Účty v pořádku. Daně včas. *Ceny předem.*',
      text: 'Vedeme účetnictví, mzdy a daně živnostníkům, malým firmám a spolkům z Vysočiny. Kolik to stojí, čtete na hřbetech šanonů a víte to dřív, než cokoli podepíšete.',
      primaryLabel: 'První konzultace zdarma',
      note: '45 minut s daňovým poradcem,\nu nás nebo online',
    },
    services: {
      eyebrow: '',
      heading: 'Osm služeb. Každá má cenovku.',
      groups: [
        { name: 'Účetnictví a mzdy', note: 'měsíční paušál podle počtu dokladů a zaměstnanců' },
        { name: 'Daně', note: 'pevná cena za přiznání, hodinová sazba za poradenství' },
        { name: 'Jednorázově', note: 'pevná cena, kterou znáte, než začneme' },
      ],
    },
    audience: {
      heading: 'Pro koho počítáme',
      text: '',
      items: [
        { title: 'Živnostníci', text: 'Řemeslníci, lékaři, lidé na volné noze. Paušální daň, výdaje procentem i skutečné.', count: '', from: 'od 1 400 Kč měsíčně' },
        { title: 'Malé firmy', text: 'Společnosti s ručením omezeným do třiceti zaměstnanců, včetně mezd a DPH.', count: '', from: 'od 3 900 Kč měsíčně' },
        { title: 'Spolky a SVJ', text: 'Účetnictví, vyúčtování dotací, závěrka do sbírky listin a podklady pro shromáždění.', count: '', from: 'od 1 900 Kč měsíčně' },
        { title: 'Rodiny', text: 'Pronájem bytu, prodej nemovitosti, dědictví, příjmy ze zahraničí, slevy na děti.', count: '', from: 'přiznání od 2 500 Kč' },
      ],
    },
    people: {
      eyebrow: '',
      heading: 'Pět lidí. Žádná ústředna.',
      text: 'Vaše čísla zná jeden člověk a telefon si zvedá sám. Když je na dovolené, zastoupí ho kolega, který o vás ví.',
    },
    steps: {
      eyebrow: '',
      heading: 'Čtyři kroky a je to u nás.',
      items: [
        { label: '', title: 'Zavoláte nebo napíšete', text: 'Ozveme se nejpozději druhý pracovní den a domluvíme termín schůzky.' },
        { label: '', title: 'První konzultace, 45 minut zdarma', text: 'U nás ve Vrbové ulici nebo online. Projdeme, co potřebujete a v jakém stavu jsou podklady.' },
        { label: '', title: 'Písemná nabídka do tří dnů', text: 'S pevnou měsíční částkou a přesným rozsahem práce. Nezavazuje vás k ničemu.' },
        { label: '', title: 'Převezmeme podklady', text: 'S předchozí účetní se domluvíme sami. Od prvního měsíce máte jednoho člověka, který vaše čísla zná.' },
      ],
    },
    cases: {
      eyebrow: '',
      heading: 'Co jsme letos vyřešili',
      text: 'Tři zakázky z posledních dvanácti měsíců. Jména necháváme v šanonu, čísla jsou skutečná.',
      items: [
        {
          title: 'Kontrola DPH tři roky zpátky', slug: 'kontrola-dph-tri-roky-zpatky', client: 'Truhlářská dílna', duration: '5 měsíců',
          problem: 'Dílně s osmi zaměstnanci přišla výzva, aby prokázala nárok na odpočet DPH za roky 2022 až 2024. Úřad zpochybnil 41 faktur od dvou dodavatelů.',
          solution: 'Převzali jsme zastupování, dohledali dodací listy, fotografie zakázek a platby a předali je úřadu ve dvou podáních.',
          outcome: 'Bez doměrku. Účtovali jsme 38 hodin práce.',
          body: [
            'Výzvu dílna dostala v polovině března a na odpověď měla třicet dní. Majitel měl faktury, ale ne to, co úřad chtěl vidět: že zboží skutečně dorazilo a že dodavatelé existují.',
            'První dva týdny jsme dohledávali. Dodací listy ležely v kabině dodávky, fotografie hotových zakázek v telefonech truhlářů, platby v bance. Každou z jedenačtyřiceti faktur jsme spárovali s dodáním a platbou a složili do jedné tabulky, kterou úřad snadno přečte.',
            'Podání jsme poslali ve dvou částech a k ústnímu jednání s majitelem šel Radek Tesař. Úřad se po druhém podání spokojil a kontrolu uzavřel.',
          ],
        },
        {
          title: 'Ze živnosti do s.r.o.', slug: 'ze-zivnosti-do-sro', client: 'Programátor na volné noze', duration: '3 týdny',
          problem: 'Obrat přesáhl dva miliony korun a klient chtěl přijmout prvního zaměstnance. Nevěděl, jestli má zůstat živnostníkem.',
          solution: 'Spočítali jsme tři varianty na tři roky dopředu, založili společnost, zaregistrovali ji k DPH a nastavili výplatu.',
          outcome: 'O 96 000 Kč ročně méně na daních a pojistném.',
          body: [
            'Klient pracoval pro tři stálé zákazníky a obrat mu rostl rychleji, než čekal. Zeptal se nás, zda se mu vyplatí zůstat na živnosti, nebo založit společnost.',
            'Porovnali jsme živnost, s.r.o. s výplatou mzdy a s.r.o. s vyplácením podílu na zisku. U každé varianty jsme spočítali daně, pojistné i administrativu na tři roky dopředu a ukázali, kde se výhoda mění v nevýhodu.',
            'Společnost jsme založili za dva týdny, třetí týden zabrala registrace k DPH a nastavení výplaty. Klient dnes posílá doklady z telefonu a o účetnictví se nestará.',
          ],
        },
        {
          title: 'Spolek čtyři roky bez účetnictví', slug: 'spolek-ctyri-roky-bez-ucetnictvi', client: 'Sportovní oddíl', duration: '6 týdnů',
          problem: 'Oddíl s 220 členy žádal kraj o dotaci, ale čtyři roky nezveřejnil účetní závěrku a pokladna neseděla s bankou.',
          solution: 'Zpětně jsme zpracovali účetnictví z výpisů a pokladních bloků, podali závěrky a zavedli jednoduchou pokladní knihu.',
          outcome: 'Dotace 380 000 Kč přišla v termínu.',
          body: [
            'Výbor oddílu se střídal a každý nový pokladník převzal krabici s doklady a výpisy z banky. Účetní závěrka nebyla zveřejněna čtyři roky, a kraj proto žádost o dotaci nepřijal.',
            'Z bankovních výpisů a pokladních bloků jsme složili účetnictví za všechny čtyři roky, vysvětlili rozdíly mezi pokladnou a bankou a podali chybějící závěrky do sbírky listin.',
            'Pokladní kniha, kterou jsme zavedli, má jednu stránku na měsíc a pokladník ji zvládne vyplnit za deset minut. Žádost o dotaci jsme pak podali s úplnými doklady.',
          ],
        },
      ],
    },
    articles: {
      eyebrow: '',
      heading: 'Co je nového v daních',
    },
    questions: {
      eyebrow: '',
      heading: 'Ptáte se nás',
      items: [
        { question: 'Kolik stojí první konzultace?', answer: 'Nic. Trvá 45 minut, vede ji daňový poradce a k ničemu vás nezavazuje. Odnesete si odpověď na to, s čím jste přišli, a do tří dnů písemnou nabídku.' },
        { question: 'Musím nosit doklady osobně?', answer: 'Ne. Většina klientů doklady fotí telefonem nebo je posílá e-mailem. Papírové můžete přivézt jednou za čtvrt roku.' },
        { question: 'Dá se změnit účetní uprostřed roku?', answer: 'Ano, kdykoli. Podklady si od předchozí účetní vyžádáme sami a navážeme od měsíce, na kterém se dohodneme.' },
        { question: 'Ručíte za chyby?', answer: 'Ano. Jsme pojištěni na škodu do 10 milionů Kč a pokutu za naši chybu platíme my. Stojí to i ve smlouvě.' },
        { question: 'Do kdy potřebujete podklady k přiznání?', answer: 'Do konce února, pokud podáváte v běžném termínu. S plnou mocí pro daňového poradce se lhůta posouvá do 1. července.' },
      ],
    },
    contact: {
      eyebrow: 'Kontakt',
      heading: 'Vrbová 28, první patro.',
      text: 'Napište, co potřebujete. Ozveme se nejpozději druhý pracovní den.',
      formHeading: 'První konzultace zdarma',
      hoursNote: 'Schůzky po domluvě i do 18 hodin. Zelené dveře vedle průjezdu, výtah ze dvora.',
      route: [
        { figure: '4 min', text: 'pěšky z Masarykova náměstí, Vrbovou ulicí dolů' },
        { figure: '250 m', text: 'od zastávky trolejbusu Masarykovo náměstí' },
        { figure: '2 místa', text: 'pro klienty ve dvoře, vjezd průjezdem vlevo od vchodu' },
      ],
    },
  },
}
