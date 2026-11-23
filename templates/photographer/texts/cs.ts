// Every Czech text of the demo content the Photographer seed puts in: the fictional
// photographer Johana Loudová from Litomyšl. `demo` is the shared wording (the first look's,
// Ateliér's); `demoByLook` is what another look's design words differently: headings, the lines
// above them, texts, button and menu labels, captions. The seed lays them together
// (`demoFor(demo, demoByLook, look)`), so a site made in a look reads as that look's design does.
// (The website's own words that are not content, "Menu" or "Vše", are in app/utils/site.ts.)
//
// A list in an override replaces the shared one whole (the kit's `demoFor`), so a look that
// words one line of a list gives the list complete.
//
// Demo data is invented: a phone number no phone has (Czech numbers do not start with 1),
// addresses that lead nowhere, a street the town does not have.
import type { DemoOverride } from '../../kit/seed'
import type { PHOTOS } from '../seed/photos'

type PhotoKey = keyof typeof PHOTOS
/** Where a button of the demo leads: a page the seed makes, or the album of the story. */
type To = 'gallery' | 'contact' | 'pricing' | 'about' | 'album'

/** One picture of the story of a day: which photograph, its time and its caption. */
const shot = (photo: PhotoKey, time: string, caption: string) => ({ photo, time, caption })
const fact = (label: string, value: string) => ({ label, value })
const step = (title: string, text: string) => ({ title, text })
/** A photograph of an album with its caption (none: the picture has no caption). */
const pic = (photo: PhotoKey, caption = '') => ({ photo, caption })

