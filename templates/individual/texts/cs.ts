// Every Czech text of the Freelancer and consultant template, in one place: the website's own
// words (what is not content: "Pro koho", "Ptáte se", the anchors of the sections) and the demo
// content the seed puts in. Another language is a file beside this one with the same two exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import type { DemoOverride } from '../../kit/seed'
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'

export interface Words extends KitWords {
  /** The name's label for screen readers: "Magda Šubrtová, na začátek stránky". */
  toTop: (name: string) => string
  /** The first call's button where the header's button is the short one. */
  firstCall: string
  /** "Zavolejme si" */
  callUs: string
  /** The section of facts at a glance, for screen readers. */
  inShort: string
  forWhom: string
  duration: string
  price: string
  service: string
  /** "Krok 2" */
  stepOf: (n: number) => string
  /** The line above a visitor's question in the conversation look. */
  asked: string
  /** What the arrow of a result in numbers says: "4 → 11" read as "4 na 11". */
  arrowTo: string
  personally: string
  web: string
  social: string
  linkedin: string
  instagram: string
  newsletter: string
  allProjects: string
  allArticles: string
  backToProjects: string
  backToArticles: string
  client: string
  year: string
  done: string
  result: string
  noProjects: string
  noArticles: string
  /** "Fotografie: Anna Nováková" for the list of photographs. */
  rights: string
  /** The addresses of the sections on a page (`/#sluzby`), by block type. */
  anchors: Record<'opening' | 'services' | 'projects' | 'steps' | 'testimonials' | 'about' | 'articles' | 'contact', string>
}

export const words: Words = {
  ...KIT_WORDS.cs,
  toTop: (name) => `${name}, na začátek stránky`,
  firstCall: 'Domluvit první hovor',
  callUs: 'Zavolejme si',
  inShort: 'V kostce',
  forWhom: 'Pro koho', duration: 'Jak dlouho', price: 'Cena', service: 'Služba',
  stepOf: (n) => `Krok ${n}`,
  asked: 'Ptáte se',
  arrowTo: 'na',
  personally: 'Osobně',
  web: 'Web', social: 'Sítě',
  linkedin: 'LinkedIn', instagram: 'Instagram', newsletter: 'Newsletter',
  allProjects: 'Všechny zakázky', allArticles: 'Všechny články',
  backToProjects: 'Všechny zakázky', backToArticles: 'Všechny články',
  client: 'Klient', year: 'Rok', done: 'Co bylo uděláno', result: 'Výsledek',
  noProjects: 'Zakázky zatím nejsou zveřejněné.', noArticles: 'Články zatím nejsou zveřejněné.',
  rights: 'Všechna práva vyhrazena',
  anchors: {
    opening: 'uvod', services: 'sluzby', projects: 'zakazky', steps: 'postup', testimonials: 'reference', about: 'o-mne', articles: 'blog', contact: 'kontakt',
  },
  defaultName: 'Moje služby',
}

