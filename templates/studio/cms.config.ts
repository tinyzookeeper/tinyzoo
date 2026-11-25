import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Studio template: what a dance, yoga or fitness studio can write and
// change. One model for all three looks (looks.ts): a look decides how a block is drawn, never
// what it holds. The timetable is data (the Lessons collection); each look draws it its own way.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou.',
  en: 'Text between *asterisks* stands out, for example in italics.',
}

// ── the whole site: who, where, how to reach us ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The studio’s name, contacts, address, opening hours, the look and the colours.', cs: 'Název studia, kontakty, adresa, časy, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'tagline', 'logo', 'look', 'colors'] },
      { label: { en: 'Contacts', cs: 'Kontakty' }, fields: ['phone', 'email', 'instagram', 'facebook'] },
      { label: { en: 'Address and hours', cs: 'Adresa a časy' }, fields: ['street', 'zip', 'city', 'addressNote', 'mapUrl', 'hours'] },
      { label: { en: 'Header and footer', cs: 'Záhlaví a zápatí' }, fields: ['ctaLabel', 'ctaLongLabel', 'ctaUrl', 'about', 'legalName', 'companyId'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the studio', cs: 'Název studia' })
      .help({ en: 'The short name that stands in the header and the footer, for example “Osnova”.', cs: 'Krátký název, který stojí v záhlaví a v zápatí, například „Osnova“.' }),
    tagline: f.text().optional().label({ en: 'What it is, in a word or two', cs: 'Co to je, pár slovy' })
      .help({ en: 'Hall writes it small beside the name in the header, for example “movement studio”. The other looks do not show it.', cs: 'Sál ji napíše malým písmem vedle názvu v záhlaví, například „pohybové studio“. Ostatní vzhledy ji nezobrazí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the name.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo názvu.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    instagram: f.text({ format: 'url' }).optional().label({ en: 'Instagram', cs: 'Instagram' }),
    facebook: f.text({ format: 'url' }).optional().label({ en: 'Facebook', cs: 'Facebook' }),
    street: f.text().optional().label({ en: 'Street and number', cs: 'Ulice a číslo' }),
    zip: f.text().optional().label({ en: 'Postcode', cs: 'PSČ' }),
    city: f.text().optional().label({ en: 'Town', cs: 'Město' }),
    addressNote: f.text().optional().label({ en: 'Where in the building', cs: 'Kde v budově' })
      .help({ en: 'For example “2nd floor, entrance from the yard”.', cs: 'Například „2. patro, vchod ze dvora“.' }),
    mapUrl: f.text({ format: 'url' }).optional().label({ en: 'Link to a map', cs: 'Odkaz do mapy' }),
    hours: f.text({ multiline: true }).optional().label({ en: 'Hours of the classes', cs: 'Časy lekcí' })
      .help({ en: 'One line for each group of days, for example “Mon–Fri 7:00–21:00”. They stand in the footer.', cs: 'Jeden řádek pro každou skupinu dnů, například „Po–Pá 7:00–21:00“. Stojí v zápatí.' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaLongLabel: f.text().optional().label({ en: 'Button text in the phone menu', cs: 'Text tlačítka v mobilním menu' })
      .help({ en: 'A longer sentence for the phone’s menu. Left empty, the header button’s text is used.', cs: 'Delší věta do menu na telefonu. Když pole necháte prázdné, použije se text tlačítka v záhlaví.' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    about: f.text({ multiline: true }).optional().label({ en: 'About the studio, for the footer', cs: 'O studiu do zápatí' })
      .help({ en: 'Two sentences under the name in the footer.', cs: 'Dvě věty pod názvem v zápatí.' }),
    legalName: f.text().optional().label({ en: 'Company name', cs: 'Název firmy' })
      .help({ en: 'For the line at the very bottom, after the year.', cs: 'Do řádku úplně dole, za rokem.' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── kinds of classes: yoga, pilates, ballet… ──
export const LessonKind = defineEntity('lessonKind', {
  label: { en: 'Kinds of classes', cs: 'Druhy lekcí' },
  labelSingular: { en: 'Kind of class', cs: 'Druh lekce' },
  description: { en: 'Yoga, pilates, ballet… Each has a short description and a photo. In Blanket, every kind has its own colour in the order of this list. Drag to change the order.', cs: 'Jóga, pilates, balet… Každý druh má krátký popis a fotografii. Ve vzhledu Deka má každý druh svou barvu podle pořadí v tomto seznamu. Pořadí změníte přetažením.' },
  icon: 'i-lucide-layers',
  titleField: 'name',
  admin: { list: { columns: ['name', 'shortName', 'duration'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    shortName: f.text().label({ en: 'Short name', cs: 'Krátký název' })
      .help({ en: 'For the filter buttons of the timetable, for example “Children” for “Dance for children”.', cs: 'Pro tlačítka filtru v rozvrhu, například „Děti“ místo „Tanec pro děti“.' }),
    summary: f.text({ multiline: true }).label({ en: 'Short text', cs: 'Krátký text' }),
    audience: f.text().label({ en: 'Who it is for', cs: 'Pro koho' }),
    levelNote: f.text().label({ en: 'Level', cs: 'Úroveň' }).help({ en: 'For example “beginners and intermediate”.', cs: 'Například „začátečníci a mírně pokročilí“.' }),
    duration: f.text().label({ en: 'Length', cs: 'Délka' }).help({ en: 'For example “60–75 minutes”.', cs: 'Například „60–75 minut“.' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['image'] },
})

// ── instructors ──
export const Instructor = defineEntity('instructor', {
  label: { en: 'Instructors', cs: 'Lektoři' },
  labelSingular: { en: 'Instructor', cs: 'Lektor' },
  description: { en: 'The people who teach: a portrait, what they teach and a few words about them.', cs: 'Lidé, kteří učí: portrét, co učí a pár slov o nich.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  admin: { list: { columns: ['name', 'label'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Portrait', cs: 'Portrét' })
      .help({ en: 'A portrait works best.', cs: 'Nejlépe na výšku.' }),
    teaches: f.relation({ to: () => LessonKind, kind: 'many-to-many' }).label({ en: 'Teaches', cs: 'Co učí' })
      .help({ en: 'Blanket colours the instructor’s portrait and tags with the kinds chosen here.', cs: 'Vzhled Deka podle vybraných druhů obarví portrét a štítky lektora.' }),
    label: f.text().label({ en: 'What they teach, in a line', cs: 'Co učí, v jednom řádku' })
      .help({ en: 'For example “Yoga · Healthy back”. Parts are separated by a dot; Blanket sets each as a tag.', cs: 'Například „Jóga · Zdravá záda“. Části oddělte tečkou uprostřed; Deka z každé udělá štítek.' }),
    bio: f.text({ multiline: true }).label({ en: 'A few words', cs: 'Pár slov' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo', 'teaches'] },
})

// ── the weekly timetable: one entry is one class in the week ──
export const Lesson = defineEntity('lesson', {
  label: { en: 'Timetable', cs: 'Rozvrh' },
  labelSingular: { en: 'Class', cs: 'Lekce' },
  description: { en: 'Every class of the week: the day, the time, the kind, the instructor and the room. The website draws it as a list, a board of today’s classes or coloured stripes, whichever look it has. The timetable runs Monday to Saturday.', cs: 'Každá lekce v týdnu: den, čas, druh, lektor a sál. Web z nich podle vzhledu nakreslí seznam, tabuli dnešních lekcí nebo barevné pruhy. Rozvrh platí od pondělí do soboty.' },
  icon: 'i-lucide-calendar-days',
  titleField: 'title',
  // (no hand-made order: the website sorts by day and time)
  admin: { list: { columns: ['title', 'day', 'start', 'end', 'kind', 'instructor', 'free'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Name of the class', cs: 'Název lekce' })
      .help({ en: 'It may differ from the kind: “Morning yoga”, “Pilates with a ball”.', cs: 'Může se lišit od druhu: „Ranní jóga“, „Pilates s míčem“.' }),
    kind: f.relation({ to: () => LessonKind, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Kind', cs: 'Druh' })
      .help({ en: 'The filter of the timetable and, in Blanket, the colour.', cs: 'Podle něj se filtruje rozvrh a ve vzhledu Deka se barví.' }),
    instructor: f.relation({ to: () => Instructor, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Instructor', cs: 'Lektor' }),
    day: f.select({
      options: ['po', 'ut', 'st', 'ct', 'pa', 'so'] as const, default: 'po',
      labels: { po: { en: 'Monday', cs: 'Pondělí' }, ut: { en: 'Tuesday', cs: 'Úterý' }, st: { en: 'Wednesday', cs: 'Středa' }, ct: { en: 'Thursday', cs: 'Čtvrtek' }, pa: { en: 'Friday', cs: 'Pátek' }, so: { en: 'Saturday', cs: 'Sobota' } },
    }).label({ en: 'Day', cs: 'Den' }),
    start: f.text({ required: true, max: 5 }).label({ en: 'Starts', cs: 'Začátek' }).help({ en: 'Hours and minutes, for example “18:00”.', cs: 'Hodiny a minuty, například „18:00“.' }),
    end: f.text({ required: true, max: 5 }).label({ en: 'Ends', cs: 'Konec' }).help({ en: 'For example “19:15”.', cs: 'Například „19:15“.' }),
    level: f.select({
      options: ['z', 'm', 'p', 'v', 'd'] as const, default: 'v',
      labels: { z: { en: 'Beginners', cs: 'Začátečníci' }, m: { en: 'Intermediate', cs: 'Mírně pokročilí' }, p: { en: 'Advanced', cs: 'Pokročilí' }, v: { en: 'All levels', cs: 'Všechny úrovně' }, d: { en: 'By age', cs: 'Podle věku' } },
    }).label({ en: 'Level', cs: 'Úroveň' }),
    room: f.text().label({ en: 'Room', cs: 'Sál' }).help({ en: 'For example “Big hall”.', cs: 'Například „Velký sál“.' }),
    capacity: f.number({ int: true, min: 1 }).label({ en: 'Places', cs: 'Kapacita' }),
    free: f.number({ int: true, min: 0 }).label({ en: 'Places left', cs: 'Volná místa' })
      .help({ en: 'Change it by hand as people sign up. 0 shows the class as full.', cs: 'Měňte ručně podle přihlášek. Nula ukáže lekci jako obsazenou.' }),
  },
  content: { public: true, populate: ['kind', 'instructor'] },
})

// ── courses that open for sign-up ──
export const Course = defineEntity('course', {
  label: { en: 'Courses', cs: 'Kurzy' },
  labelSingular: { en: 'Course', cs: 'Kurz' },
  description: { en: 'Closed groups that start from the first class: the start day, the number of classes, the price and the places left.', cs: 'Uzavřené skupiny, které začínají od první lekce: den začátku, počet lekcí, cena a volná místa.' },
  icon: 'i-lucide-graduation-cap',
  titleField: 'title',
  admin: { list: { columns: ['title', 'startsOn', 'price', 'free'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    kind: f.relation({ to: () => LessonKind, kind: 'many-to-one', onDelete: 'set null' }).optional().label({ en: 'Kind', cs: 'Druh' })
      .help({ en: 'In Blanket, the course takes the kind’s colour.', cs: 'Ve vzhledu Deka kurz převezme barvu druhu.' }),
    text: f.text({ multiline: true }).label({ en: 'Short text', cs: 'Krátký text' })
      .help({ en: 'Who it is for, which day and time, with whom.', cs: 'Pro koho, který den a čas a s kým.' }),
    startsOn: f.datetime({ allDay: true }).label({ en: 'Starts on', cs: 'Začíná' }).help({ en: 'The website writes the weekday and the day, like “Tuesday 12. 1.”.', cs: 'Web napíše den v týdnu a datum, třeba „úterý 12. 1.“.' }),
    lessons: f.number({ int: true, min: 1 }).label({ en: 'Number of classes', cs: 'Počet lekcí' }),
    price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
    capacity: f.number({ int: true, min: 1 }).label({ en: 'Places', cs: 'Kapacita' }),
    free: f.number({ int: true, min: 0 }).label({ en: 'Places left', cs: 'Volná místa' }).help({ en: 'Change it by hand as people sign up.', cs: 'Měňte ručně podle přihlášek.' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['kind'] },
})

// ── prices ──
export const Tariff = defineEntity('tariff', {
  label: { en: 'Prices', cs: 'Ceník' },
  labelSingular: { en: 'Price', cs: 'Cena' },
  description: { en: 'The single entry, the pass, the membership… One of them can be highlighted.', cs: 'Jednotlivý vstup, permanentka, členství… Jednu z cen můžete zvýraznit.' },
  icon: 'i-lucide-tags',
  titleField: 'name',
  admin: { list: { columns: ['name', 'price', 'featured'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' })
      .help({ en: 'Zero is free: Hall and Blanket write “Zdarma”, Board writes “0 Kč”.', cs: 'Nula je zdarma: Sál a Deka napíšou „Zdarma“, Tabule „0 Kč“.' }),
    text: f.text({ multiline: true }).label({ en: 'Short text', cs: 'Krátký text' }),
    featured: f.boolean().label({ en: 'Highlighted', cs: 'Zvýrazněná' }).help({ en: 'Stands out in the colour of the site. Highlight one.', cs: 'Vynikne barvou webu. Zvýrazněte jednu.' }),
    badge: f.text().label({ en: 'Label on the highlighted price', cs: 'Štítek u zvýrazněné ceny' }).help({ en: 'For example “Most popular”.', cs: 'Například „Nejčastější volba“.' }),
    linkLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'A button on the highlighted price, a link on the others.', cs: 'U zvýrazněné ceny tlačítko, u ostatních odkaz.' }),
    linkUrl: f.text({ format: 'link' }).label({ en: 'Link destination', cs: 'Cíl odkazu' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── questions before the first class ──
export const Question = defineEntity('question', {
  label: { en: 'Questions', cs: 'Otázky' },
  labelSingular: { en: 'Question', cs: 'Otázka' },
  description: { en: 'What people ask before they come: what to bring, whether they need a partner, how to cancel.', cs: 'Na co se lidé ptají před příchodem: co si vzít, jestli potřebují partnera, jak zrušit rezervaci.' },
  icon: 'i-lucide-circle-help',
  titleField: 'question',
  admin: { list: { columns: ['question'], orderField: 'position' } },
  fields: {
    question: f.text({ required: true }).label({ en: 'Question', cs: 'Otázka' }),
    answer: f.text({ required: true, multiline: true }).label({ en: 'Answer', cs: 'Odpověď' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })

const hero = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The first screen: the heading, a few words, a photo and the button to the free trial class. Hall adds the next class, Board today’s classes.', cs: 'První obrazovka: nadpis, pár slov, fotografie a tlačítko ke zkušební lekci. Sál přidá nejbližší lekci, Tabule dnešní lekce.' },
  icon: 'i-lucide-layout-template',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Text between *asterisks* stands out. Board starts a new line where you press Enter.', cs: 'Text mezi *hvězdičkami* se zvýrazní. Tabule začne nový řádek tam, kde stisknete Enter.' }),
    text: text(),
    photos: f.list({
      fields: { image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }) },
      max: 3, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Hall shows the first, Board the second, Blanket the second with the third laid over its corner. A look without a second photo uses the first.', cs: 'Sál ukáže první, Tabule druhou, Deka druhou a přes její roh třetí. Když druhá fotografie chybí, použije se první.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }),
    secondaryUrl: link('Link destination', 'Cíl odkazu'),
    facts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }),
        value: f.text().label({ en: 'Smaller line under it', cs: 'Menší řádek pod ním' }),
      },
      max: 3, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'Three short facts', cs: 'Tři krátké údaje' })
      .help({ en: 'Hall shows them under the buttons. The other looks do not.', cs: 'Sál je ukáže pod tlačítky. Ostatní vzhledy ne.' }),
    badgeTop: f.text().label({ en: 'Round sticker: large line', cs: 'Kulatá nálepka: velký řádek' }).help({ en: 'Blanket only, for example “1st class”.', cs: 'Jen Deka, například „1. lekce“.' }),
    badgeBottom: f.text().label({ en: 'Round sticker: small line', cs: 'Kulatá nálepka: malý řádek' }).help({ en: 'Blanket only, for example “free”.', cs: 'Jen Deka, například „zdarma“.' }),
  },
})

const timetable = defineBlock({
  label: { en: 'Timetable', cs: 'Rozvrh' },
  description: { en: 'The classes of the Timetable section, with filters. A visitor taps a class and the sign-up form fills in.', cs: 'Lekce ze sekce Rozvrh s filtry. Návštěvník klepne na lekci a přihláška se vyplní.' },
  icon: 'i-lucide-calendar-days',
  fields: {
    eyebrow: eyebrow().help({ en: 'The dates of the current week follow it. Board writes its own line instead.', cs: 'Za ním se napíše týden, který právě běží. Tabule píše vlastní řádek.' }),
    heading: heading(),
    text: text(),
    printLabel: f.text().label({ en: 'Link text under the timetable', cs: 'Text odkazu pod rozvrhem' }),
    printUrl: link('Link destination', 'Cíl odkazu').help({ en: 'For example your timetable as a PDF. Left empty, the link is not shown.', cs: 'Třeba rozvrh jako PDF. Když pole necháte prázdné, odkaz se nezobrazí.' }),
  },
})

const kinds = defineBlock({
  label: { en: 'Kinds of classes', cs: 'Druhy lekcí' },
  description: { en: 'The kinds from the Kinds of classes section, each with a photo and a link that filters the timetable.', cs: 'Druhy ze sekce Druhy lekcí, každý s fotografií a odkazem, který přefiltruje rozvrh.' },
  icon: 'i-lucide-layers',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    helpTitle: f.text().label({ en: 'Card “can’t choose?”: heading', cs: 'Karta „nevíte, co si vybrat?“: nadpis' }).help({ en: 'Blanket only: a card after the kinds.', cs: 'Jen Deka: karta za druhy lekcí.' }),
    helpText: text().label({ en: 'Card: text', cs: 'Karta: text' }),
    helpLabel: f.text().label({ en: 'Card: button text', cs: 'Karta: text tlačítka' }),
    helpUrl: link('Card: button destination', 'Karta: cíl tlačítka'),
  },
})

const courses = defineBlock({
  label: { en: 'Courses', cs: 'Kurzy' },
  description: { en: 'The courses from the Courses section, with the start day, the price and the places left.', cs: 'Kurzy ze sekce Kurzy, s dnem začátku, cenou a volnými místy.' },
  icon: 'i-lucide-graduation-cap',
  fields: { eyebrow: eyebrow(), heading: heading(), text: text() },
})

const prices = defineBlock({
  label: { en: 'Prices', cs: 'Ceník' },
  description: { en: 'The prices from the Prices section and a note under them.', cs: 'Ceny ze sekce Ceník a poznámka pod nimi.' },
  icon: 'i-lucide-tags',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    footnote: text().label({ en: 'Note under the prices', cs: 'Poznámka pod cenami' }),
  },
})

const instructors = defineBlock({
  label: { en: 'Instructors', cs: 'Lektoři' },
  description: { en: 'The people from the Instructors section.', cs: 'Lidé ze sekce Lektoři.' },
  icon: 'i-lucide-users',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'Beside the heading. Board writes it as a small line.', cs: 'Vedle nadpisu. Tabule ji napíše jako malý řádek.' }),
  },
})

const space = defineBlock({
  label: { en: 'The space', cs: 'Prostor' },
  description: { en: 'The rooms: a few words, three photos and the facts about them.', cs: 'Sály: pár slov, tři fotografie a údaje o nich.' },
  icon: 'i-lucide-door-open',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Board does not write it above the photos but keeps it for readers who cannot see them.', cs: 'Tabule ho nenapíše nad fotografie, ale ponechá ho čtenářům, kteří je nevidí.' }),
    text: text().help({ en: 'An empty line starts a new paragraph.', cs: 'Prázdný řádek začne nový odstavec.' }),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 3, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'The first is the large one, the other two are smaller. Captions show in Hall only.', cs: 'První je velká, další dvě menší. Popisky ukáže jen Sál.' }),
    facts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }).help({ en: 'For example “Big hall”.', cs: 'Například „Velký sál“.' }),
        value: f.text().label({ en: 'Value', cs: 'Hodnota' }).help({ en: 'For example “140 m²”.', cs: 'Například „140 m²“.' }),
      },
      max: 6, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'Facts', cs: 'Údaje' }),
  },
})

const where = defineBlock({
  label: { en: 'Where to find us', cs: 'Kde nás najdete' },
  description: { en: 'The address from Site settings with a link to a map, how to get there and a sketch of the way.', cs: 'Adresa z Nastavení webu s odkazem do mapy, jak se k nám dostat a náčrtek cesty.' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Hall and Blanket write it large, usually the address. Board writes the address from Site settings under it.', cs: 'Sál a Deka ho napíšou velkým písmem, obvykle je to adresa. Tabule pod něj napíše adresu z Nastavení webu.' }),
    text: text(),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photo of the building', cs: 'Fotografie budovy' }).help({ en: 'Hall and Board show it. Blanket draws a plan instead.', cs: 'Sál a Tabule ji ukáží. Deka místo ní nakreslí plánek.' }),
    ways: f.list({
      fields: {
        icon: f.select({
          options: ['walk', 'bus', 'car', 'bike', 'clock'] as const, default: 'walk',
          labels: { walk: { en: 'On foot', cs: 'Pěšky' }, bus: { en: 'Bus', cs: 'Autobus' }, car: { en: 'Car', cs: 'Auto' }, bike: { en: 'Bicycle', cs: 'Kolo' }, clock: { en: 'Clock', cs: 'Hodiny' } },
        }).label({ en: 'Icon', cs: 'Ikona' }).help({ en: 'Hall draws it.', cs: 'Nakreslí ji Sál.' }),
        label: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }).help({ en: 'For example “By bus”.', cs: 'Například „Autobusem“.' }),
        figure: f.text().label({ en: 'Large figure', cs: 'Velké číslo' }).help({ en: 'For example “6 min”. Board writes it large.', cs: 'Například „6 min“. Tabule ho napíše velkým písmem.' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 5, itemLabel: { en: 'Way', cs: 'Cesta' },
    }).label({ en: 'Getting there', cs: 'Doprava' }),
    routeFrom: f.text().label({ en: 'Sketch: where the walk starts', cs: 'Náčrtek: odkud se jde' }).help({ en: 'Hall and Blanket, for example “Town square”.', cs: 'Sál a Deka, například „Velké náměstí“.' }),
    routeFromTime: f.text().label({ en: 'Sketch: time to the next stop', cs: 'Náčrtek: čas k další zastávce' }).help({ en: 'For example “3 min”.', cs: 'Například „3 min“.' }),
    routeVia: f.text().label({ en: 'Sketch: the stop on the way', cs: 'Náčrtek: zastávka na cestě' }).help({ en: 'For example “Stone bridge”.', cs: 'Například „Kamenný most“.' }),
    routeViaTime: f.text().label({ en: 'Sketch: time from there to you', cs: 'Náčrtek: čas odtud k vám' }).help({ en: 'For example “6 min along the river”.', cs: 'Například „6 min po nábřeží“.' }),
    river: f.text().label({ en: 'Plan: name of the river', cs: 'Plánek: název řeky' }).help({ en: 'Blanket only.', cs: 'Jen Deka.' }),
    parking: f.text().label({ en: 'Plan: parking', cs: 'Plánek: parkování' }).help({ en: 'Blanket only, for example “8 places in the yard”.', cs: 'Jen Deka, například „8 míst ve dvoře“.' }),
    stop: f.text().label({ en: 'Plan: bus stop', cs: 'Plánek: zastávka' }).help({ en: 'Blanket only.', cs: 'Jen Deka.' }),
    stopNote: f.text().label({ en: 'Plan: line and time to the studio', cs: 'Plánek: linka a čas ke studiu' }).help({ en: 'Blanket only, for example “line 2 · 2 min”.', cs: 'Jen Deka, například „linka 2 · 2 min“.' }),
  },
})

const questions = defineBlock({
  label: { en: 'Questions and answers', cs: 'Otázky a odpovědi' },
  description: { en: 'The questions from the Questions section.', cs: 'Otázky ze sekce Otázky.' },
  icon: 'i-lucide-circle-help',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'An e-mail address in it becomes a link.', cs: 'E-mailová adresa v něm se změní na odkaz.' }),
  },
})

const signup = defineBlock({
  label: { en: 'Trial class sign-up', cs: 'Přihláška na zkušební lekci' },
  description: { en: 'A visitor chooses a class from the timetable and one of its next dates. The sign-ups arrive in the admin.', cs: 'Návštěvník vybere lekci z rozvrhu a jeden z jejích nejbližších termínů. Přihlášky najdete v administraci.' },
  icon: 'i-lucide-mail-check',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    steps: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }) },
      max: 5, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'What happens on the day', cs: 'Jak to bude vypadat' }),
    consent: f.text({ multiline: true }).label({ en: 'Consent sentence', cs: 'Věta souhlasu' }).help({ en: 'Next to the box the visitor ticks.', cs: 'U políčka, které návštěvník zaškrtne.' }),
    phoneNote: f.text().label({ en: 'Line with the phone', cs: 'Řádek s telefonem' }).help({ en: 'For example “Prefer the phone?”. The number from Site settings follows.', cs: 'Například „Raději telefonem?“. Za ním následuje telefon z Nastavení webu.' }),
  },
})

const richText = defineBlock({
  label: { en: 'Text', cs: 'Text' },
  description: { en: 'Paragraphs, headings, lists and links.', cs: 'Odstavce, nadpisy, seznamy a odkazy.' },
  icon: 'i-lucide-text',
  fields: {
    heading: heading(false),
    body: f.richtext().label({ en: 'Text', cs: 'Text' }),
  },
})

// Pages built from blocks: title, address, status, blocks, SEO, preview.
export const Page = definePages({
  blocks: { hero, timetable, kinds, courses, prices, instructors, space, where, questions, signup, text: richText, ...customTypeBlocks() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    legal: { en: 'Links in the footer', cs: 'Odkazy v zápatí' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the sign-ups of the form below
]

// ── the trial class sign-up ──
// The website draws it per look (the kit's useSiteForm). The class and the date are chosen from
// the timetable: they arrive as the words the visitor saw ("Pondělí 18:00 · Jóga pro začátečníky").
export const Trial = defineForm('trial', {
  label: { en: 'Trial class sign-ups', cs: 'Přihlášky na zkušební lekci' },
  labelSingular: { en: 'Sign-up', cs: 'Přihláška' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    email: f.text({ required: true, max: 200, format: 'email' }).label({ en: 'E-mail', cs: 'E-mail' }),
    lesson: f.text({ required: true, max: 300 }).label({ en: 'Class', cs: 'Lekce' }),
    date: f.text({ required: true, max: 200 }).label({ en: 'Date', cs: 'Datum' }),
    consent: f.boolean().label({ en: 'Agrees to the processing of the data', cs: 'Souhlas se zpracováním údajů' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Book the trial class', cs: 'Rezervovat zkušební lekci' },
  successMessage: { en: 'Thank you. We will confirm your place by e-mail by the evening.', cs: 'Děkujeme. Místo vám potvrdíme e-mailem nejpozději do večera.' },
})
export const FormSettings = defineFormSettings()
