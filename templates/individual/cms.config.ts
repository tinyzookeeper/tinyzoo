import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'
import { OWN_COLOR_FIELD } from 'tinyzoo-template-kit/looks'

// The content model of the Freelancer and consultant template: what a one-person business can
// write and change. One model for all three looks (looks.ts): a look decides how a block is
// drawn, never what it holds. Change it here, then `pnpm db:generate` (review the SQL),
// `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní: ve vzhledu Zvýrazňovač barevně, ve vzhledu Rozhovor barvou a kurzívou, ve vzhledu Vizitka zůstane beze změny.',
  en: 'Text between *asterisks* stands out: highlighted with colour in Highlighter, in colour and italics in Conversation, unchanged in Business Card.',
}

// ── the whole site: who, where, how to reach them ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'Your name, your contacts, the look and the colours.', cs: 'Vaše jméno, kontakty, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Jméno a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'ownColor', 'role', 'shortDescription'] },
      { label: { en: 'Contacts', cs: 'Kontakty' }, fields: ['phone', 'phoneHours', 'email', 'address', 'addressNote', 'nextFree'] },
      { label: { en: 'Header and footer', cs: 'Záhlaví a zápatí' }, fields: ['ctaLabel', 'ctaUrl', 'linkedinUrl', 'instagramUrl', 'newsletterUrl'] },
      { label: { en: 'Business details', cs: 'Údaje o podnikání' }, fields: ['legalName', 'companyId', 'legalNote'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Your name', cs: 'Vaše jméno' })
      .help({ en: 'Your name or the name of your business. It stands in the header and the footer.', cs: 'Vaše jméno nebo název živnosti. Stojí v záhlaví i v zápatí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of your name.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo jména.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    // The owner's own main colour: the palette of the chosen colours follows it (templates/kit/palette.ts).
    ownColor: f.color().optional().label(OWN_COLOR_FIELD.label).help(OWN_COLOR_FIELD.help),
    role: f.text().optional().label({ en: 'What you do', cs: 'Čím se živíte' })
      .help({ en: 'One word, for example “copywriter”. Business Card writes it beside your name in the header.', cs: 'Jedno slovo, například „copywriterka“. Vzhled Vizitka ho napíše vedle jména v záhlaví.' }),
    shortDescription: f.text({ multiline: true }).optional().label({ en: 'Short description', cs: 'Krátký popis' })
      .help({ en: 'Two lines about you and what you do, under your name in the footer.', cs: 'Dva řádky o vás a o tom, co děláte, pod jménem v zápatí.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' })
      .help({ en: 'As you want it written, for example “734 218 560”.', cs: 'Tak, jak ho chcete napsat, například „734 218 560“.' }),
    phoneHours: f.text().optional().label({ en: 'When to call', cs: 'Kdy volat' })
      .help({ en: 'For example “Monday to Friday, 9–16”.', cs: 'Například „pondělí až pátek, 9–16 hodin“.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    address: f.text().optional().label({ en: 'Address', cs: 'Adresa' })
      .help({ en: 'Where clients can meet you. Leave it empty if you only work online.', cs: 'Kde se s vámi mohou klienti potkat. Když pracujete jen online, nechte prázdné.' }),
    addressNote: f.text().optional().label({ en: 'Note to the address', cs: 'Poznámka k adrese' })
      .help({ en: 'For example “by appointment, otherwise online”.', cs: 'Například „po domluvě, jinak online“.' }),
    nextFree: f.text().optional().label({ en: 'Next free slot', cs: 'Nejbližší volný termín' })
      .help({ en: 'A short sentence, for example “I take new projects from January 2027”. Conversation shows it on the portrait.', cs: 'Krátká věta, například „Nové zakázky beru od ledna 2027“. Vzhled Rozhovor ji ukáže na portrétu.' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    linkedinUrl: f.text({ format: 'url' }).optional().label({ en: 'LinkedIn address', cs: 'Adresa na LinkedIn' }).help({ en: 'Leave empty to hide the link in the footer.', cs: 'Když pole necháte prázdné, odkaz v zápatí se nezobrazí.' }),
    instagramUrl: f.text({ format: 'url' }).optional().label({ en: 'Instagram address', cs: 'Adresa na Instagramu' }).help({ en: 'Leave empty to hide the link in the footer.', cs: 'Když pole necháte prázdné, odkaz v zápatí se nezobrazí.' }),
    newsletterUrl: f.text({ format: 'url' }).optional().label({ en: 'Newsletter address', cs: 'Adresa newsletteru' }).help({ en: 'Leave empty to hide the link in the footer.', cs: 'Když pole necháte prázdné, odkaz v zápatí se nezobrazí.' }),
    legalName: f.text().optional().label({ en: 'Name in the footer’s legal line', cs: 'Jméno v právním řádku zápatí' })
      .help({ en: 'With the title, for example “Mgr. Magda Šubrtová”.', cs: 'I s titulem, například „Mgr. Magda Šubrtová“.' }),
    companyId: f.text().optional().label({ en: 'Company number', cs: 'IČO' }),
    legalNote: f.text().optional().label({ en: 'Rest of the legal line', cs: 'Zbytek právního řádku' })
      .help({ en: 'For example “registered in the trade register · not a VAT payer”.', cs: 'Například „zapsaná v živnostenském rejstříku · nejsem plátce DPH“.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── what you offer: the price list ──
export const Service = defineEntity('service', {
  label: { en: 'Services', cs: 'Služby' },
  labelSingular: { en: 'Service', cs: 'Služba' },
  description: { en: 'What you offer, for whom, how long it takes and what it costs. Drag to put the services in order.', cs: 'Co nabízíte, pro koho, jak dlouho to trvá a kolik to stojí. Pořadí změníte přetažením.' },
  icon: 'i-lucide-list-checks',
  titleField: 'name',
  admin: { list: { columns: ['name', 'duration', 'price'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    text: f.text({ multiline: true }).optional().label({ en: 'What it is', cs: 'Co to je' }).help({ en: 'One or two sentences.', cs: 'Jedna nebo dvě věty.' }),
    forWhom: f.text().optional().label({ en: 'For whom', cs: 'Pro koho' }),
    duration: f.text().optional().label({ en: 'How long', cs: 'Jak dlouho' }).help({ en: 'As you want it written, for example “2–3 weeks”.', cs: 'Tak, jak to chcete napsat, například „2–3 týdny“.' }),
    price: f.text().optional().label({ en: 'Price', cs: 'Cena' }).help({ en: 'Text, so that “from 24,000 CZK” fits.', cs: 'Text, aby se vešlo i „od 24 000 Kč“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── selected projects: each has a page of its own (/zakazky/<address>) ──
export const Project = defineEntity('project', {
  label: { en: 'Projects', cs: 'Zakázky' },
  labelSingular: { en: 'Project', cs: 'Zakázka' },
  description: { en: 'Work you did for clients, with the result in a number. Drag to put the projects in order.', cs: 'Práce pro klienty s výsledkem v číslu. Pořadí změníte přetažením.' },
  icon: 'i-lucide-briefcase',
  titleField: 'title',
  admin: { list: { columns: ['image', 'title', 'client', 'status'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Headline', cs: 'Titulek' }).help({ en: 'The story in one line, for example “A website that said for the first time what a kitchen costs”.', cs: 'Příběh jednou větou, například „Web, který poprvé řekl, kolik kuchyně stojí“.' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    client: f.text().optional().label({ en: 'Client', cs: 'Klient' }).help({ en: 'The name and the place, or the kind of client, for example “Habřina Carpentry, Žďár nad Sázavou”.', cs: 'Jméno a místo, nebo druh klienta, například „Truhlářství Habřina, Žďár nad Sázavou“.' }),
    year: f.text({ max: 20 }).optional().label({ en: 'Year', cs: 'Rok' }),
    done: f.text({ multiline: true }).optional().label({ en: 'What was done', cs: 'Co bylo uděláno' }),
    result: f.text({ max: 30 }).optional().label({ en: 'Result in a number', cs: 'Výsledek v čísle' })
      .help({ en: 'Short, for example “4 → 11” or “1 in 3”. The arrow is drawn as an icon. It is the largest thing of the project.', cs: 'Krátce, například „4 → 11“ nebo „1 ze 3“. Šipka se vykreslí jako ikona. Je to nejvýraznější údaj zakázky.' }),
    resultText: f.text().optional().label({ en: 'What the result says', cs: 'Co výsledek říká' }).help({ en: 'One line, for example “enquiries from the website a month”.', cs: 'Jeden řádek, například „poptávek z webu měsíčně“.' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' }),
    body: f.richtext().optional().label({ en: 'The story', cs: 'Příběh zakázky' }).help({ en: 'Shown on the project’s own page.', cs: 'Zobrazí se na samostatné stránce zakázky.' }),
    featured: f.boolean().label({ en: 'Show on the home page', cs: 'Ukázat na úvodní stránce' })
      .help({ en: 'The first selected project is shown largest in Business Card.', cs: 'První vybraná zakázka je ve vzhledu Vizitka největší.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
    ...seo(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/zakazky/:slug' },
  content: { public: true, published: (table) => eq(table.status, 'published'), slug: 'slug', path: '/zakazky/:slug', populate: ['image', 'ogImage'] },
})

// ── what clients say ──
export const Testimonial = defineEntity('testimonial', {
  label: { en: 'Testimonials', cs: 'Reference' },
  labelSingular: { en: 'Testimonial', cs: 'Reference' },
  description: { en: 'What clients say about working with you. The first one is shown largest.', cs: 'Co o spolupráci s vámi říkají klienti. První je nejvýraznější.' },
  icon: 'i-lucide-message-square-quote',
  titleField: 'name',
  admin: { list: { columns: ['name', 'role'], orderField: 'position' } },
  fields: {
    text: f.text({ required: true, multiline: true }).label({ en: 'What they said', cs: 'Co řekli' }),
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    role: f.text().optional().label({ en: 'Role and company', cs: 'Role a firma' }).help({ en: 'For example “owner, Habřina Carpentry”.', cs: 'Například „majitel, Truhlářství Habřina“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── articles: each has a page of its own (/blog/<address>) ──
export const Article = defineEntity('article', {
  label: { en: 'Articles', cs: 'Články' },
  labelSingular: { en: 'Article', cs: 'Článek' },
  description: { en: 'The blog. Newest articles come first.', cs: 'Blog. Nejnovější články jsou první.' },
  icon: 'i-lucide-newspaper',
  titleField: 'title',
  admin: { list: { columns: ['image', 'title', 'date', 'status'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Headline', cs: 'Titulek' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    date: f.datetime({ allDay: true }).optional().label({ en: 'Date', cs: 'Datum' }),
    excerpt: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Perex' }).help({ en: 'One or two sentences shown in the list of articles.', cs: 'Jedna nebo dvě věty do seznamu článků.' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'Business Card shows no photographs in the list. Highlighter shows a small one, Conversation a card.', cs: 'Vzhled Vizitka fotografie v seznamu nezobrazuje. Zvýrazňovač ukáže malou, Rozhovor kartu.' }),
    body: f.richtext().optional().label({ en: 'Text', cs: 'Text' }),
    ...seo(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/blog/:slug' },
  content: { public: true, published: (table) => eq(table.status, 'published'), slug: 'slug', path: '/blog/:slug', populate: ['image', 'ogImage'] },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = (help?: { en: string; cs: string }) => {
  const field = f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
  return help ? field.help(help) : field
}
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = (help?: { en: string; cs: string }) => {
  const field = f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
  return help ? field.help(help) : field
}
const link = (en: string, cs: string) => f.text({ format: 'link' }).optional().label({ en, cs })
const question = () => f.text().label({ en: 'The visitor’s question', cs: 'Otázka návštěvníka' })
  .help({ en: 'Only Conversation shows it, in a speech bubble above the heading, which then reads as the answer. Leave it empty for no bubble.', cs: 'Ukáže ji jen vzhled Rozhovor, v bublině nad nadpisem, který pak vypadá jako odpověď. Když pole necháte prázdné, bublina se nezobrazí.' })

const opening = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'Who you are and what you do in one sentence, your photograph, a button and the facts at a glance.', cs: 'Kdo jste a co děláte jednou větou, vaše fotografie, tlačítko a fakta v kostce.' },
  icon: 'i-lucide-panel-top',
  fields: {
    eyebrow: eyebrow({ en: 'Business Card writes it above the heading, for example “Copywriter · Brno · freelance since 2018”.', cs: 'Vzhled Vizitka ho napíše nad nadpis, například „Copywriterka · Brno · na volné noze od roku 2018“.' }),
    strike: f.text().label({ en: 'Struck-through line', cs: 'Přeškrtnutá věta' })
      .help({ en: 'The cliché your heading replaces. Only Highlighter shows it, above the heading.', cs: 'Fráze, kterou váš nadpis nahrazuje. Ukáže ji jen vzhled Zvýrazňovač, nad nadpisem.' }),
    question: question().help({ en: 'Only Conversation shows it: what a visitor might say first, in a speech bubble above the heading.', cs: 'Ukáže ji jen vzhled Rozhovor: co by návštěvník řekl první, v bublině nad nadpisem.' }),
    heading: heading(),
    text: text(),
    image: f.media({ accept: 'image/*' }).label({ en: 'Your portrait', cs: 'Váš portrét' })
      .help({ en: 'A portrait works best.', cs: 'Nejlépe na výšku.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'Only Business Card shows this link beside the button.', cs: 'Odkaz vedle tlačítka ukáže jen vzhled Vizitka.' }),
    secondaryUrl: link('Link destination', 'Cíl odkazu'),
    note: f.text().label({ en: 'Note under the button', cs: 'Poznámka pod tlačítkem' }).help({ en: 'For example “The first call takes 30 minutes and is free.”', cs: 'Například „První hovor trvá 30 minut a je zdarma.“' }),
    facts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Label', cs: 'Popisek' }).help({ en: 'For example “For whom”.', cs: 'Například „Pro koho“.' }),
        value: f.text({ required: true }).label({ en: 'Fact', cs: 'Údaj' }),
      },
      max: 4, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'Facts at a glance', cs: 'Fakta v kostce' })
      .help({ en: 'Business Card shows four of them as a strip under the opening, Highlighter the last three beside the heading, Conversation none.', cs: 'Vzhled Vizitka jich ukáže čtyři v pruhu pod úvodem, Zvýrazňovač poslední tři vedle nadpisu, Rozhovor žádný.' }),
    chipsTitle: f.text().label({ en: 'Line above the questions', cs: 'Řádek nad otázkami' }).help({ en: 'Only Conversation shows the questions, as a row of chips that works as a table of contents.', cs: 'Otázky ukáže jen vzhled Rozhovor, jako řadu štítků, která slouží jako obsah stránky.' }),
    chips: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Question', cs: 'Otázka' }),
        url: f.text({ format: 'link' }).optional().label({ en: 'Where it leads', cs: 'Kam vede' }),
      },
      max: 8, itemLabel: { en: 'Question', cs: 'Otázka' },
    }).label({ en: 'Questions people ask', cs: 'Otázky, na které se lidé ptají' }),
  },
})

const services = defineBlock({
  label: { en: 'Services and prices', cs: 'Služby a ceny' },
  description: { en: 'The services from the Services section as a price list.', cs: 'Služby ze sekce Služby jako ceník.' },
  icon: 'i-lucide-list-checks',
  fields: {
    eyebrow: eyebrow({ en: 'Business Card writes it above the heading.', cs: 'Vzhled Vizitka ho napíše nad nadpis.' }),
    question: question(),
    heading: heading(),
    text: text({ en: 'Business Card and Highlighter write it beside the heading.', cs: 'Vzhledy Vizitka a Zvýrazňovač ho napíšou vedle nadpisu.' }),
    footnote: f.text().label({ en: 'Note under the list', cs: 'Poznámka pod seznamem' }).help({ en: 'For example “I am not a VAT payer, prices are final.”', cs: 'Například „Nejsem plátce DPH, ceny jsou konečné.“' }),
    linkLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'Business Card and Highlighter write it under the list.', cs: 'Vzhledy Vizitka a Zvýrazňovač ho napíšou pod seznam.' }),
    linkUrl: link('Link destination', 'Cíl odkazu'),
    helpTitle: f.text().label({ en: 'Last cell: title', cs: 'Poslední políčko: nadpis' }).help({ en: 'Only Conversation closes the grid with a coloured cell, for example “Not sure what you need?”.', cs: 'Jen vzhled Rozhovor zakončí mřížku barevným políčkem, například „Nevíte, co z toho potřebujete?“.' }),
    helpText: f.text({ multiline: true }).label({ en: 'Last cell: text', cs: 'Poslední políčko: text' }),
  },
})

const projects = defineBlock({
  label: { en: 'Projects', cs: 'Zakázky' },
  description: { en: 'The projects from the Projects section, each with its result in a number.', cs: 'Zakázky ze sekce Zakázky, každá s výsledkem v číslu.' },
  icon: 'i-lucide-briefcase',
  fields: {
    eyebrow: eyebrow({ en: 'Business Card writes it above the heading.', cs: 'Vzhled Vizitka ho napíše nad nadpis.' }),
    question: question(),
    heading: heading(),
    text: text({ en: 'Business Card and Highlighter write it beside the heading.', cs: 'Vzhledy Vizitka a Zvýrazňovač ho napíšou vedle nadpisu.' }),
    show: f.select({
      options: ['featured', 'all'] as const, default: 'featured',
      labels: { featured: { en: 'Only those selected for the home page', cs: 'Jen vybrané na úvodní stránku' }, all: { en: 'All published projects', cs: 'Všechny zveřejněné zakázky' } },
    }).label({ en: 'Which projects', cs: 'Které zakázky' }),
    linkLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'For example “All 14 projects”. Leave it empty for no link.', cs: 'Například „Všech 14 popsaných zakázek“. Když pole necháte prázdné, odkaz se nezobrazí.' }),
    linkUrl: link('Link destination', 'Cíl odkazu'),
  },
})

const steps = defineBlock({
  label: { en: 'How we work together', cs: 'Jak spolupráce probíhá' },
  description: { en: 'Three to five steps from the first call to the result, with one photograph.', cs: 'Tři až pět kroků od prvního hovoru po výsledek, s jednou fotografií.' },
  icon: 'i-lucide-route',
  fields: {
    eyebrow: eyebrow({ en: 'Business Card writes it above the heading.', cs: 'Vzhled Vizitka ho napíše nad nadpis.' }),
    question: question(),
    heading: heading(),
    text: text({ en: 'Highlighter writes it beside the heading.', cs: 'Vzhled Zvýrazňovač ho napíše vedle nadpisu.' }),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'Highlighter shows no caption.', cs: 'Vzhled Zvýrazňovač popisek nezobrazuje.' }),
    imageQuestion: f.text().label({ en: 'Question on the photograph', cs: 'Otázka na fotografii' }).help({ en: 'Only Conversation lays it over the photograph, in a speech bubble.', cs: 'Jen vzhled Rozhovor ji položí přes fotografii, v bublině.' }),
    items: f.list({
      fields: {
        title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
        when: f.text().label({ en: 'When', cs: 'Kdy' }).help({ en: 'For example “first week”. Business Card shows only the number.', cs: 'Například „1. týden“. Vzhled Vizitka ukáže jen číslo kroku.' }),
      },
      max: 5, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'Steps', cs: 'Kroky' }),
  },
})

const testimonials = defineBlock({
  label: { en: 'Testimonials', cs: 'Reference' },
  description: { en: 'The testimonials from the Testimonials section.', cs: 'Reference ze sekce Reference.' },
  icon: 'i-lucide-message-square-quote',
  fields: {
    heading: heading(),
  },
})

const about = defineBlock({
  label: { en: 'About me', cs: 'O mně' },
  description: { en: 'Your story in a few paragraphs, one or two photographs and a dated list.', cs: 'Váš příběh v několika odstavcích, jedna nebo dvě fotografie a seznam s daty.' },
  icon: 'i-lucide-user-round',
  fields: {
    eyebrow: eyebrow({ en: 'Business Card and Highlighter write it above the heading.', cs: 'Vzhledy Vizitka a Zvýrazňovač ho napíšou nad nadpis.' }),
    question: question(),
    heading: heading(),
    text: text({ en: 'Paragraphs are separated by an empty line.', cs: 'Odstavce oddělte prázdným řádkem.' }),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'Conversation shows no caption.', cs: 'Vzhled Rozhovor popisek nezobrazuje.' }),
    secondImage: f.media({ accept: 'image/*' }).optional().label({ en: 'Second photograph', cs: 'Druhá fotografie' })
      .help({ en: 'Only Conversation shows it, smaller, overlapping the first.', cs: 'Ukáže ji jen vzhled Rozhovor, menší, přes okraj první.' }),
    timeline: f.list({
      fields: {
        when: f.text({ required: true }).label({ en: 'When', cs: 'Kdy' }).help({ en: 'For example “2010–2018” or “Since 2022”.', cs: 'Například „2010–2018“ nebo „Od 2022“.' }),
        text: f.text({ required: true }).label({ en: 'What', cs: 'Co' }),
      },
      max: 6, itemLabel: { en: 'Line', cs: 'Řádek' },
    }).label({ en: 'Dated list', cs: 'Seznam s daty' }),
  },
})

const articles = defineBlock({
  label: { en: 'Articles', cs: 'Články' },
  description: { en: 'The newest articles from the Articles section.', cs: 'Nejnovější články ze sekce Články.' },
  icon: 'i-lucide-newspaper',
  fields: {
    eyebrow: eyebrow({ en: 'Business Card writes it above the heading.', cs: 'Vzhled Vizitka ho napíše nad nadpis.' }),
    question: question(),
    heading: heading(),
    text: text({ en: 'Business Card writes it under the heading.', cs: 'Vzhled Vizitka ho napíše pod nadpis.' }),
    count: f.number({ int: true, min: 0, max: 50 }).label({ en: 'How many articles', cs: 'Kolik článků' }).help({ en: 'The newest ones. 0 shows all of them.', cs: 'Nejnovější. Nula ukáže všechny.' }),
    linkLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'For example “All articles”. Leave it empty for no link.', cs: 'Například „Všechny články“. Když pole necháte prázdné, odkaz se nezobrazí.' }),
    linkUrl: link('Link destination', 'Cíl odkazu'),
  },
})

const contact = defineBlock({
  label: { en: 'Contact and form', cs: 'Kontakt s formulářem' },
  description: { en: 'Your phone, e-mail and address from Site settings beside a form. The messages arrive in the admin.', cs: 'Váš telefon, e-mail a adresa z Nastavení webu vedle formuláře. Zprávy najdete v administraci.' },
  icon: 'i-lucide-mail',
  fields: {
    eyebrow: eyebrow({ en: 'Business Card writes it above the heading.', cs: 'Vzhled Vizitka ho napíše nad nadpis.' }),
    question: question(),
    heading: heading(),
    text: text(),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' }).help({ en: 'Only Conversation shows it, above your contacts.', cs: 'Ukáže ji jen vzhled Rozhovor, nad kontakty.' }),
    formTitle: f.text().label({ en: 'Line above the form', cs: 'Řádek nad formulářem' }).help({ en: 'Only Conversation shows it, on the card of the form.', cs: 'Ukáže ji jen vzhled Rozhovor, na kartě formuláře.' }),
    times: f.list({
      fields: { name: f.text({ required: true }).label({ en: 'Choice', cs: 'Možnost' }) },
      max: 6, itemLabel: { en: 'Choice', cs: 'Možnost' },
    }).label({ en: 'When the call suits them', cs: 'Kdy se hovor hodí' })
      .help({ en: 'The choices of the question, for example “Mornings 9–12”. Leave the list empty and the form does not ask.', cs: 'Možnosti otázky, například „Dopoledne 9–12“. Když seznam necháte prázdný, formulář se neptá.' }),
    note: f.text().label({ en: 'Note beside the button', cs: 'Poznámka u tlačítka' }).help({ en: 'For example “I answer by the second working day.”', cs: 'Například „Odpovídám do druhého pracovního dne.“' }),
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
  blocks: { opening, services, projects, steps, testimonials, about, articles, contact, text: richText, ...customTypeBlocks() },
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
  formsPlugin(), // the messages of the form below
]

// ── the contact form ──
// The website draws it per look (the kit's useSiteForm). The question about when a call suits
// is worded by the owner in the "Contact and form" block: a list of choices.
export const Message = defineForm('message', {
  label: { en: 'Messages', cs: 'Zprávy' },
  labelSingular: { en: 'Message', cs: 'Zpráva' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }).help({ en: 'Jana Nováková', cs: 'Jana Nováková' }),
    email: f.text({ required: true, format: 'email' }).label({ en: 'E-mail', cs: 'E-mail' }).help({ en: 'jana@firma.example', cs: 'jana@firma.example' }),
    // The website shows a field's help inside it, as an example of what to write.
    message: f.text({ multiline: true, required: true, max: 5000 }).label({ en: 'What you need', cs: 'Co potřebujete' })
      .help({ en: 'A few sentences are enough: what you do, what you need written and by when.', cs: 'Pár vět stačí: co děláte, co chcete napsat a do kdy.' }),
    time: f.text({ max: 200 }).optional().label({ en: 'When the call suits you', cs: 'Kdy se vám hovor hodí' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send and arrange a call', cs: 'Odeslat a domluvit hovor' },
  successMessage: { en: 'Thank you, I have your message and will get back to you by the second working day.', cs: 'Děkuji, zprávu mám a ozvu se nejpozději druhý pracovní den.' },
})
export const FormSettings = defineFormSettings()