export const demo = {
  settings: {
    siteName: 'Johana Loudová',
    tagline: 'Fotím svatby, portréty, rodiny a firmy v Litomyšli a východních Čechách.',
    ctaLabel: 'Poptat termín',
    availability: 'V květnu, červnu a září 2027 mám ještě volné termíny.',
    phone: '123 456 789',
    email: 'johana@loudova.example',
    address: 'Fotografická 14, Litomyšl',
    addressNote: 'po předchozí domluvě',
    instagram: 'https://instagram.example/johana.loudova',
    facebook: 'https://facebook.example/johana.loudova',
    companyId: '08412357',
    metaDescription: 'Svatby, portréty a rodinné fotografie z Litomyšle a východních Čech.',
  },

  // The menus: the main one and the footer's. (The legal links are the titles of their pages.)
  menu: {
    main: { gallery: 'Galerie', story: 'Jedna svatba', pricing: 'Ceník', about: 'O mně' },
    footer: { gallery: 'Galerie', pricing: 'Ceník', about: 'O mně', contact: 'Kontakt' },
  },

  categories: {
    weddings: { name: 'Svatby', description: 'Fotím celý den nebo jen obřad. Během dne se držím mezi hosty a do toho, co se děje, moc nezasahuji.' },
    portraits: { name: 'Portréty', description: 'V ateliéru s oknem na sever, u vás doma nebo venku.' },
    families: { name: 'Rodina', description: 'Miminka fotím nejraději u vás doma. Se staršími dětmi můžeme vyrazit ven.' },
    business: { name: 'Firemní', description: 'Portréty a reportáže z dílen, ateliérů a provozoven.' },
  },

  // The albums, by key. A date puts an album in the gallery's mix (newer first) and the photographs
  // are in the order of the album; a caption is what a look writes under the picture in the
  // gallery (the albums with one photograph have none).
  albums: {
    annaVojta: {
      title: 'Anna a Vojta', place: 'Budislav', date: '2026-08-21T22:00:00Z',
      summary: 'Anna na statku v Budislavi trávila prázdniny. S Vojtou se tam vzali pod lípou, večeřeli v sadu a večer tančili ve stodole.',
      photos: [
        pic('weddingCeremony', 'Obřad pod lípou'), pic('weddingTable', 'Tabule v sadu'), pic('weddingCouple', 'Mezi jabloněmi'),
        pic('weddingGettingReady', 'Před obřadem'), pic('weddingDance', 'První tanec'), pic('weddingMeadow', 'Louka za statkem'),
      ],
    },
    marketa: { title: 'Markéta', place: 'ateliér', date: '2026-07-13T22:00:00Z' },
    matyas: { title: 'Matyáš, dvanáct dní', place: 'Vysoké Mýto', date: '2026-06-27T22:00:00Z' },
    ceramics: { title: 'Keramická dílna Hany Peškové', place: 'Polička', date: '2026-06-09T22:00:00Z' },
    kubatovi: { title: 'Kubátovi v lese', place: 'Toulovcovy maštale', date: '2025-10-18T22:00:00Z' },
    eliska: { title: 'Eliška', place: 'pole u Sebranic', date: '2025-10-04T22:00:00Z' },
    rings: { title: 'Markéta a Ondřej', place: 'Litomyšl', date: '2025-09-12T22:00:00Z', caption: 'Prsteny' },
    architect: { title: 'Architektka Petra Dvořáková', place: 'Pardubice', date: '2025-05-21T22:00:00Z' },
    carpenter: { title: 'Pan Josef, truhlář', place: 'Dolní Újezd', date: '2025-04-07T22:00:00Z' },
    jana: { title: 'Jana a Toník', place: 'doma v Litomyšli', date: '2025-03-15T23:00:00Z' },
  },

  // The three packages, by key (their prices are in the seed).
  packs: {
    portrait: {
      name: 'Portrét a rodina', description: 'Focení venku, u vás doma nebo v ateliéru.',
      includes: ['1 až 1,5 hodiny focení', '30 upravených fotografií', 'Online galerie s možností stažení', '5 fotografií na papíře 13 × 18 cm', 'Předání do 14 dnů'],
    },
    halfDay: {
      name: 'Svatba · půlden', description: 'Obřad, gratulace, skupinové fotky a portréty.',
      includes: ['6 hodin focení', 'Schůzka nebo videohovor předem', '250 až 350 upravených fotografií', 'Online galerie pro vás i hosty', 'Předání do 6 týdnů'],
    },
    fullDay: {
      name: 'Svatba · celý den', description: 'Od příprav po první tanec.', highlightLabel: 'Od rána do večera',
      includes: ['12 hodin focení', 'Schůzka a obhlídka místa předem', '500 až 700 upravených fotografií', 'Online galerie pro vás i hosty', 'Krabička s 30 papírovými fotografiemi', 'Předání do 6 týdnů'],
    },
  },

  // What clients said, by key; the first is shown largest where a look does that.
  testimonials: {
    anna: { name: 'Anna a Vojta', occasion: 'svatba v Budislavi', text: 'Johanu jsme na svatbě skoro nevnímali, a přesto má fotku každého, na kom nám záleží. Babička si tu svou nechala zarámovat.' },
    marketa: { name: 'Markéta', occasion: 'portrét v ateliéru', text: 'Nerada se fotím. S Johanou jsme si povídaly u okna a já po chvíli na foťák zapomněla.' },
    kubatovi: { name: 'Kubátovi', occasion: 'rodinné focení', text: 'Děti v lese tahaly klacky a honily se v listí. Doma teď máme nad gaučem fotku, na které se smějí obě.' },
  },

  // The pages and their blocks. (A block's links lead where `…To` says.)
  home: {
    title: 'Úvod',
    metaDescription: 'Svatby, portréty a rodinné fotografie z Litomyšle a východních Čech. Svatby od 19 900 Kč, portrét a rodina od 3 900 Kč.',
    hero: {
      eyebrow: 'Fotografka · Litomyšl · od roku 2014',
      heading: 'Fotím, co se *opravdu stalo.*',
      text: 'Fotím svatby, portréty, rodiny a firmy ve východních Čechách. V ateliéru u okna, venku nebo u vás. Svatby od 19 900 Kč, portrét a rodina od 3 900 Kč.',
      captions: ['Anna a Vojta · Budislav, srpen 2026', 'Jana a Toník', 'Eliška'],
      primaryLabel: 'Prohlédnout galerii', primaryTo: 'gallery' as To,
      secondaryLabel: 'Zeptat se na termín', secondaryTo: 'contact' as To,
    },
    gallery: { eyebrow: 'Vybrané fotografie', heading: 'Galerie', text: '', allLabel: 'Všechna alba' },
    story: {
      eyebrow: 'Jeden den · svatba',
      heading: 'Anna a Vojta',
      facts: [fact('Kdy', '22. srpna 2026'), fact('Kde', 'statek v Budislavi'), fact('V albu', '6 fotografií')],
      text: 'Na statku v Budislavi se sešlo šedesát hostů. Přijela jsem po poledni, když se Anna chystala v pokoji po babičce, a zůstala jsem až do půlnoci.',
      photos: [
        shot('weddingGettingReady', '13.10', 'Pokoj po babičce a okno na sever'),
        shot('weddingCeremony', '15.00', 'Obřad pod lípou'),
        shot('weddingTable', '16.20', 'Tabule v sadu'),
        shot('weddingCouple', '18.40', 'Deset minut jen pro sebe'),
        shot('weddingDance', '21.30', 'První tanec ve stodole'),
      ],
      closing: 'V albu najdete i fotografii z louky za statkem.',
      buttonLabel: 'Celé album',
    },
  },

  pages: {
    gallery: { title: 'Galerie', metaDescription: 'Prohlédněte si alba ze svateb, rodinného focení, portrétů a práce pro firmy.', eyebrow: 'Všechna alba', heading: 'Galerie', text: 'Vyberte si kategorii nebo si prohlédněte všechna alba.' },
    pricing: { title: 'Ceník', metaDescription: 'Svatby od 19 900 Kč, portrét a rodina od 3 900 Kč. Co je v ceně a jak focení probíhá.' },
    about: { title: 'O mně', metaDescription: 'Johana Loudová, fotografka z Litomyšle. Svatby a portréty fotím od roku 2014.' },
    contact: { title: 'Kontakt', metaDescription: 'Máte zájem o focení? Napište mi, kde a kdy by se vám hodilo.' },
  },

  pricing: {
    eyebrow: 'Balíčky',
    heading: 'Ceník',
    text: 'Ceny jsou konečné. Nejsem plátkyně DPH. Cesta do 50 km od Litomyšle je v ceně, dál účtuji 8 Kč za kilometr.',
    buttonLabel: 'Zeptat se na termín',
    footnote: 'Firemní portréty a reportáže z provozu stojí obvykle od 6 500 Kč za půlden. Cenu upřesním podle rozsahu focení.',
    footnoteLinkLabel: 'Napište mi, co potřebujete.',
  },

  about: {
    eyebrow: 'O mně',
    heading: 'Nejdřív se dívám. *Pak fotím.*',
    imageCaption: 'Johana Loudová, Litomyšl',
    text: [
      'Po studiu fotografie v Opavě jsem se vrátila domů do Litomyšle. Mám tu ateliér s oknem na sever. Venku ráda fotím na loukách u Sebranic.',
      'Na svatbě ráda fotím, co se děje stranou. Třeba když si po obřadu konečně sednete. U portrétů si nejdřív povídáme, pak beru do ruky foťák.',
    ],
    facts: [
      fact('Svatby', 'Nejvýš dvacet ročně, abych měla na každou čas.'),
      fact('Světlo', 'Denní. Nejraději hodinu před západem slunce.'),
      fact('Bert', 'Můj pes. Když fotíme rodinu venku, můžu ho vzít s sebou.'),
    ],
    signature: 'Johana',
  },

  testimonialsBlock: { eyebrow: '', heading: 'Napsali o focení' },

  steps: {
    eyebrow: 'Od první zprávy po galerii',
    heading: 'Jak to probíhá',
    items: [
      step('Napíšete mi', 'Napište, kdy a kde chcete fotit a co chystáte.'),
      step('Poznáme se', 'Sejdeme se v Litomyšli nebo si zavoláme. Probereme, kde budeme fotit a na čem vám záleží.'),
      step('Potvrdíme termín', 'Termín si rezervujete podpisem smlouvy a zaplacením zálohy ve výši 30 %.'),
      step('Focení a předání fotek', 'První ukázky posílám do týdne. Celou galerii předávám do 14 dnů, u svateb do 6 týdnů.'),
    ],
  },

  enquiry: {
    eyebrow: 'Poptávka',
    heading: 'Domluvme se *na focení.*',
    text: 'Napište mi, co chcete fotit, kdy a kde. Pokud mám volno, můžeme si krátce zavolat.',
    consent: 'Odesláním souhlasíte se *zpracováním osobních údajů*.',
  },

  // The text pages every site has. (Sample text: the owner replaces it before going public.)
  legal: {
    privacy: {
      title: 'Ochrana osobních údajů',
      intro: 'Ukázkový text. Před zveřejněním popište, jak s údaji klientů nakládáte vy.',
      parts: [
        { heading: 'Jaké údaje zpracovávám', text: 'Z formuláře mám vaše jméno, e-mail a zprávu. Když si objednáte focení, zpracovávám i fakturační údaje a vaše fotografie.' },
        { heading: 'Proč údaje potřebuji', list: ['abych vám mohla odpovědět', 'abych s vámi uzavřela smlouvu a vystavila fakturu', 'abych vám předala hotové fotografie'] },
        { heading: 'Jak dlouho je uchovávám', text: 'Pokud se na focení nedomluvíme, poptávku do půl roku smažu. Fotografie ukládám tři roky od předání, pokud se nedomluvíme jinak.' },
      ],
    },
    terms: {
      title: 'Obchodní podmínky',
      intro: 'Ukázkový text. Před zveřejněním sem vložte vlastní obchodní podmínky.',
      parts: [
        { heading: 'Rezervace termínu', text: 'Termín rezervuji po podpisu smlouvy a zaplacení zálohy ve výši 30 %. Zbytek ceny zaplatíte do sedmi dnů po focení.' },
        { heading: 'Zrušení a přesun', text: 'Termín můžete jednou přesunout bez poplatku, pokud mi dáte vědět alespoň 30 dnů předem. Pokud focení zrušíte, zálohu nevracím.' },
        { heading: 'Předání fotografií', text: 'Upravené fotografie najdete v online galerii. Termín předání je uvedený u každého balíčku.' },
      ],
    },
  },
}

