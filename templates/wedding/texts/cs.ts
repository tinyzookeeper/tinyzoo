// Every Czech text of the Wedding template, in one place: the website's own words (what is
// not content: "Kdy", "Rezervovat", the anchors of the sections) and the demo content the seed
// puts in. Another language is a file beside this one with the same two exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'

export interface Words extends KitWords {
  /** The word between two names: "Anežka a Šimon". */
  and: string
  /** The monogram's label for screen readers. */
  toTop: (names: string) => string
  when: string
  where: string
  reply: string
  /** "obřad začíná ve 12.30" */
  ceremonyStarts: (time: string) => string
  /** "obřad ve 12.30" */
  ceremonyAt: (time: string) => string
  /** "Odpovězte nám, prosíme, do 30. dubna 2027" */
  replyBy: (date: string) => string
  /** "Odpověď do 30. dubna 2027" */
  replyUntil: (date: string) => string
  /** "Odpověď do" */
  replyUntilLabel: string
  /** "do 30. dubna 2027" */
  until: (date: string) => string
  byFormBelow: string
  address: string
  openMap: string
  /** The north mark of the drawn map: "S ↑". */
  north: string
  reserve: string
  reserved: string
  reserveFailed: string
  writeUs: string
  photosOf: (names: string) => string
  /** The addresses of the sections on a page (`/#program`), by block type. */
  anchors: Record<'invitation' | 'story' | 'programme' | 'place' | 'lodging' | 'rsvp' | 'gifts' | 'questions' | 'contacts' | 'gallery', string>
}

// "ve 12.30", "v 11.00": Czech says "ve" before two, three, four, twelve to fourteen and twenty onwards.
const at = (time: string): string => {
  const hour = Number.parseInt(time, 10)
  return [2, 3, 4, 12, 13, 14, 20, 21, 22, 23].includes(hour) ? 've' : 'v'
}

export const words: Words = {
  ...KIT_WORDS.cs,
  and: 'a',
  toTop: (names) => `${names}, na začátek stránky`,
  when: 'Kdy', where: 'Kde', reply: 'Odpověď',
  ceremonyStarts: (time) => `obřad začíná ${at(time)} ${time}`,
  ceremonyAt: (time) => `obřad ${at(time)} ${time}`,
  replyBy: (date) => `Odpovězte nám, prosíme, do ${date}`,
  replyUntil: (date) => `Odpověď do ${date}`,
  replyUntilLabel: 'Odpověď do',
  until: (date) => `do ${date}`,
  byFormBelow: 'formulářem níže',
  address: 'Adresa', openMap: 'Otevřít v mapách', north: 'S ↑',
  reserve: 'Rezervovat', reserved: 'Zamluveno', reserveFailed: 'Rezervace se nepovedla. Zkuste to prosím znovu.',
  writeUs: 'Napište nám',
  photosOf: (names) => `Fotografie: ${names}`,
  anchors: {
    invitation: 'pozvanka', story: 'pribeh', programme: 'program', place: 'misto', lodging: 'ubytovani',
    rsvp: 'ucast', gifts: 'dary', questions: 'otazky', contacts: 'svedci', gallery: 'galerie',
  },
  defaultName: 'Naše svatba',
}

