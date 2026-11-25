import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Trades template: what a tradesman can write and change. One model
// for both looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní.',
  en: 'Text between *asterisks* stands out.',
}

// ── the whole site: who, how to reach you ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'Your name, phone number, opening hours, the look and the colours.', cs: 'Název firmy, telefon, kdy zvedáte, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'trade', 'logo', 'look', 'colors'] },
      { label: { en: 'Phone and hours', cs: 'Telefon a kdy zvedáte' }, fields: ['phone', 'hoursLine', 'hours', 'emergency', 'email', 'ctaLabel', 'ctaUrl'] },
      { label: { en: 'Company', cs: 'Firma' }, fields: ['legalName', 'address', 'companyId', 'register', 'areaLine', 'footerText'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the business', cs: 'Název firmy' })
      .help({ en: 'Written large in the header and the footer, for example “Novák”. A short name works best.', cs: 'Napíše se velkým písmem v záhlaví a v zápatí, například „Novák“. Nejlépe se hodí krátký název.' }),
    trade: f.text().optional().label({ en: 'What you do, in a few words', cs: 'Co děláte, pár slovy' })
      .help({ en: 'Under the name in the header and the footer, for example “water · heating · gas”. Mistr sets it in capitals under the name; Reflex shows it beside the name.', cs: 'Pod názvem v záhlaví a v zápatí, například „voda · topení · plyn“. Mistr ji napíše velkými písmeny pod název, Reflex vedle názvu.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the name and the line under it.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo názvu a řádku pod ním.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' })
      .help({ en: 'The number visitors call, written as you want it shown. It is in the header, the footer and the enquiry; Reflex sets it larger than anything else.', cs: 'Číslo, na které mají lidé volat, tak jak se má zobrazit. Je v záhlaví, v zápatí i u poptávky; Reflex ho vysází větší než cokoli jiného.' }),
    hoursLine: f.text().optional().label({ en: 'When you answer, in one line', cs: 'Kdy zvedáte, v jednom řádku' })
      .help({ en: 'For example “Mon–Fri 7–17, Sat 8–12”. It stands near the phone number.', cs: 'Například „po–pá 7–17, so 8–12“. Stojí u telefonního čísla.' }),
    hours: f.list({
      fields: {
        days: f.text({ required: true }).label({ en: 'Days', cs: 'Dny' }).help({ en: 'For example “Mon–Fri”.', cs: 'Například „Po–pá“.' }),
        time: f.text({ required: true }).label({ en: 'Hours', cs: 'Hodiny' }).help({ en: 'For example “7.00–17.00”.', cs: 'Například „7.00–17.00“.' }),
      },
      max: 6, itemLabel: { en: 'Row', cs: 'Řádek' },
    }).label({ en: 'Opening hours', cs: 'Hodiny' })
      .help({ en: 'The table in the footer.', cs: 'Tabulka v zápatí.' }),
    emergency: f.text().optional().label({ en: 'Emergency calls', cs: 'Havárie' })
      .help({ en: 'When you take an emergency call, for example “every day until 8 pm”. It follows the word “Emergencies”. Leave it empty if you do not.', cs: 'Kdy bereme havárie, například „denně do 20 hodin“. Navazuje na slovo „Havárie“. Když havárie neberete, nechte pole prázdné.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    legalName: f.text().optional().label({ en: 'Name for invoices', cs: 'Jméno pro fakturaci' })
      .help({ en: 'Your own name or the company’s. It heads the address in the footer and stands after the © sign.', cs: 'Vaše jméno nebo název firmy. Stojí nad adresou v zápatí a za značkou ©.' }),
    address: f.text({ multiline: true }).optional().label({ en: 'Address', cs: 'Adresa' })
      .help({ en: 'One line for the street, one for the town, as they should stand in the footer.', cs: 'Jeden řádek pro ulici a jeden pro město, tak jak mají stát v zápatí.' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    register: f.text().optional().label({ en: 'Register line', cs: 'Zápis v rejstříku' })
      .help({ en: 'For example “Registered in the trade register”.', cs: 'Například „Zapsán v živnostenském rejstříku“.' }),
    areaLine: f.text().optional().label({ en: 'Where you work', cs: 'Kde jezdíte' })
      .help({ en: 'A sentence above the header: the towns you cover. Mistr shows it (on a desktop); Reflex does not.', cs: 'Věta nad záhlavím: města, kam jezdíte. Ukáže ji Mistr (na počítači), Reflex ne.' }),
    footerText: f.text({ multiline: true }).optional().label({ en: 'Line under the name in the footer', cs: 'Věta pod názvem v zápatí' })
      .help({ en: 'Mistr shows it under the name; Reflex does not.', cs: 'Mistr ji ukáže pod názvem, Reflex ne.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── the price list ──
export const Service = defineEntity('service', {
  label: { en: 'Services', cs: 'Služby a ceník' },
  labelSingular: { en: 'Service', cs: 'Služba' },
  description: { en: 'What you do and what it costs. Drag to put the lines in order.', cs: 'Co děláte a kolik to stojí. Pořadí řádků změníte přetažením.' },
  icon: 'i-lucide-wrench',
  titleField: 'name',
  admin: { list: { columns: ['name', 'group', 'price', 'main'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    text: f.text().optional().label({ en: 'What is included', cs: 'Co je v ceně' }).help({ en: 'One line under the name.', cs: 'Jeden řádek pod názvem.' }),
    price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
    from: f.boolean().label({ en: 'Price “from”', cs: 'Cena „od“' })
      .help({ en: 'Turn it on when the price is where you begin. A fixed price is shown without “from”.', cs: 'Zapněte, když cena platí od určité částky. Pevná cena se napíše bez „od“.' }),
    unit: f.text().optional().label({ en: 'Per what', cs: 'Za co' })
      .help({ en: 'For example “hour”, “pc” or “m²”. Shown after the price.', cs: 'Například „hod“, „ks“ nebo „m²“. Napíše se za cenu.' }),
    group: f.text().optional().label({ en: 'Group', cs: 'Skupina' })
      .help({ en: 'Mistr groups the price list by this, for example “Water and drains”. Reflex shows one list without groups.', cs: 'Mistr podle ní ceník rozdělí, například „Voda a odpady“. Reflex ukáže jeden seznam bez skupin.' }),
    main: f.boolean().label({ en: 'One of the main rates', cs: 'Hlavní sazba' })
      .help({ en: 'Your hourly rate, the call-out and the emergency call-out. Reflex shows them as large black tiles above the list, Mistr as the first group.', cs: 'Hodinová sazba, výjezd a havarijní výjezd. Reflex je ukáže jako velké černé dlaždice nad ceníkem, Mistr jako první skupinu.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── finished jobs ──
export const Job = defineEntity('job', {
  label: { en: 'Jobs', cs: 'Zakázky' },
  labelSingular: { en: 'Job', cs: 'Zakázka' },
  description: { en: 'Work you have finished, with photographs. Each job has a page of its own.', cs: 'Hotové zakázky s fotografiemi. Každá zakázka má vlastní stránku.' },
  icon: 'i-lucide-hammer',
  titleField: 'title',
  admin: { list: { columns: ['title', 'place', 'date', 'featured'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Name of the job', cs: 'Název zakázky' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    place: f.text().optional().label({ en: 'Place', cs: 'Místo' }).help({ en: 'The town or village.', cs: 'Obec.' }),
    date: f.datetime({ allDay: true }).optional().label({ en: 'Finished', cs: 'Dokončeno' })
      .help({ en: 'Only the month and the year are shown.', cs: 'Zobrazí se jen měsíc a rok.' }),
    duration: f.text().optional().label({ en: 'How long it took', cs: 'Jak dlouho to trvalo' }).help({ en: 'For example “2 days”.', cs: 'Například „2 dny“.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'What was done', cs: 'Co se dělalo' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'For a job with a single photograph. When “before” and “after” are both set, they are shown instead.', cs: 'Pro zakázku s jednou fotografií. Když jsou vyplněné „před“ i „po“, zobrazí se místo ní.' }),
    before: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph before', cs: 'Fotografie před' })
      .help({ en: 'With “after” it makes a before-and-after pair, side by side.', cs: 'Spolu s „po“ vytvoří dvojici před a po, vedle sebe.' }),
    after: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph after', cs: 'Fotografie po' }),
    featured: f.boolean().label({ en: 'Show on the home page', cs: 'Na úvodní stránku' })
      .help({ en: 'The home page shows the jobs that are turned on here; the first of them is shown largest. All jobs are on the page of jobs.', cs: 'Úvodní stránka ukáže zakázky, které tu mají zapnuto; první z nich největší. Všechny zakázky jsou na stránce zakázek.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
    ...seo(),
  },
  content: { public: true, slug: 'slug', path: '/zakazka/:slug', populate: ['photo', 'before', 'after', 'ogImage'] },
})

// ── what customers say ──
export const Review = defineEntity('review', {
  label: { en: 'Reviews', cs: 'Recenze' },
  labelSingular: { en: 'Review', cs: 'Recenze' },
  description: { en: 'What your customers said, with their permission.', cs: 'Co o vás řekli zákazníci, s jejich svolením.' },
  icon: 'i-lucide-message-square-quote',
  titleField: 'name',
  admin: { list: { columns: ['name', 'town'], orderField: 'position' } },
  fields: {
    text: f.text({ required: true, multiline: true }).label({ en: 'What they said', cs: 'Co řekli' }),
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    town: f.text().optional().label({ en: 'Town', cs: 'Obec' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── where you work ──
export const Town = defineEntity('town', {
  label: { en: 'Towns you cover', cs: 'Kam jezdíte' },
  labelSingular: { en: 'Town', cs: 'Obec' },
  description: { en: 'The towns and villages you work in.', cs: 'Města a obce, kde pracujete.' },
  icon: 'i-lucide-map-pin',
  titleField: 'name',
  admin: { list: { columns: ['name', 'home'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Town', cs: 'Obec' }),
    home: f.boolean().label({ en: 'Where you are based', cs: 'Sídlo' })
      .help({ en: 'Marked in the list, for example with the word “base”.', cs: 'V seznamu bude zvýrazněná, například slovem „sídlo“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = (help?: { en: string; cs: string }) => f.text().label({ en: 'Small line above the heading', cs: 'Malý řádek nad nadpisem' })
  .help(help ?? { en: 'Reflex writes it above the heading; Mistr leaves it out.', cs: 'Reflex ho napíše nad nadpis, Mistr ho vynechá.' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).label({ en, cs })

const opening = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The first screen: what you do, where, a photograph of you and the phone number from Site settings.', cs: 'První obrazovka: co děláte a kde, vaše fotografie a telefon z Nastavení webu.' },
  icon: 'i-lucide-panel-top',
  fields: {
    eyebrow: f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' }).help({ en: 'For example “Plumber and heating engineer · Nová Paka”.', cs: 'Například „Instalatér a topenář · Nová Paka“.' }),
    heading: heading().help({ en: 'Text between *asterisks* stands out. Reflex sets the heading in huge type, so a few words fit best; the marked part goes on a line of its own on a phone.', cs: 'Text mezi *hvězdičkami* se zvýrazní. Reflex nadpis vysází obrovským písmem, nejlépe se hodí pár slov; označená část je na telefonu na vlastním řádku.' }),
    text: text(),
    image: photo('Photograph of you', 'Vaše fotografie').help({ en: 'Mistr shows it beside the heading, Reflex as a wide picture under the phone number.', cs: 'Mistr ji ukáže vedle nadpisu, Reflex jako širokou fotografii pod telefonním číslem.' }),
    imageCaption: f.text().label({ en: 'Its caption', cs: 'Její popisek' }),
    secondaryLabel: f.text().label({ en: 'Second button text', cs: 'Text druhého tlačítka' }).help({ en: 'The first button calls the number from Site settings.', cs: 'První tlačítko volá číslo z Nastavení webu.' }),
    secondaryUrl: link('Second button destination', 'Cíl druhého tlačítka'),
    note: f.text({ multiline: true }).label({ en: 'Note under the buttons', cs: 'Poznámka pod tlačítky' })
      .help({ en: 'For example when you answer and that you take emergencies. *Marked* text is bold. Mistr shows it; Reflex shows the hours from Site settings instead.', cs: 'Například kdy zvedáte a že berete havárie. *Označený* text je tučný. Ukáže ji Mistr; Reflex místo ní ukáže hodiny z Nastavení webu.' }),
  },
})

const facts = defineBlock({
  label: { en: 'Key figures', cs: 'Rychlá čísla' },
  description: { en: 'The four numbers people ask about first: the hourly rate, the call-out, the quote, the warranty.', cs: 'Čtyři údaje, na které se lidé ptají jako na první: hodinová sazba, výjezd, nabídka, záruka.' },
  icon: 'i-lucide-list-checks',
  fields: {
    items: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }).help({ en: 'For example “Hourly rate”.', cs: 'Například „Hodinová sazba“.' }),
        value: f.text({ required: true }).label({ en: 'Value', cs: 'Hodnota' }).help({ en: 'For example “590 Kč” or “free”.', cs: 'Například „590 Kč“ nebo „zdarma“.' }),
      },
      max: 4, itemLabel: { en: 'Figure', cs: 'Údaj' },
    }).label({ en: 'Figures', cs: 'Údaje' })
      .help({ en: 'Mistr shows them in a row under the opening, Reflex in heavy type between rules.', cs: 'Mistr je ukáže v řadě pod úvodem, Reflex velkým písmem mezi silnými linkami.' }),
  },
})

const prices = defineBlock({
  label: { en: 'Price list', cs: 'Ceník' },
  description: { en: 'The lines of the Services section, with a box of what the price always includes.', cs: 'Řádky ze sekce Služby a ceník a rámeček s tím, co je v ceně vždy.' },
  icon: 'i-lucide-receipt',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    includedTitle: f.text().label({ en: 'Title of what is included', cs: 'Nadpis toho, co je v ceně' }).help({ en: 'For example “Always included”.', cs: 'Například „V ceně je vždy“.' }),
    included: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }) },
      max: 6, itemLabel: { en: 'Line', cs: 'Řádek' },
    }).label({ en: 'What is always included', cs: 'Co je v ceně vždy' })
      .help({ en: 'Mistr shows it in a box beside the list, Reflex as small labels under it.', cs: 'Mistr to ukáže v rámečku vedle ceníku, Reflex jako malé štítky pod ním.' }),
    note: f.text().label({ en: 'Note under the box', cs: 'Poznámka pod rámečkem' }).help({ en: 'For example about VAT. Mistr shows it; Reflex does not.', cs: 'Například o DPH. Ukáže ji Mistr, Reflex ne.' }),
    linkLabel: f.text().label({ en: 'Link text under the list', cs: 'Text odkazu pod ceníkem' }).help({ en: 'Mistr shows it with the line next to it; Reflex does not.', cs: 'Mistr ho ukáže s větou vedle; Reflex ne.' }),
    linkUrl: link('Link destination', 'Cíl odkazu'),
    linkNote: f.text().label({ en: 'Line next to the link', cs: 'Věta vedle odkazu' }),
  },
})

const widePhoto = defineBlock({
  label: { en: 'Photograph across the page', cs: 'Fotografie přes celou šířku' },
  description: { en: 'One photograph edge to edge, with a caption.', cs: 'Jedna fotografie od kraje ke kraji s popiskem.' },
  icon: 'i-lucide-image',
  fields: {
    image: photo().help({ en: 'Reflex shows it edge to edge, Mistr in the page’s column with the caption under it.', cs: 'Reflex ji ukáže od kraje ke kraji, Mistr ve sloupci stránky s popiskem pod ní.' }),
    caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
  },
})

const jobs = defineBlock({
  label: { en: 'Finished jobs', cs: 'Dokončené zakázky' },
  description: { en: 'Jobs from the Jobs section: the ones marked for the home page, or all of them.', cs: 'Zakázky ze sekce Zakázky: ty označené pro úvodní stránku, nebo všechny.' },
  icon: 'i-lucide-hammer',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    count: f.number({ int: true, min: 1, max: 12 }).label({ en: 'How many to show', cs: 'Kolik jich ukázat' })
      .help({ en: 'Of the jobs marked for the home page.', cs: 'Z těch, které jsou označené pro úvodní stránku.' }),
    all: f.boolean().label({ en: 'Show every job', cs: 'Ukázat všechny zakázky' })
      .help({ en: 'For the page of all jobs. The link to it is left out.', cs: 'Pro stránku se všemi zakázkami. Odkaz na ni se vynechá.' }),
  },
})

const steps = defineBlock({
  label: { en: 'How it goes', cs: 'Jak to probíhá' },
  description: { en: 'Three to five steps from the first call to the handover.', cs: 'Tři až pět kroků od prvního telefonu po předání.' },
  icon: 'i-lucide-list-ordered',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    items: f.list({
      fields: {
        title: f.text({ required: true }).label({ en: 'Step', cs: 'Krok' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 5, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'Steps', cs: 'Kroky' }),
  },
})

const about = defineBlock({
  label: { en: 'About us', cs: 'O nás' },
  description: { en: 'Who comes to the customer: a photograph, a few paragraphs and your licences and insurance as plain lines.', cs: 'Kdo k zákazníkovi přijede: fotografie, pár odstavců a vaše oprávnění a pojištění jako prosté řádky.' },
  icon: 'i-lucide-users',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'An empty line starts a new paragraph.', cs: 'Prázdný řádek začíná nový odstavec.' }),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 2, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs of the team', cs: 'Fotografie týmu' })
      .help({ en: 'Mistr shows the first beside the text, with its caption; Reflex shows both in a pair under the section.', cs: 'Mistr ukáže první vedle textu s popiskem; Reflex obě jako dvojici pod sekcí.' }),
    ownerImage: photo('Photograph of you for Reflex', 'Vaše fotografie pro Reflex')
      .help({ en: 'Reflex sets it large beside the text. Leave it empty to use the photograph from the opening. Mistr does not show it here.', cs: 'Reflex ji vysází velkou vedle textu. Když pole necháte prázdné, použije se fotografie z úvodu. Mistr ji tady neukáže.' }),
    licencesTitle: f.text().label({ en: 'Title of the list below', cs: 'Nadpis seznamu níže' }).help({ en: 'For example “Licences and insurance”.', cs: 'Například „Oprávnění a pojištění“.' }),
    licences: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }) },
      max: 8, itemLabel: { en: 'Line', cs: 'Řádek' },
    }).label({ en: 'Licences and insurance', cs: 'Oprávnění a pojištění' }),
  },
})

const reviews = defineBlock({
  label: { en: 'Reviews', cs: 'Recenze' },
  description: { en: 'The first reviews of the Reviews section.', cs: 'První recenze ze sekce Recenze.' },
  icon: 'i-lucide-message-square-quote',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    count: f.number({ int: true, min: 1, max: 9 }).label({ en: 'How many to show', cs: 'Kolik jich ukázat' }),
  },
})

const area = defineBlock({
  label: { en: 'Where you work', cs: 'Kam jezdíte' },
  description: { en: 'The towns from the Towns section, with a word about the call-out price.', cs: 'Obce ze sekce Kam jezdíte a věta o ceně dopravy.' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    image: photo().help({ en: 'Mistr shows it under the text, Reflex as a wide picture under the list.', cs: 'Mistr ji ukáže pod textem, Reflex jako širokou fotografii pod seznamem.' }),
    note: f.text({ multiline: true }).label({ en: 'Note under the list', cs: 'Poznámka pod seznamem' }).help({ en: 'For example where you go by agreement.', cs: 'Například kam jezdíte po domluvě.' }),
  },
})

const enquiry = defineBlock({
  label: { en: 'Enquiry', cs: 'Poptávka' },
  description: { en: 'The enquiry form beside the phone number and the e-mail from Site settings. The enquiries arrive in the admin.', cs: 'Poptávkový formulář vedle telefonu a e-mailu z Nastavení webu. Poptávky najdete v administraci.' },
  icon: 'i-lucide-mail',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    callLabel: f.text().label({ en: 'Line above the phone number', cs: 'Řádek nad telefonem' }).help({ en: 'For example “In a hurry? Call.”.', cs: 'Například „Spěchá to? Volejte.“.' }),
    note: f.text().label({ en: 'Note next to the button', cs: 'Poznámka vedle tlačítka' }).help({ en: 'For example that the enquiry binds them to nothing.', cs: 'Například že poptávka k ničemu nezavazuje.' }),
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
  blocks: { opening, facts, prices, photo: widePhoto, jobs, steps, about, reviews, area, enquiry, text: richText, ...customTypeBlocks() },
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
  formsPlugin(), // the enquiries of the form below
]

// ── the enquiry form ──
// The website draws it per look (the kit's useSiteForm).
export const Enquiry = defineForm('enquiry', {
  label: { en: 'Enquiries', cs: 'Poptávky' },
  labelSingular: { en: 'Enquiry', cs: 'Poptávka' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    phone: f.text({ required: true, max: 50 }).label({ en: 'Phone', cs: 'Telefon' }).help({ en: 'e.g. 123 456 701', cs: 'např. 123 456 701' }),
    town: f.text({ required: true, max: 200 }).label({ en: 'Town', cs: 'Obec' }).help({ en: 'where the work is', cs: 'kde se má pracovat' }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'What you need', cs: 'Co potřebujete' })
      .help({ en: 'e.g. the tap by the washing machine drips, we want to replace a boiler from 2001…', cs: 'Např. kape kohout u pračky, chceme vyměnit kotel z roku 2001, potřebujeme rozvody v nové koupelně…' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send enquiry', cs: 'Odeslat poptávku' },
  successMessage: { en: 'Thank you, we have your enquiry. We will get back to you the same day, or the next working morning at the latest.', cs: 'Děkujeme, poptávku máme. Ozveme se týž den, nejpozději další pracovní den ráno.' },
})
export const FormSettings = defineFormSettings()