// Where the designs word the demo differently. (Ateliér's design is the shared wording.)
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  // Negativ: a poster in capitals, a table of prices; short lines, "+" between names.
  negativ: {
    settings: {
      tagline: 'Svatby, portréty, rodiny a firmy. Litomyšl a východní Čechy.',
      availability: '15. 5. · 29. 5. · 12. 6. · 4. 9. · 18. 9.',
      addressNote: 'po domluvě',
    },
    menu: {
      main: { gallery: 'Práce', story: 'Jeden den' },
      footer: { gallery: 'Práce' },
    },
    categories: { business: { name: 'Firmy' } },
    albums: {
      annaVojta: {
        title: 'Anna + Vojta',
        photos: [
          pic('weddingCeremony', 'obřad pod lípou'), pic('weddingTable', 'tabule v sadu'), pic('weddingCouple'),
          pic('weddingGettingReady', 'přípravy'), pic('weddingDance', 'první tanec'), pic('weddingMeadow', 'Budislav · 8/2026'),
        ],
      },
      matyas: { title: 'Matyáš, 12 dní' },
      ceramics: { title: 'Keramika Hany Peškové' },
      kubatovi: { title: 'Kubátovi' },
      rings: { title: 'Markéta + Ondřej', caption: '' },
      architect: { title: 'Petra Dvořáková, architektka' },
      jana: { title: 'Jana + Toník' },
    },
    packs: {
      portrait: {
        name: 'Portrét + rodina', description: 'Hodina venku, u vás doma nebo v ateliéru.',
        includes: ['1–1,5 hod focení', '30 upravených fotografií', 'Online galerie ke stažení', '5 zvětšenin 13 × 18 cm', 'Hotovo do 14 dnů'],
      },
      halfDay: {
        name: 'Svatba, půlden',
        includes: ['6 hod focení', 'Schůzka nebo videohovor předem', '250–350 upravených fotografií', 'Online galerie pro vás i hosty', 'Hotovo do 6 týdnů'],
      },
      fullDay: {
        name: 'Svatba, celý den', highlightLabel: 'Nejčastější volba',
        includes: ['12 hod focení', 'Schůzka a obhlídka místa předem', '500–700 upravených fotografií', 'Online galerie pro vás i hosty', 'Krabička s 30 zvětšeninami', 'Hotovo do 6 týdnů'],
      },
    },
    testimonials: {
      anna: { name: 'Anna + Vojta', occasion: 'Svatba v Budislavi' },
      marketa: { occasion: 'Portrét v ateliéru', text: 'Nerada se fotím. Po deseti minutách jsem na foťák zapomněla a na těch fotkách jsem to konečně já.' },
      kubatovi: { occasion: 'Rodinné focení', text: 'Se dvěma malými dětmi jsme čekali chaos. Byla z toho procházka lesem a fotky přes celou zeď v obýváku.' },
    },
    home: {
      hero: {
        heading: 'Fotím, co se opravdu stalo.',
        text: 'Svatby, portréty, rodiny a firmy ve východních Čechách. Bez póz a na světlo, které zrovna je. Svatby od 19 900 Kč.',
        primaryLabel: 'Podívat se na práci',
        secondaryLabel: 'Zeptat se na jiný den',
      },
      gallery: { eyebrow: 'Vyberte kategorii', heading: 'Práce' },
      story: {
        heading: 'Anna + Vojta',
        facts: [fact('Kdy', '22. 8. 2026, 13.10–23.50'), fact('Kde', 'Statek v Budislavi'), fact('Hostů', '60'), fact('Snímků', '6 v albu')],
        text: 'Šedesát lidí na statku, kde Anna jako malá trávila prázdniny. Byla jsem tam od jedné odpoledne do půlnoci a nikoho jsem nikam nestavěla.',
        photos: [
          shot('weddingGettingReady', '13.10', 'Přípravy, okno na sever'),
          shot('weddingCeremony', '15.00', 'Obřad pod lípou'),
          shot('weddingTable', '16.20', 'Tabule v sadu'),
          shot('weddingCouple', '18.40', 'Deset minut pro sebe'),
          shot('weddingMeadow', '19.50', 'Louka za statkem'),
          shot('weddingDance', '21.30', 'První tanec'),
        ],
        closing: '',
        buttonLabel: 'Celé album, 6 snímků',
      },
    },
    pages: {
      gallery: { heading: 'Práce' },
    },
    pricing: {
      eyebrow: '',
      text: 'Ceny jsou konečné, nejsem plátce DPH. Cesta do 50 km od Litomyšle je v ceně, dál 8 Kč za kilometr.',
      footnote: 'Firemní portréty a reportáže z dílen a provozoven nacením podle rozsahu, obvykle od 6 500 Kč za půlden.',
      footnoteLinkLabel: 'Napsat, co potřebujete',
    },
    about: {
      heading: 'Držím se zpátky a dívám se.',
      imageCaption: '',
      text: [
        'Jsem Johana. Vyrostla jsem v Litomyšli a po studiu fotografie v Opavě jsem se sem vrátila. Mám tu ateliér s oknem na sever a krajinu, kterou znám nazpaměť.',
        'Nikoho nearanžuji. Na svatbě hlídám chvíle, které se nedají zopakovat. U portrétů si nejdřív povídáme a foťák vytáhnu, až když na něj zapomenete.',
      ],
      facts: [fact('Fotím od', '2014'), fact('Základna', 'Litomyšl, jezdím po celé ČR'), fact('Svateb ročně', 'nejvýš 20'), fact('Světlo', 'denní, blesk jen na parketu')],
      signature: '',
    },
    testimonialsBlock: { eyebrow: 'Reference', heading: 'Řekli po focení' },
    steps: {
      eyebrow: 'Od zprávy po galerii',
      heading: 'Jak to běží',
      items: [
        step('Napíšete', 'Termín, místo a pár vět o tom, co chystáte. Odpovídám do dvou pracovních dnů.'),
        step('Potkáme se', 'U kávy v Litomyšli nebo přes videohovor. Projdeme den a místa.'),
        step('Záloha 30 %', 'Se smlouvou. Od té chvíle je datum vaše a nikomu jinému ho nedám.'),
        step('Fotíme', 'Do týdne první ukázky. Celá galerie do 14 dnů, svatby do 6 týdnů.'),
      ],
    },
    enquiry: {
      eyebrow: '',
      heading: 'Napište.',
      text: 'Stačí pár vět. Ozvu se do dvou pracovních dnů a domluvíme krátký hovor.',
    },
  },

  // Zápisník: the photographer's own album; she talks to you, and the notes are handwritten
  // (so they are lowercase sentences).
  zapisnik: {
    settings: {
      tagline: 'Svatby, portréty, rodiny a firemní focení. Litomyšl a východní Čechy.',
      ctaLabel: 'Napsat mi',
      availability: 'na rok 2027 mám ještě volno v květnu, červnu a září',
    },
    menu: {
      main: { gallery: 'Fotky', story: 'Jeden den' },
      footer: { gallery: 'Fotky' },
    },
    albums: {
      // The design lays its prints out in an order of its own: the album's order and three
      // dates are set so the gallery's mix (a rule, newest album first) comes out in the same
      // shapes, wide, tall and square in turn, and its rows are as the design's.
      annaVojta: {
        photos: [
          pic('weddingCeremony', 'obřad pod lípou'), pic('weddingCouple', 'Anna + Vojta'), pic('weddingTable', 'tabule v sadu'),
          pic('weddingDance', 'první tanec ve stodole'), pic('weddingGettingReady', 'ráno před obřadem'), pic('weddingMeadow', 'louka za statkem'),
        ],
      },
      matyas: { title: 'Matyáš, 12 dní' },
      eliska: { date: '2025-02-08T23:00:00Z' },
      ceramics: { title: 'Hana, keramička z Poličky' },
      kubatovi: { title: 'Kubátovi, Toulovcovy maštale' },
      rings: { title: 'Markéta + Ondřej', caption: '', date: '2025-01-18T23:00:00Z' },
      architect: { title: 'Petra, architektka' },
      carpenter: { title: 'pan Josef, truhlář', date: '2025-11-05T23:00:00Z' },
    },
    packs: {
      halfDay: { name: 'Svatba na půl dne', includes: ['6 hodin focení', 'Schůzka nebo videohovor předem', '250 až 350 upravených fotografií', 'Online galerie pro vás i hosty', 'Hotovo do 6 týdnů'] },
      portrait: { name: 'Portrét a rodina', includes: ['1 až 1,5 hodiny focení', '30 upravených fotografií', 'Online galerie ke stažení', '5 zvětšenin 13 × 18 cm', 'Hotovo do 14 dnů'], description: 'Hodina venku, u vás doma nebo v ateliéru.' },
      fullDay: {
        name: 'Svatba na celý den', highlightLabel: 'berou skoro všichni',
        includes: ['12 hodin focení', 'Schůzka a obhlídka místa předem', '500 až 700 upravených fotografií', 'Online galerie pro vás i hosty', 'Krabička s 30 zvětšeninami', 'Hotovo do 6 týdnů'],
      },
    },
    testimonials: {
      marketa: { text: 'Nerada se fotím. Po deseti minutách jsem na foťák zapomněla a na těch fotkách jsem to konečně já.' },
      kubatovi: { text: 'Se dvěma malými dětmi jsme čekali chaos. Byla z toho procházka lesem a fotky přes celou zeď v obýváku.' },
    },
    home: {
      hero: {
        eyebrow: 'ahoj, tady Johana',
        heading: 'Fotím lidi, kteří tvrdí, že se fotit neumí.',
        text: 'Svatby, portréty a rodiny v Litomyšli a okolí. Žádné „a teď se na sebe zamilovaně podívejte“. Spíš procházka, při které občas cvakne spoušť.',
        primaryLabel: 'Napsat o termín', primaryTo: 'contact',
        secondaryLabel: 'Kolik to stojí', secondaryTo: 'pricing',
      },
      gallery: {
        eyebrow: '', heading: 'Co fotím nejčastěji',
        text: 'Lidi. Na svatbách, doma v obýváku, v lese za městem i v dílně, kde vydělávají na chleba.',
      },
      story: {
        eyebrow: 'sobota 22. srpna 2026',
        heading: 'Jeden den s Annou a Vojtou',
        facts: [],
        text: 'Svatba pro šedesát lidí na statku v Budislavi, kde Anna jako malá trávila prázdniny. Tady je šest zastávek z mého deníku. V albu je fotek přesně šest.',
        photos: [
          shot('weddingGettingReady', '13.10', 'Anna se obléká v pokoji po babičce. Okno na sever, nejhezčí světlo dne.'),
          shot('weddingCeremony', '15.00', 'Obřad pod lípou. Vojta se dvakrát přeřekl a smál se celý sad.'),
          shot('weddingTable', '16.20', 'Tabule mezi jabloněmi. Kytky natrhaly družičky ráno na louce.'),
          shot('weddingCouple', '18.40', 'Ukradla jsem si je na deset minut. Víc není potřeba.'),
          shot('weddingMeadow', '19.50', 'Louka za statkem. Tohle světlo trvá čtyři minuty a pak je pryč.'),
          shot('weddingDance', '21.30', 'První tanec ve stodole. Blesk nechávám v tašce.'),
        ],
        closing: '',
        buttonLabel: 'Prohlédnout celé album',
      },
    },
    pages: {
      gallery: { eyebrow: 'všechna alba', heading: 'Fotky' },
    },
    pricing: {
      eyebrow: 'na rovinu',
      heading: 'Kolik to stojí',
      text: 'Ceny jsou konečné, nejsem plátce DPH. Cesta do 50 km od Litomyšle je v ceně, dál počítám 8 Kč za kilometr.',
      footnote: 'Fotím i pro firmy a řemeslníky: portréty, dílny, provozovny. Nacením podle rozsahu, obvykle od 6 500 Kč za půlden.',
    },
    about: {
      eyebrow: '',
      heading: 'Jsem Johana a fotím od roku 2014.',
      imageCaption: 'to jsem já. Fotil mě manžel, výjimečně',
      text: [
        'Vyrostla jsem v Litomyšli a po studiu fotografie v Opavě jsem se sem vrátila. Mám tu malý ateliér s oknem na sever a kolem sebe krajinu, kterou znám nazpaměť.',
        'Nikoho nearanžuji do póz. Na svatbě se držím zpátky a hlídám chvíle, které se nedají zopakovat. U portrétů si nejdřív povídáme a foťák vytáhnu, až když na něj zapomenete.',
      ],
      facts: [
        fact('svatby', 'Nejvýš dvacet ročně, abych měla na každou čas.'),
        fact('světlo', 'Denní. Nejradši hodinu před západem slunce.'),
        fact('Bert', 'Můj pes. Na rodinná focení chodí se mnou a děti ho milují.'),
      ],
      signature: '',
    },
    testimonialsBlock: { heading: 'Co mi napsali, když dostali fotky' },
    steps: {
      eyebrow: '',
      heading: 'Jak to celé probíhá',
      items: [
        step('Napíšete mi', 'Termín, místo a pár vět o tom, co chystáte. Odpovídám do dvou pracovních dnů.'),
        step('Dáme si kávu', 'V Litomyšli nebo přes videohovor. Projdeme den, místa a co je pro vás důležité.'),
        step('Potvrdíme termín', 'Smlouvou a zálohou 30 %. Od té chvíle je datum vaše a nikomu jinému ho nedám.'),
        step('Fotíme a máte galerii', 'Do týdne pošlu první ukázky. Celou galerii do 14 dnů, u svateb do 6 týdnů.'),
      ],
    },
    enquiry: {
      eyebrow: 'tak co, půjdeme do toho?',
      heading: 'Napište mi',
      text: 'Stačí pár vět. Ozvu se do dvou pracovních dnů, a jestli je termín volný, domluvíme si krátký hovor.',
    },
  },
}