// ── the demo content: the fictional copywriter Magda Šubrtová from Brno, who writes websites,
//    e-mails and offers for craftsmen, makers and small firms. The people, the firms, the phone
//    numbers and the addresses are invented. The profession is one example: the same blocks
//    serve a coach, a consultant, a lecturer or a translator. ──
const sharedDemo = {
  settings: {
    siteName: 'Magda Šubrtová',
    role: 'copywriterka',
    shortDescription: 'Copywriterka z Brna. Weby, e-maily a nabídky pro firmy, které dělají dobrou práci.',
    phone: '123 456 701',
    phoneHours: 'pondělí až pátek, 9–16 hodin',
    email: 'magda@magdasubrtova.example',
    address: 'Skřivánčí 41, 602 00 Brno',
    addressNote: 'po domluvě, jinak online',
    nextFree: 'Nové zakázky beru od ledna 2027',
    ctaLabel: 'Domluvit hovor',
    linkedinUrl: 'https://linkedin.example/magdasubrtova',
    instagramUrl: 'https://instagram.example/magda.pise',
    newsletterUrl: 'https://magdasubrtova.example/newsletter',
    legalName: 'Mgr. Magda Šubrtová',
    companyId: '12345678',
    legalNote: 'zapsaná v živnostenském rejstříku · nejsem plátce DPH',
    metaDescription: 'Píšu weby, e-maily a nabídky pro řemeslníky, výrobce a malé firmy. Audit textů za 6 900 Kč, texty na web od 24 000 Kč. První hovor zdarma.',
  },
  menu: { services: 'Služby a ceny', projects: 'Zakázky', about: 'O mně', articles: 'Blog' },
  legalMenu: 'Ochrana osobních údajů',
  home: { title: 'Úvod' },
  opening: {
    eyebrow: 'Copywriterka · Brno · na volné noze od roku 2018',
    strike: '',
    question: '',
    heading: 'Píšu pro firmy, které dělají dobrou práci a neumějí o ní *mluvit.*',
    text: 'Jsem Magda Šubrtová. Řemeslníkům, výrobcům a malým firmám píšu weby, e-maily a nabídky, kterým zákazník rozumí napoprvé.',
    primaryLabel: 'Domluvit první hovor',
    secondaryLabel: 'Služby a ceny',
    note: 'První hovor trvá 30 minut, je zdarma a k ničemu vás nezavazuje.',
    facts: [
      { label: 'Pro koho', value: 'Řemeslníci, výrobci, malé firmy a e-shopy' },
      { label: 'Co píšu', value: 'Weby, e-maily, nabídky a příručky stylu' },
      { label: 'Ceny', value: 'Audit 6 900 Kč, web od 24 000 Kč' },
      { label: 'Nejbližší volno', value: 'Nové zakázky beru od ledna 2027' },
    ],
    chipsTitle: '',
    chips: [] as string[],
  },
  services: {
    eyebrow: 'Služby a ceny',
    question: '',
    heading: 'Pět věcí, které dělám. U každé víte předem, *kolik stojí.*',
    text: 'Začít se dá auditem za pár tisíc, nebo rovnou celým webem. Přesnou cenu a termín vám pošlu do dvou pracovních dnů po prvním hovoru.',
    footnote: 'Nejsem plátce DPH, ceny jsou konečné. V ceně jsou vždy dvě kola připomínek.',
    linkLabel: 'Nevíte, kterou vybrat? Zavolejme si',
    helpTitle: '',
    helpText: '',
    items: [
      { name: 'Audit textů', text: 'Projdu váš web nebo nabídku a sepíšu, co škrtnout, co přepsat a čím začít. K tomu hodina na vaše dotazy.', forWhom: 'Máte web hotový a nevíte, proč neprodává.', duration: '5 pracovních dní', price: '6 900 Kč' },
      { name: 'Texty na web', text: 'Úvodní stránka, služby, o nás a kontakt. Nejdřív rozhovor s vámi a se dvěma vašimi zákazníky, potom texty rovnou do rozvržení stránek.', forWhom: 'Stavíte nový web nebo předěláváte starý.', duration: '2–3 týdny', price: 'od 24 000 Kč' },
      { name: 'E-mailové série', text: 'Uvítací série, obchodní e-maily nebo pravidelný newsletter. Včetně předmětů a nasazení do vašeho nástroje.', forWhom: 'E-shopy a služby, které mají kontakty a nepíšou jim.', duration: '1–2 týdny', price: 'od 9 500 Kč' },
      { name: 'Hlas značky', text: 'Příručka, jak vaše firma píše: slovník, ukázky a slova, kterým se vyhnout. Aby web, e-maily i faktury zněly jako od jednoho člověka.', forWhom: 'Firmy, ve kterých píše víc lidí najednou.', duration: '3 týdny', price: '32 000 Kč' },
      { name: 'Školení psaní', text: 'Půlden nad vašimi vlastními e-maily a nabídkami. Žádné poučky ze slajdů: škrtáme a přepisujeme společně.', forWhom: 'Obchodníci, podpora a marketing, do 12 lidí.', duration: '4 hodiny u vás', price: '18 000 Kč' },
    ],
  },
  projects: {
    eyebrow: 'Vybrané zakázky',
    question: '',
    heading: 'Čtyři klienti a *co se u nich změnilo.*',
    text: 'Hezký text nestačí. U každé zakázky se po měsíci dívám, jestli přibylo poptávek, objednávek nebo podepsaných nabídek.',
    linkLabel: 'Všechny zakázky',
    items: [
      {
        title: 'Web, který poprvé řekl, kolik kuchyně stojí', client: 'Truhlářství Habřina, Žďár nad Sázavou', year: '2026',
        done: 'Rozhovory s majitelem a třemi zákazníky, nová struktura webu, texty sedmi stránek a orientační ceník kuchyní na míru.',
        result: '4 → 11', resultText: 'poptávek z webu měsíčně. A skoro nikdo už nevolá jen kvůli ceně.',
        story: [
          'Truhlářství Habřina dělá kuchyně z masivu na míru a za poslední roky se jeho zakázky držely hlavně na doporučeních. Web existoval, ale o kuchyních říkal jediné: že jsou kvalitní.',
          'Strávila jsem den v dílně a poslouchala, na co se zákazníci ptají nejdřív. Skoro vždycky na cenu. Nový web proto začíná orientačním ceníkem a třemi příběhy kuchyní, které si lidé mohou porovnat se svým rozpočtem.',
          'Měsíc po nasazení chodily čtyři poptávky z webu, za další tři měsíce jedenáct. A skoro nikdo už nevolá jen kvůli ceně.',
        ],
      },
      {
        title: 'Popisky vín bez tónů lesního ovoce', client: 'Vinařství Tři sklepy, Velké Bílovice', year: '2025',
        done: 'Popisy 34 vín pro e-shop, uvítací série tří e-mailů a stránka o rodině.',
        result: '1 ze 3', resultText: 'nových odběratelů objedná do měsíce. Dřív každý osmý.',
        story: [
          'Rodinné vinařství mělo dobrá vína a popisky, které se daly vyměnit s kterýmkoli jiným vinařstvím. Víno za vínem stejné tóny ovoce a „elegantní dochuť“.',
          'Ochutnala jsem všech čtyřiatřicet vín, u každého se zeptala, co se k němu jí a komu ho vinař sám nalévá. Z odpovědí vznikly popisy, které se čtou jako rada od souseda.',
          'Nové odběratele teď vítají tři e-maily. Z každých tří jich jeden objedná do měsíce, dřív to byl každý osmý.',
        ],
      },
      {
        title: 'Nabídka na jednu stranu místo dvanácti', client: 'Účetní kancelář Saldo, Brno', year: '2025',
        done: 'Přepsaná obchodní nabídka, tři e-maily k ní a stránka s cenami na webu.',
        result: '3 → 6', resultText: 'podepsaných nabídek z každých deseti odeslaných.',
        story: [
          'Kancelář posílala nabídku na dvanáct stran, kterou nikdo nedočetl. Obsahovala všechno, jen ne odpověď na otázku, co klient dostane za své peníze.',
          'Nabídka má teď jednu stranu: co děláme, co to stojí, kdy to začne. Tři e-maily k ní vysvětlují, co se stane, když ji klient podepíše, a co když ne.',
          'Ze zhruba tří podepsaných nabídek z deseti se stalo šest.',
        ],
      },
      {
        title: 'Rezervace přímo, ne přes portály', client: 'Chalupa U Staré lanovky, Jeseníky', year: '2024',
        done: 'Texty webu, popisy pokojů a e-maily hostům před příjezdem a po odjezdu.',
        result: '41 → 63 %', resultText: 'rezervací přichází přímo přes web chalupy.',
        story: [
          'Chalupa platila rezervačním portálům provize z většiny pobytů. Vlastní web byl přehlídka pokojů bez jediné věty o tom, proč přijet právě sem.',
          'Napsala jsem popisy pokojů tak, aby z nich bylo poznat, jak se v nich spí, a e-maily, které hosta před příjezdem uklidní a po odjezdu pozvou zpátky.',
          'Podíl rezervací přímo přes web vzrostl za rok ze čtyřiceti jedna na šedesát tři procenta.',
        ],
      },
    ],
  },
  steps: {
    eyebrow: 'Jak spolupráce probíhá',
    question: '',
    heading: 'Nejdřív se ptám. *Psát začínám až potom.*',
    text: 'Od prvního hovoru po texty na webu to trvá obvykle tři týdny.',
    imageCaption: 'Rozhovor v dílně Truhlářství Habřina, březen 2026.',
    imageQuestion: '',
    items: [
      { title: 'První hovor', when: 'Den první', text: 'Třicet minut po telefonu nebo online, zdarma. Řeknete mi, co prodáváte a co nefunguje. Do dvou pracovních dnů pošlu cenu a termín.' },
      { title: 'Rozhovory', when: '1. týden', text: 'Hodinu a půl mluvím s vámi, potom se dvěma nebo třemi vašimi zákazníky. Z jejich slov vzniká většina textů.' },
      { title: 'První verze', when: '2.–3. týden', text: 'Do deseti pracovních dnů ji máte ve sdíleném dokumentu. Připomínky píšete přímo do textu, v ceně jsou dvě kola úprav.' },
      { title: 'Kontrola na webu', when: 'Po měsíci', text: 'Hotové texty si přečtu ještě jednou, až budou nasazené. Po měsíci se spolu podíváme na čísla a doladíme, co nesedí.' },
    ],
  },
  testimonials: {
    heading: 'Řekli o spolupráci',
    items: [
      { text: 'Magda se ptala na věci, na které se nás nikdy nikdo nezeptal. Po týdnu věděla o našich kuchyních víc než náš obchodník. Web teď zní tak, jak mluvíme se zákazníky v dílně.', name: 'Tomáš Habřina', role: 'majitel, Truhlářství Habřina' },
      { text: 'Čekala jsem hezké věty. Dostala jsem seznam, co na webu chybí, a texty, po kterých nám lidé přestali volat s dotazem, co vlastně děláme.', name: 'Lenka Dostálová', role: 'jednatelka, účetní kancelář Saldo' },
      { text: 'Školení bylo nad našimi vlastními e-maily. Podpora teď odpovídá o polovinu kratšími zprávami a zákazníci se méně doptávají.', name: 'Marek Vrána', role: 'vedoucí zákaznické podpory, e-shop Kolovna' },
    ],
  },
  about: {
    eyebrow: 'O mně',
    question: '',
    heading: 'Osm let v novinách mě naučilo *ptát se a škrtat.*',
    text: 'Do roku 2018 jsem psala do regionálního deníku, poslední čtyři roky o ekonomice a malých firmách. Obcházela jsem dílny, sklepy a kanceláře a zjistila jsem, že lidé, kteří svou práci umějí nejlíp, o ní často mluví nejhůř. Tak jsem jim s tím začala pomáhat.\n\nDnes pracuju na volné noze. Beru nejvýš tři zakázky najednou a každou píšu sama, nikomu ji nepředávám. Bydlím v Brně-Žabovřeskách se dvěma dětmi a jezevčíkem Kvidem.',
    imageCaption: 'S Kvidem u Brněnské přehrady. Tady vzniká většina titulků.',
    timeline: [
      { when: '2006–2011', text: 'Žurnalistika na univerzitě v Brně' },
      { when: '2010–2018', text: 'Redaktorka regionálního deníku, od roku 2014 ekonomická rubrika' },
      { when: 'Od 2018', text: 'Copywriterka na volné noze, 140 dokončených zakázek' },
      { when: 'Od 2022', text: 'Učím psaní pro web v kurzech pro začínající podnikatele' },
    ],
  },
  articles: {
    eyebrow: 'Z blogu',
    question: '',
    heading: 'Píšu i *o psaní.*',
    text: 'Dvakrát do měsíce jeden článek o tom, jak psát o vlastní firmě srozumitelně.',
    linkLabel: 'Všechny články',
    items: [
      {
        title: 'Proč na webu neuvádíte ceny a proč byste měli', date: '2026-11-11T23:00:00Z',
        excerpt: 'Tři obavy, které slyším od majitelů firem nejčastěji, a co se stalo, když je moji klienti překonali.',
        body: [
          'Když se zeptám majitele firmy, proč na webu nemá ceny, dostanu skoro vždycky jednu ze tří odpovědí. Konkurence by je viděla. Každý případ je jiný. A zákazník by se lekl.',
          'Konkurence ceny zná, stejně jako vy znáte její. Každý případ je opravdu jiný, ale „od“ a orientační příklad to unesou. A zákazník, který se lekne ceny na webu, by se ji lekl i po hodině telefonování. Jen byste o tu hodinu přišli.',
          'U klientů, kteří ceny na web napsali, klesl počet hovorů a vzrostl počet poptávek. Lidé volají, když už vědí, o jaké penězích se mluví.',
        ],
      },
      {
        title: 'Stránka O nás není o vás', date: '2026-10-27T23:00:00Z',
        excerpt: 'Jak napsat příběh firmy tak, aby v něm zákazník našel důvod vybrat si právě vás.',
        body: [
          'Většina stránek O nás začíná rokem založení. Zákazník ho nehledá. Hledá odpověď, jestli může firmě svěřit svůj problém.',
          'Začněte u něj. Co ho přivedlo, čeho se bál, co mu pomohlo. Teprve potom přijde rok založení a jména lidí, a bude jim věřit.',
        ],
      },
      {
        title: 'Sedm slov, která z nabídky škrtám jako první', date: '2026-10-08T22:00:00Z',
        excerpt: 'Komplexní, kvalitní, individuální přístup. A čím je nahradit, aby věta něco řekla.',
        body: [
          'Komplexní, kvalitní, individuální, profesionální, moderní, inovativní, na míru. Sedm slov, která si zákazník přečte a nepamatuje si je, protože neříkají nic, co by nemohl napsat každý.',
          'Škrtněte je a podívejte se, co zbylo. Pokud nic, začněte větou, kterou byste řekli zákazníkovi do očí: co udělám, do kdy a za kolik.',
        ],
      },
    ],
  },
  contact: {
    eyebrow: 'První hovor',
    question: '',
    heading: 'Řekněte mi, co potřebujete napsat.',
    text: 'Hovor trvá 30 minut, je zdarma a k ničemu vás nezavazuje. Ozvu se nejpozději druhý pracovní den a domluvíme čas.',
    formTitle: '',
    times: ['Dopoledne 9–12', 'Odpoledne 13–16', 'Je mi to jedno'],
    note: 'Odpovídám do druhého pracovního dne.',
  },
  privacy: {
    title: 'Ochrana osobních údajů',
    intro: 'Ukázkový text. Před zveřejněním popište, jak s údaji klientů nakládáte vy.',
    sections: [
      { heading: 'Jaké údaje zpracovávám', text: 'Z formuláře mám vaše jméno, e-mail a zprávu. Když si objednáte služby, zpracovávám i fakturační údaje.' },
      { heading: 'Proč údaje potřebuji', items: ['abych vám mohla odpovědět', 'abych s vámi uzavřela smlouvu a vystavila fakturu', 'abych vám předala hotové texty'] },
      { heading: 'Jak dlouho je uchovávám', text: 'Pokud se nedomluvíme, zprávu do půl roku smažu. Fakturační údaje uchovávám po dobu, kterou mi ukládá zákon.' },
    ],
  },
  photos: {
    portrait: 'Magda Šubrtová, copywriterka, stojí u okna ve světlé místnosti',
    desk: 'Magda Šubrtová u pracovního stolu s notebookem a zápisníkem',
    walk: 'Magda Šubrtová na procházce s jezevčíkem u přehrady',
    interview: 'Magda Šubrtová s poznámkovým blokem poslouchá truhláře u ponku v jeho dílně',
    workshop: 'Magda Šubrtová při školení psaní pro malý tým v zasedací místnosti',
    truhlarstvi: 'Truhlářská dílna s rozpracovanou dubovou kuchyňskou skříňkou',
    vinarstvi: 'Vinař ve sklepě drží proti světlu sklenku bílého vína',
    ucetni: 'Dvě účetní u společného stolu ve světlé kanceláři',
    penzion: 'Roubená horská chalupa na louce u lesa v Jeseníkách',
    ceny: 'Stánek na farmářském trhu s bednami jablek a mosaznou váhou',
    onas: 'Květinářka v zelené zástěře stojí ve dveřích svého obchodu',
    slova: 'Zmuchlané papíry, tužka a brýle na dubovém stole',
  },
}