// ── the demo content: the fictional couple Anežka and Šimon, marrying on a farm in the
//    Vysočina highlands. The village, the people, the phone numbers and the addresses are
//    invented; the photographs are an engagement afternoon on the same meadow. ──
export const demo = {
  settings: {
    siteName: 'Anežka a Šimon',
    venueName: 'Statek U Staré lípy',
    venueArea: 'Sedmilípy u Sněžného, Vysočina',
    address: 'Sedmilípy 14, 592 03 Sněžné',
    coordinates: '49.6402 N · 16.0617 E',
    mapUrl: 'https://mapy.example/statek-u-stare-lipy',
    ctaLabel: 'Potvrdit účast',
    email: 'svatba@anezkaasimon.example',
    closing: 'Těšíme se na vás.',
    metaDescription: 'Svatba Anežky a Šimona, sobota 19. června 2027, Statek U Staré lípy v Sedmilípách na Vysočině. Program, doprava, ubytování a potvrzení účasti.',
  },
  menu: { story: 'Náš příběh', programme: 'Program', place: 'Místo a doprava', gifts: 'Dary', questions: 'Otázky' },
  home: { title: 'Úvod' },
  invitation: {
    eyebrow: 'S radostí vás zveme na naši svatbu',
    greeting: 'Milí rodiče, sourozenci a přátelé,',
    lead: 'po sedmi letech jsme se rozhodli říct si ano a chceme u toho mít právě vás.',
    text: 'Na této stránce najdete vše, co se vám bude hodit: kdy a kam přijet, kde přespat a jak nám dát vědět, že dorazíte.',
    primaryLabel: 'Potvrdit účast',
    secondaryLabel: 'Program dne',
  },
  story: {
    eyebrow: 'Náš příběh',
    heading: 'Seznámil nás jeden *obsazený* vagon',
    parts: [
      {
        label: 'Říjen 2019 · rychlík Brno – Žďár nad Sázavou',
        text: 'Šimon seděl na Anežčině místě a tvrdil, že místenka platí až od Tišnova. Do Tišnova se dohadovali, do Žďáru si povídali a na nástupišti si vyměnili čísla. První rande bylo hned další pátek: procházka kolem Zelené hory, která skončila až za tmy.',
        caption: 'Devět skal, to ráno, kdy v termosce nebyl čaj',
      },
      {
        label: 'Září 2025 · Devět skal',
        text: 'Na východ slunce jsme vyrazili ve čtyři ráno. Šimon nesl termosku, ve které místo čaje chrastil prstýnek. Anežka řekla ano dřív, než stačil pokleknout, a pro čaj jsme pak museli dolů do Křižánek.',
        caption: 'Louka u Sedmilíp, červen 2026',
      },
    ],
    closing: 'Od té doby plánujeme. A od soboty 19. června už jen společně.',
    wideCaption: 'Louka nad Sedmilípami, loni v červnu, rok před svatbou',
  },
  programme: {
    heading: 'Průběh dne',
    text: 'Časy bereme vážně jen do obřadu. Potom už se řídíme tím, jak nám bude.',
    photos: [
      { label: '12.30', caption: 'Tady si řekneme ano. Lípě je prý přes dvě stě let.' },
      { label: '19.00', caption: 'Stodola, kde se bude večer jíst a tančit.' },
    ],
    items: [
      { time: '11.30', title: 'Příjezd a přivítání', text: 'Bezová limonáda, koláčky a čas najít si místo. Autobus z Nového Města přijíždí v 11.25.' },
      { time: '12.30', title: 'Obřad pod lípou', text: 'Na louce za stodolou. Trvá asi půl hodiny a židle jsou pro všechny.' },
      { time: '13.15', title: 'Gratulace a společná fotografie', text: 'Nejdřív jedna velká se všemi, potom rodiny a kamarádi.' },
      { time: '14.00', title: 'Svatební oběd', text: 'Hovězí vývar s játrovými knedlíčky a hlavní chod, který si vyberete ve formuláři.' },
      { time: '16.00', title: 'Dort a káva', text: 'Dort peče Anežčina babička Marie. K němu koláče a káva z moka konvic.' },
      { time: '17.00', title: 'Odpoledne na louce', text: 'Pétanque, kubb, houpací sítě. Kdo chce, projde se k rybníku, je to deset minut.' },
      { time: '19.00', title: 'První tanec', text: 'Ve stodole. Chodili jsme do tanečních, držte nám palce.' },
      { time: '20.00', title: 'Večerní raut, kapela a tanec', text: 'Griluje se na dvoře a hraje kapela. Po půlnoci pouštíme písničky, které nám napíšete.' },
      { time: '23.00', title: 'Noční guláš', text: 'Z kotlíku, s chlebem. Vaří Šimonův táta.' },
      { time: '2.00', title: 'Poslední písnička', text: 'Poslední autobus do Nového Města odjíždí ve 2.15.' },
    ],
  },
  place: {
    eyebrow: 'Místo a doprava',
    heading: 'Statek U Staré lípy',
    text: 'Bývalý selský dvůr na konci Sedmilíp, mezi loukami pod Žákovou horou. Obřad, oběd i večer se odehrají na jednom místě, nikam se nepřejíždí.',
    lindenCaption: 'Pod lípou si řekneme ano. Je jí prý přes dvě stě let.',
    notes: [
      { label: 'Autem', text: 'Z Brna asi hodinu a dvacet minut přes Tišnov a Nové Město na Moravě, z Prahy dvě a čtvrt hodiny po D1 a přes Žďár nad Sázavou. Od silnice ve Sněžném bude cesta značená bílými fáborky.' },
      { label: 'Parkování', text: 'Na posečené louce před statkem, šedesát míst, zdarma. Auto tam může zůstat do neděle do oběda.' },
      { label: 'Svatební autobus', text: 'Jezdí zdarma od vlakového nádraží v Novém Městě na Moravě a staví i u hotelu ve Fryšavě. Místo si zamluvte ve formuláři.', firstLabel: 'Tam', firstValue: '11.00', secondLabel: 'Zpět', secondValue: '0.30 a 2.15' },
    ],
  },
  lodging: {
    eyebrow: 'Ubytování',
    heading: 'Kde přespat',
    text: 'Na statku spí rodina a svědci. Pro ostatní jsme vybrali tři místa poblíž. Zamluvte si je, prosíme, sami a včas: v červnu bývá na Vysočině plno.',
    items: [
      { name: 'Penzion Na Samotíně', distance: '1,5 km', distanceNote: 'od statku', description: 'Osm pokojů, snídaně v ceně. Pěšky dvacet minut přes louku.', price: '790 Kč / osoba', linkLabel: 'Web penzionu', linkUrl: 'https://penzion-na-samotine.example' },
      { name: 'Hotel U Tří smrků, Fryšava', distance: '4 km', distanceNote: 'od statku', description: 'Dvoulůžkové pokoje se snídaní. Staví tu svatební autobus.', price: '1 900 Kč / pokoj', linkLabel: 'Web hotelu', linkUrl: 'https://hotel-u-tri-smrku.example' },
      { name: 'Louka za stodolou', distance: 'Na místě', distanceNote: 'za stodolou', description: 'Pro stany a karavany. Sprchy a záchody jsou na statku.', price: 'zdarma', linkLabel: 'Napsat nám' },
    ],
  },
  rsvp: {
    eyebrow: 'Potvrzení účasti',
    heading: 'Dejte nám vědět, zda *přijedete*',
    text: 'Prosíme o odpověď do pátku 30. dubna 2027. Jeden formulář stačí za celou rodinu.',
    meals: ['Svíčková na smetaně s knedlíkem', 'Pstruh na másle s novým bramborem', 'Houbové rizoto (bez masa)', 'Každý jinak, napíšeme do vzkazu'],
    busLabel: 'Chceme místo ve svatebním autobuse z Nového Města na Moravě',
  },
  gifts: {
    eyebrow: 'Svatební dary',
    heading: 'Kdybyste nám chtěli udělat *radost*',
    text: 'Největším darem je, že přijedete. Domácnost už máme zařízenou, a tak jsme sepsali jen pár přání. Rezervace je anonymní: uvidíme pouze, že je dar zamluvený, ne kým.',
    imageCaption: 'Květiny prosíme nenoste, louka jich bude plná.',
    openLabel: 'Přání první',
    items: [
      { name: 'Svatební cesta na Lofoty', description: 'V září vyrážíme na tři týdny karavanem po Norsku. Přispět můžete libovolnou částkou na účet 123456789/0000 nebo do kasičky ve stodole.', open: true, buttonLabel: 'Přispět na cestu' },
      { name: 'Lehký stan pro dva', description: 'Ten starý nám loni na Šumavě odnesl vítr.', price: 8900, reserved: true },
      { name: 'Litinový hrnec, 4,5 litru', description: 'Na guláš pro osm a nedělní polévky.', price: 3200 },
      { name: 'Dvě jabloně na zahradu', description: 'Staré odrůdy z ovocné školky, zasadíme je na podzim.', price: 1400 },
      { name: 'Pákový kávovar', description: 'Šimon slibuje, že pak bude vstávat první.', price: 7400, reserved: true },
      { name: 'Gramofon', description: 'Desky po dědovi máme, gramofon ne.', price: 6500 },
      { name: 'Kurz keramiky pro dva', description: 'Víkend na hrnčířském kruhu v Novém Městě.', price: 2800 },
    ],
  },
  questions: {
    eyebrow: 'Praktické otázky',
    heading: 'Na co se nás ptáte',
    items: [
      { question: 'Co si vzít na sebe?', answer: 'Slavnostně, ale pohodlně. Obřad i odpoledne jsou na louce, jehlové podpatky se boří. Večer bývá ve stodole chladněji, přibalte si svetr nebo sako. Bílou nechte nevěstě.' },
      { question: 'Můžeme přijet s dětmi?', answer: 'Rádi je uvidíme. Od 14 do 20 hodin se o ně na louce starají dvě hlídací tety, děti mají vlastní stůl a dětské menu. Počet a věk nám napište do formuláře.' },
      { question: 'Co když bude pršet?', answer: 'Obřad přesuneme do stodoly a oběd pod velký stan na dvoře. Deštníky budou připravené u vchodu a holínky nejsou žádná ostuda.' },
      { question: 'Smíme fotografovat?', answer: 'Při obřadu prosíme telefony do kapsy, fotí náš fotograf. Po zbytek dne foťte, co se dá. Odkaz na společné album pošleme po svatbě.' },
      { question: 'Můžeme vzít psa?', answer: 'Náš Kmín tam bude také, takže ano. Jen na vodítku a mimo stodolu, kde se bude jíst.' },
      { question: 'Do kdy se bude slavit?', answer: 'Hudba hraje do dvou do rána. V neděli v deset je na statku společná snídaně pro všechny, kdo zůstanou.' },
    ],
  },
  contacts: {
    eyebrow: 'V den svatby',
    heading: 'S čímkoli volejte svědkům',
    text: 'My dva budeme mít v sobotu telefony vypnuté. Tereza a Ondra vědí o všem a rádi pomohou.',
    // (numbers no phone has: Czech numbers do not start with 1)
    items: [
      { name: 'Tereza Malá', role: 'Svědkyně nevěsty', note: 'program, ubytování, děti', phone: '123 456 781' },
      { name: 'Ondřej Kratochvíl', role: 'Svědek ženicha', note: 'autobus, parkování, cesta', phone: '123 456 782' },
    ],
  },
  gallery: {
    eyebrow: 'Fotografie',
    heading: 'My dva, loni v červnu',
    text: 'Fotografie ze zásnubního odpoledne v Sedmilípách.',
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    hero: 'Anežka a Šimon jdou ruku v ruce rozkvetlou loukou',
    coupleClose: 'Anežka a Šimon se smějí pod větvemi staré lípy',
    coupleBlanket: 'Anežka a Šimon sedí na dece na louce s hrnky',
    coupleRocks: 'Anežka a Šimon sedí na skále nad lesy při východu slunce',
    coupleAlley: 'Anežka a Šimon odcházejí ruku v ruce lipovou alejí',
    coupleBarn: 'Anežka a Šimon stojí před vraty staré stodoly a smějí se do objektivu',
    coupleDance: 'Šimon roztáčí Anežku na posečené louce',
    coupleEvening: 'Anežka a Šimon tančí za soumraku na dvoře statku pod šňůrami žárovek',
    venue: 'Statek U Staré lípy: bílé stavení s červenou střechou, dřevěná stodola a velká lípa na dvoře',
    barn: 'Stodola připravená na večer: dlouhé stoly, luční kvítí a žárovky pod trámy',
    linden: 'Místo obřadu: stará lípa, pod ní slavobrána z březových větví a řady dřevěných židlí',
    flowers: 'Kytice lučních květin v bílém smaltovaném džbánu',
    landscape: 'Večerní krajina Žďárských vrchů s rybníkem a loukami',
    table: 'Večerní stůl ve stodole: svíčky, luční kvítí a lněný běhoun',
  },
}