export const demo = sharedDemo

// ── what the other two designs word differently: their own slogans and headings, the questions
//    of Rozhovor, labels of menus and buttons, the result lines. The seed lays them over `demo`
//    (the first look's design) for the look a site is made in. A list is replaced whole. ──
const resultLines = ['poptávek z webu měsíčně', 'nových odběratelů objedná do měsíce', 'podepsaných nabídek z deseti', 'rezervací přímo přes web']
const longerDone = [
  'Rozhovory s majitelem a třemi zákazníky, nová struktura webu, texty sedmi stránek a orientační ceník. Skoro nikdo už nevolá jen kvůli ceně.',
  'Popisy 34 vín pro e-shop, uvítací série tří e-mailů a stránka o rodině. Dřív objednal každý osmý.',
  'Přepsaná obchodní nabídka, tři e-maily k ní a stránka s cenami na webu.',
  'Texty webu, popisy pokojů a e-maily hostům před příjezdem a po odjezdu.',
]
const projectsWith = (patch: (i: number) => Record<string, string>) => sharedDemo.projects.items.map((item, i) => ({ ...item, ...patch(i) }))

export const demoByLook: Partial<Record<string, DemoOverride<typeof sharedDemo>>> = {
  zvyraznovac: {
    settings: { phoneHours: 'po–pá 9–16' },
    opening: {
      strike: 'Komplexní řešení šitá na míru.',
      eyebrow: '',
      heading: 'Texty, po kterých vám lidé *zavolají.*',
      text: 'Jsem Magda, copywriterka z Brna. Píšu weby, e-maily a nabídky pro řemeslníky, výrobce a malé firmy, které svou práci umějí líp dělat než popsat.',
      note: '30 minut · zdarma',
      facts: [
        { label: 'Od', value: '6 900 Kč' },
        { label: 'Volno', value: 'od ledna 2027' },
        { label: 'Kde', value: 'Brno a online' },
      ],
    },
    services: {
      heading: 'Co pro vás *napíšu*',
      text: 'Pět služeb, pět cen. Přesnou částku a termín posílám do dvou pracovních dnů po prvním hovoru.',
      footnote: 'Nejsem plátce DPH · ceny jsou konečné · dvě kola připomínek v ceně',
    },
    projects: {
      heading: 'Čísla místo *chvály*',
      text: 'Čtyři zakázky a co se po nich změnilo. Měřím to vždycky měsíc po nasazení textů.',
      items: projectsWith((i) => ({ resultText: resultLines[i]!, done: longerDone[i]! })),
    },
    steps: {
      heading: 'Nejdřív se ptám. *Pak píšu.*',
      items: [
        { title: 'První hovor', when: 'den první', text: 'Třicet minut po telefonu nebo online, zdarma. Řeknete mi, co prodáváte a co nefunguje. Do dvou dnů pošlu cenu a termín.' },
        { title: 'Rozhovory', when: 'první týden', text: 'Hodinu a půl mluvím s vámi, potom se dvěma nebo třemi vašimi zákazníky. Z jejich slov vzniká většina textů.' },
        { title: 'První verze', when: 'do 10 dnů', text: 'Máte ji ve sdíleném dokumentu. Připomínky píšete přímo do textu, v ceně jsou dvě kola úprav.' },
        { title: 'Kontrola na webu', when: 'po měsíci', text: 'Hotové texty si přečtu ještě jednou nasazené. Po měsíci se spolu podíváme na čísla a doladíme, co nesedí.' },
      ],
    },
    testimonials: {
      items: [
        { text: 'Po týdnu věděla o našich kuchyních víc než náš obchodník. Web teď zní tak, jak mluvíme se zákazníky v dílně.', name: 'Tomáš Habřina', role: 'majitel, Truhlářství Habřina' },
        sharedDemo.testimonials.items[1]!,
        sharedDemo.testimonials.items[2]!,
      ],
    },
    about: {
      heading: 'Osm let v novinách. Teď píšu *pro vás.*',
      text: 'Do roku 2018 jsem psala do regionálního deníku, poslední čtyři roky o ekonomice a malých firmách. Obcházela jsem dílny, sklepy a kanceláře a zjistila jsem, že lidé, kteří svou práci umějí nejlíp, o ní často mluví nejhůř.\n\nDnes pracuju na volné noze. Beru nejvýš tři zakázky najednou a každou píšu sama. Bydlím v Brně-Žabovřeskách se dvěma dětmi a jezevčíkem Kvidem, se kterým vymýšlím většinu titulků.',
      imageCaption: 'S Kvidem u Brněnské přehrady',
    },
    articles: { eyebrow: '', heading: 'Z blogu', text: '' },
    contact: {
      heading: 'Zavolejme si.',
      text: 'První hovor trvá 30 minut, je zdarma a k ničemu vás nezavazuje. Ozvu se nejpozději druhý pracovní den.',
      note: 'Odpovídám do druhého pracovního dne',
    },
  },
  rozhovor: {
    settings: { ctaLabel: 'Zavolejme si' },
    menu: { services: 'Co dělám', about: 'Kdo jsem' },
    legalMenu: 'Ochrana údajů',
    opening: {
      eyebrow: '',
      question: 'Dobrý den, hledáme někoho, kdo nám napíše web.',
      heading: 'Dobrý den, jsem Magda. Píšu texty, kterým váš zákazník rozumí *napoprvé.*',
      text: 'Weby, e-maily a nabídky pro řemeslníky, výrobce a malé firmy. Pracuju z Brna pro celé Česko. Audit textů stojí 6 900 Kč, web od 24 000 Kč.',
      note: '30 minut, zdarma a nezávazně',
      facts: [],
      chipsTitle: 'Na co se lidé ptají nejčastěji',
      chips: ['S čím mi pomůžete?', 'A kolik to stojí?', 'Funguje to?', 'Jak to probíhá?', 'Kdo vlastně jste?', 'Kdy si zavoláme?'],
    },
    services: {
      eyebrow: '',
      question: 'S čím mi pomůžete a kolik to stojí?',
      heading: 'S pěti věcmi. U každé hned vidíte, pro koho je, jak dlouho trvá a kolik zaplatíte.',
      helpTitle: 'Nevíte, co z toho potřebujete?',
      helpText: 'To je v pořádku, většina lidí to neví. Za půl hodiny po telefonu to zjistíme a nic za to neplatíte.',
    },
    projects: {
      question: 'A funguje to?',
      heading: 'Posuďte sami. Čtyři zakázky a co se u klientů změnilo měsíc po nasazení textů.',
      items: projectsWith((i) => ({ resultText: resultLines[i]!, done: longerDone[i]! })),
    },
    steps: {
      question: 'Jak to celé probíhá?',
      heading: 'Nejdřív se hodně ptám, psát začínám až potom. Od prvního hovoru po texty na webu to trvá obvykle tři týdny.',
      imageQuestion: '„A proč si lidé vybírají zrovna vás?“',
      imageCaption: 'Otázka, kterou položím každému. V dílně pana Habřiny, březen 2026.',
      items: [
        { title: 'První hovor', when: 'Den první', text: 'Třicet minut po telefonu nebo online, zdarma. Řeknete mi, co prodáváte a co nefunguje. Do dvou pracovních dnů pošlu cenu a termín.' },
        { title: 'Rozhovory', when: '1. týden', text: 'Hodinu a půl mluvím s vámi, potom se dvěma nebo třemi vašimi zákazníky. Z jejich slov vzniká většina textů.' },
        { title: 'První verze a úpravy', when: '2.–3. týden', text: 'Texty máte ve sdíleném dokumentu. Připomínky píšete přímo do nich, v ceně jsou dvě kola úprav.' },
        { title: 'Kontrola na webu', when: 'Po měsíci', text: 'Hotové texty si přečtu ještě jednou nasazené. Po měsíci se spolu podíváme na čísla a doladíme, co nesedí.' },
      ],
    },
    testimonials: {
      heading: 'Slovo mají klienti.',
      items: [
        sharedDemo.testimonials.items[0]!, sharedDemo.testimonials.items[1]!,
        { ...sharedDemo.testimonials.items[2]!, role: 'vedoucí podpory, e-shop Kolovna' },
      ],
    },
    about: {
      question: 'A kdo vlastně jste?',
      heading: 'Novinářka, která osm let chodila po dílnách, sklepech a kancelářích. Naučilo mě to ptát se a škrtat.',
      text: 'Do roku 2018 jsem psala do regionálního deníku, poslední čtyři roky o ekonomice a malých firmách. Zjistila jsem, že lidé, kteří svou práci umějí nejlíp, o ní často mluví nejhůř. Tak jsem jim s tím začala pomáhat.\n\nDnes pracuju na volné noze. Beru nejvýš tři zakázky najednou a každou píšu sama. Bydlím v Brně-Žabovřeskách se dvěma dětmi a jezevčíkem Kvidem, se kterým u přehrady vymýšlím většinu titulků.',
      imageCaption: '',
      timeline: [
        { when: '2006–2011', text: 'Žurnalistika na univerzitě v Brně' },
        { when: '2010–2018', text: 'Redaktorka regionálního deníku, ekonomická rubrika' },
        { when: 'Od 2018', text: 'Na volné noze, 140 dokončených zakázek' },
        { when: 'Od 2022', text: 'Učím psaní pro web v kurzech pro podnikatele' },
      ],
    },
    articles: {
      question: 'Co si mám přečíst, než se ozvu?',
      heading: 'Třeba tohle. Na blog píšu dvakrát do měsíce o tom, jak mluvit o vlastní firmě srozumitelně.',
      text: '',
    },
    contact: {
      question: 'Tak kdy si zavoláme?',
      heading: 'Klidně ještě tento týden. Hovor trvá 30 minut, je zdarma a k ničemu vás nezavazuje.',
      formTitle: 'Napište mi pár vět a domluvíme čas.',
    },
  },
}
