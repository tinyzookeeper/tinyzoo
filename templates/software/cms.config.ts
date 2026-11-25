import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Software template: what the makers of a product can write and change.
// One model for all three looks (looks.ts): a look decides how a block is drawn, never what it
// holds. Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and
// `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou.',
  en: 'Text between *asterisks* stands out, for example in italics.',
}

// ── the whole site: the product, the support, the company ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The name of your product, the look and the colours, the sign-up button, support and company details.', cs: 'Název produktu, vzhled a barvy, tlačítko pro vyzkoušení, podpora a údaje o firmě.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors'] },
      { label: { en: 'Header and footer', cs: 'Záhlaví a zápatí' }, fields: ['ctaLabel', 'ctaLongLabel', 'ctaUrl', 'loginLabel', 'loginUrl', 'footerText'] },
      { label: { en: 'Support', cs: 'Podpora' }, fields: ['supportPhone', 'supportEmail', 'supportHours', 'statusUrl'] },
      { label: { en: 'Company', cs: 'Firma' }, fields: ['legalName', 'address', 'companyId', 'vatId', 'registry'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Product name', cs: 'Název produktu' })
      .help({ en: 'Written in the header and the footer.', cs: 'Píše se v záhlaví a v zápatí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header and the footer in place of the drawn mark.', cs: 'Nahrajte vlastní logo a v záhlaví a v zápatí se zobrazí místo nakresleného znaku.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' })
      .help({ en: 'The main button of the header, for example “Try it free”.', cs: 'Hlavní tlačítko záhlaví, například „Vyzkoušet zdarma“.' }),
    ctaLongLabel: f.text().optional().label({ en: 'The same button in the phone menu', cs: 'Totéž tlačítko v nabídce na telefonu' })
      .help({ en: 'A longer text for the phone’s menu, for example “Try it free for 30 days”. Left empty, the text of the header button is used.', cs: 'Delší text pro nabídku na telefonu, například „Vyzkoušet 30 dní zdarma“. Když pole necháte prázdné, použije se text tlačítka v záhlaví.' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' })
      .help({ en: 'Usually the sign-up section of the home page.', cs: 'Obvykle sekce s výzvou na úvodní stránce.' }),
    loginLabel: f.text().optional().label({ en: 'Sign-in link text', cs: 'Text odkazu pro přihlášení' }),
    loginUrl: f.text({ format: 'link' }).optional().label({ en: 'Sign-in link destination', cs: 'Cíl odkazu pro přihlášení' })
      .help({ en: 'The page where people sign in to your product.', cs: 'Stránka, kde se lidé přihlašují do vašeho produktu.' }),
    footerText: f.text({ multiline: true }).optional().label({ en: 'Text under the footer logo', cs: 'Text pod logem v zápatí' })
      .help({ en: 'Two short sentences about the product and who makes it.', cs: 'Dvě krátké věty o produktu a o tom, kdo ho dělá.' }),
    supportPhone: f.text().optional().label({ en: 'Support phone', cs: 'Telefon podpory' }),
    supportEmail: f.text({ format: 'email' }).optional().label({ en: 'Support e-mail', cs: 'E-mail podpory' }),
    supportHours: f.text().optional().label({ en: 'Support hours', cs: 'Hodiny podpory' })
      .help({ en: 'As you want them written, for example “Monday to Friday 8–17”.', cs: 'Tak, jak je chcete napsat, například „pondělí až pátek 8–17“.' }),
    statusUrl: f.text({ format: 'url' }).optional().label({ en: 'Status page', cs: 'Stavová stránka' })
      .help({ en: 'Where people see whether the service runs. Its address is written in the footer.', cs: 'Kde lidé vidí, zda služba běží. Její adresa se píše v zápatí.' }),
    legalName: f.text().optional().label({ en: 'Company name', cs: 'Název firmy' }),
    address: f.text().optional().label({ en: 'Company address', cs: 'Adresa firmy' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    vatId: f.text().optional().label({ en: 'VAT number (DIČ)', cs: 'DIČ' }),
    registry: f.text().optional().label({ en: 'Entry in the register', cs: 'Zápis v rejstříku' })
      .help({ en: 'For example “registered at the Regional Court in Ostrava, section C, file 12345”.', cs: 'Například „zapsaná u Krajského soudu v Ostravě, oddíl C, vložka 12345“.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── what the product does ──
const SCREEN_LABELS = {
  none: { en: 'None', cs: 'Žádná' },
  week: { en: 'Week grid', cs: 'Týdenní rozpis' },
  template: { en: 'New week from a template', cs: 'Nový týden ze šablony' },
  swap: { en: 'Swapping a shift on a phone', cs: 'Výměna směny v telefonu' },
  attendance: { en: 'Attendance list', cs: 'Seznam docházky' },
  payroll: { en: 'Payroll table', cs: 'Tabulka podkladů pro mzdy' },
} as const
const SCREENS = ['none', 'week', 'template', 'swap', 'attendance', 'payroll'] as const

export const Feature = defineEntity('feature', {
  label: { en: 'Features', cs: 'Funkce' },
  labelSingular: { en: 'Feature', cs: 'Funkce' },
  description: { en: 'What the product does, each as one real moment of one real user, with the screen it is about. Drag to put them in order.', cs: 'Co produkt umí, každá věc jako jeden skutečný okamžik jednoho skutečného uživatele a obrazovka, o které je řeč. Pořadí změníte přetažením.' },
  icon: 'i-lucide-layout-grid',
  titleField: 'title',
  admin: { list: { columns: ['title', 'when'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' })
      .help({ en: 'The heading of the feature. Magnets writes it as a small label above the question.', cs: 'Nadpis funkce. Vzhled Magnety ho píše jako malý štítek nad otázkou.' }),
    question: f.text().optional().label({ en: 'Question', cs: 'Otázka' })
      .help({ en: 'Magnets sets this as the large heading of the feature, for example “Who has the morning shift tomorrow?”. The other looks leave it out. Left empty, the title is used.', cs: 'Vzhled Magnety ji vysází jako velký nadpis funkce, například „Kdo má zítra ranní?“. Ostatní vzhledy ji vynechají. Když pole necháte prázdné, použije se název.' }),
    when: f.text().optional().label({ en: 'When and where', cs: 'Kdy a kde' })
      .help({ en: 'The moment the feature is about, for example “Thursday 6:40 · café, Olomouc”. Manual and One Day write it above the title, Magnets in bold before the text.', cs: 'Okamžik, o kterém funkce je, například „čtvrtek 6:40 · kavárna, Olomouc“. Návod a Jeden den ho píší nad název, Magnety tučně před text.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
    note: f.text({ multiline: true }).optional().label({ en: 'A second, smaller line', cs: 'Druhá, menší věta' })
      .help({ en: 'One Day sets it as a smaller paragraph under the text, Magnets as a small caption under the screen. Manual leaves it out.', cs: 'Jeden den ji vysází jako menší odstavec pod text, Magnety jako malý popisek pod obrazovku. Návod ji vynechá.' }),
    points: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Point', cs: 'Bod' }) },
      max: 5, itemLabel: { en: 'Point', cs: 'Bod' },
    }).label({ en: 'Points', cs: 'Body' })
      .help({ en: 'Short lines about what the feature does. Manual numbers them beside the screen, Magnets ticks the first feature’s, One Day leaves them out.', cs: 'Krátké řádky o tom, co funkce dělá. Návod je očísluje vedle obrazovky, Magnety odškrtá ty u první funkce, Jeden den je vynechá.' }),
    screen: f.select({ options: SCREENS, default: 'none', labels: SCREEN_LABELS }).label({ en: 'Drawn screen', cs: 'Nakreslená obrazovka' })
      .help({ en: 'A screen of the product, drawn by the website itself. Upload a screenshot below to show your own instead.', cs: 'Obrazovka produktu, kterou web nakreslí sám. Nahrajete-li níže snímek obrazovky, ukáže se místo ní váš vlastní.' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Screenshot', cs: 'Snímek obrazovky' })
      .help({ en: 'Your own screenshot of the product. It takes the place of the drawn screen.', cs: 'Váš vlastní snímek obrazovky produktu. Zabere místo nakreslené obrazovky.' }),
    caption: f.text().optional().label({ en: 'Caption of the figure', cs: 'Popisek obrázku' })
      .help({ en: 'Manual writes it under the figure, after its number (“Fig. 2”).', cs: 'Návod ho píše pod obrázek za jeho číslo („Obr. 2“).' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'A photograph of a customer at work. Magnets and One Day show it beside the screen. Manual leaves it out.', cs: 'Fotografie zákazníka při práci. Magnety a Jeden den ji ukážou vedle obrazovky. Návod ji vynechá.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['image', 'photo'] },
})

// ── prices ──
export const Plan = defineEntity('plan', {
  label: { en: 'Plans', cs: 'Tarify' },
  labelSingular: { en: 'Plan', cs: 'Tarif' },
  description: { en: 'The plans of the price list, with the monthly price and the price when paid for a year. Drag to put them in order.', cs: 'Tarify ceníku s cenou za měsíc a cenou při roční platbě. Pořadí změníte přetažením.' },
  icon: 'i-lucide-badge-dollar-sign',
  titleField: 'name',
  admin: { list: { columns: ['name', 'monthly', 'yearly', 'highlighted'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    forWhom: f.text().optional().label({ en: 'For whom', cs: 'Pro koho' }).help({ en: 'One short line under the name.', cs: 'Jedna krátká věta pod názvem.' }),
    monthly: f.number({ int: true, min: 0 }).label({ en: 'Price per month in Kč', cs: 'Cena za měsíc v Kč' })
      .help({ en: 'Without VAT. Paid month by month.', cs: 'Bez DPH. Při platbě po měsících.' }),
    yearly: f.number({ int: true, min: 0 }).label({ en: 'Price per month when paid yearly, in Kč', cs: 'Cena za měsíc při roční platbě v Kč' })
      .help({ en: 'The monthly price of the yearly payment, for example 240. The website works out what is paid for the year (twelve times that).', cs: 'Měsíční cena při roční platbě, například 240. Web sám spočítá, kolik se platí za rok (dvanáctinásobek).' }),
    items: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Line', cs: 'Řádek' }) },
      max: 10, itemLabel: { en: 'Line', cs: 'Řádek' },
    }).label({ en: 'What it includes', cs: 'Co obsahuje' }),
    highlighted: f.boolean().label({ en: 'Highlighted', cs: 'Zvýrazněný' })
      .help({ en: 'The plan most people choose. Each look sets it apart.', cs: 'Tarif, který volí většina. Každý vzhled ho odliší.' }),
    badge: f.text().optional().label({ en: 'Label of the highlighted plan', cs: 'Štítek zvýrazněného tarifu' }).help({ en: 'For example “Most people choose it”.', cs: 'Například „Volí ho většina“.' }),
    buttonLabel: f.text().optional().label({ en: 'Button text', cs: 'Text tlačítka' })
      .help({ en: 'The button leads to the destination of the header button. Left empty, the header button’s text is used.', cs: 'Tlačítko vede tam, kam tlačítko v záhlaví. Když pole necháte prázdné, použije se jeho text.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

export const PlanLimit = defineEntity('planLimit', {
  label: { en: 'Limits of the plans', cs: 'Limity tarifů' },
  labelSingular: { en: 'Limit', cs: 'Limit' },
  description: { en: 'The rows of the comparison table under the plans. Drag to put them in order.', cs: 'Řádky srovnávací tabulky pod tarify. Pořadí změníte přetažením.' },
  icon: 'i-lucide-table',
  titleField: 'name',
  admin: { list: { columns: ['name'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name of the limit', cs: 'Název limitu' }).help({ en: 'For example “People in the schedule”.', cs: 'Například „Lidé v rozpisu“.' }),
    values: f.list({
      fields: { value: f.text().label({ en: 'Value', cs: 'Hodnota' }) },
      max: 6, itemLabel: { en: 'Value', cs: 'Hodnota' },
    }).label({ en: 'Values, one for each plan', cs: 'Hodnoty, jedna pro každý tarif' })
      .help({ en: 'In the order of the plans: the first value belongs to the first plan, and so on.', cs: 'V pořadí tarifů: první hodnota patří prvnímu tarifu a tak dále.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the changelog ──
export const Release = defineEntity('release', {
  label: { en: 'Changelog', cs: 'Novinky' },
  labelSingular: { en: 'Release', cs: 'Novinka' },
  description: { en: 'What changed in each version. The website lists the newest first.', cs: 'Co se změnilo v které verzi. Web je řadí od nejnovější.' },
  icon: 'i-lucide-history',
  titleField: 'title',
  admin: { list: { columns: ['version', 'title', 'date'] } },
  fields: {
    date: f.datetime({ allDay: true }).label({ en: 'Date', cs: 'Datum' }),
    version: f.text({ required: true, max: 20 }).label({ en: 'Version', cs: 'Verze' }).help({ en: 'For example “3.8”.', cs: 'Například „3.8“.' }),
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Titulek' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }).help({ en: 'One or two sentences.', cs: 'Jedna nebo dvě věty.' }),
  },
  content: { public: true },
})

// ── customers ──
export const Testimonial = defineEntity('testimonial', {
  label: { en: 'Testimonials', cs: 'Reference' },
  labelSingular: { en: 'Testimonial', cs: 'Reference' },
  description: { en: 'What your customers say, with their portrait. Drag to put them in order.', cs: 'Co říkají vaši zákazníci, s jejich portrétem. Pořadí změníte přetažením.' },
  icon: 'i-lucide-quote',
  titleField: 'name',
  admin: { list: { columns: ['name', 'role', 'featured'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    role: f.text().optional().label({ en: 'Line and place', cs: 'Obor a místo' }).help({ en: 'For example “café, Olomouc”.', cs: 'Například „kavárna, Olomouc“.' }),
    text: f.text({ required: true, multiline: true }).label({ en: 'What they say', cs: 'Co říkají' }).help({ en: 'Without quotation marks: the website adds them.', cs: 'Bez uvozovek: doplní je web.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Portrait', cs: 'Portrét' }).help({ en: 'A square portrait.', cs: 'Čtvercový portrét.' }),
    featured: f.boolean().label({ en: 'Featured', cs: 'Hlavní reference' })
      .help({ en: 'One Day sets the first featured testimonial large, with a tall portrait. The other looks show all of them alike.', cs: 'Jeden den první hlavní referenci vysází velkou, s vysokým portrétem. Ostatní vzhledy ukážou všechny stejně.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo'] },
})

// ── questions ──
export const Question = defineEntity('question', {
  label: { en: 'Questions', cs: 'Otázky' },
  labelSingular: { en: 'Question', cs: 'Otázka' },
  description: { en: 'What people ask before they trust you with their data. Drag to put them in order.', cs: 'Na co se lidé ptají, než vám svěří svá data. Pořadí změníte přetažením.' },
  icon: 'i-lucide-circle-help',
  titleField: 'question',
  admin: { list: { columns: ['question'], orderField: 'position' } },
  fields: {
    question: f.text({ required: true }).label({ en: 'Question', cs: 'Otázka' }),
    answer: f.text({ required: true, multiline: true }).label({ en: 'Answer', cs: 'Odpověď' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).optional().label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).optional().label({ en, cs })
// One Day lays the page out as one working day, each section an entry in a time rail.
const moment = () => ({
  time: f.text({ max: 10 }).label({ en: 'Time of the day', cs: 'Čas dne' })
    .help({ en: 'One Day writes it in the rail beside the section, for example “07:00”; its icon follows the hour (sunrise, sun, sunset, moon). The other looks leave it out.', cs: 'Jeden den ho píše do časové osy vedle sekce, například „07:00“; ikona se řídí hodinou (východ, slunce, západ, měsíc). Ostatní vzhledy ho vynechají.' }),
  timeNote: f.text().label({ en: 'Words under the time', cs: 'Slova pod časem' })
    .help({ en: 'For example “the shop is getting going”. One Day writes it under the time.', cs: 'Například „provoz se rozjíždí“. Jeden den je napíše pod čas.' }),
})

const opening = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The first screen: what the product is, a button to try it and a screen of the product.', cs: 'První obrazovka: co produkt je, tlačítko pro vyzkoušení a obrazovka produktu.' },
  icon: 'i-lucide-panel-top',
  fields: {
    eyebrow: eyebrow().help({ en: 'A short line above the heading, for example “Web and mobile app”. Magnets leaves it out.', cs: 'Krátký řádek nad nadpisem, například „Webová a mobilní aplikace“. Magnety ho vynechá.' }),
    heading: heading().help({ en: 'The main heading of the page. Magnets sets it as three bars on a week grid: the words are split into three bars. Emphasis is not used there.', cs: 'Hlavní nadpis stránky. Magnety ho vysází na tři pruhy týdenní tabule: slova se rozdělí na tři pruhy. Zvýraznění tam nepoužijete.' }),
    text: text().help({ en: 'Text between *asterisks* is set in bold.', cs: 'Text mezi *hvězdičkami* se vysází tučně.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'Leave it empty for no link. Magnets leaves it out.', cs: 'Když pole necháte prázdné, odkaz se nezobrazí. Magnety ho vynechají.' }),
    secondaryUrl: link('Link destination', 'Cíl odkazu'),
    note: f.text().label({ en: 'Line under the button', cs: 'Řádek pod tlačítkem' }),
    facts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }).help({ en: 'For example “Data”.', cs: 'Například „Data“.' }),
        value: f.text({ required: true }).label({ en: 'Value', cs: 'Hodnota' }).help({ en: 'For example “on servers in Prague”.', cs: 'Například „na serverech v Praze“.' }),
      },
      max: 3, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'Three facts', cs: 'Tři údaje' })
      .help({ en: 'Manual writes them in a row under the button. The other looks leave them out.', cs: 'Návod je napíše do řady pod tlačítko. Ostatní vzhledy je vynechají.' }),
    screen: f.select({ options: SCREENS, default: 'none', labels: SCREEN_LABELS }).label({ en: 'Drawn screen', cs: 'Nakreslená obrazovka' })
      .help({ en: 'Manual shows it as the first figure, One Day shows a phone (the swap of a shift). Magnets draws its own board and leaves it out.', cs: 'Návod ji ukáže jako první obrázek, Jeden den ukáže telefon (výměna směny). Magnety kreslí vlastní tabuli a pole vynechají.' }),
    image: photo('Screenshot', 'Snímek obrazovky').help({ en: 'Your own screenshot. It takes the place of the drawn screen in Manual.', cs: 'Váš vlastní snímek obrazovky. Ve vzhledu Návod zabere místo nakreslené obrazovky.' }),
    caption: f.text().label({ en: 'Caption of the figure', cs: 'Popisek obrázku' }).help({ en: 'Manual writes it under the first figure.', cs: 'Návod ho píše pod první obrázek.' }),
    notes: f.list({
      fields: {
        title: f.text({ required: true }).label({ en: 'Bold start', cs: 'Tučný začátek' }),
        text: f.text().label({ en: 'Rest', cs: 'Zbytek' }),
      },
      max: 4, itemLabel: { en: 'Note', cs: 'Poznámka' },
    }).label({ en: 'Numbered notes to the figure', cs: 'Očíslované poznámky k obrázku' })
      .help({ en: 'Manual numbers them like the callouts on the figure. The other looks leave them out.', cs: 'Návod je očísluje jako číslice na obrázku. Ostatní vzhledy je vynechají.' }),
    photo: photo('Photograph', 'Fotografie').help({ en: 'A photograph of a customer. Magnets and One Day show it beside the heading. Manual leaves it out.', cs: 'Fotografie zákazníka. Magnety a Jeden den ji ukážou vedle nadpisu. Návod ji vynechá.' }),
    ...moment(),
  },
})

const audience = defineBlock({
  label: { en: 'Who uses it', cs: 'Kdo to používá' },
  description: { en: 'The kinds of customers, with photographs and a few words.', cs: 'Druhy zákazníků s fotografiemi a pár slovy.' },
  icon: 'i-lucide-users',
  fields: {
    eyebrow: eyebrow().help({ en: 'Manual writes the number of the section before it.', cs: 'Návod před něj napíše číslo sekce.' }),
    heading: heading(),
    text: text(),
    tags: f.list({
      fields: { text: f.text({ required: true }).label({ en: 'Tag', cs: 'Štítek' }) },
      max: 10, itemLabel: { en: 'Tag', cs: 'Štítek' },
    }).label({ en: 'Kinds of business', cs: 'Druhy provozů' })
      .help({ en: 'Short words, for example “cafés”. Magnets and One Day set them as pills; Manual leaves them out.', cs: 'Krátká slova, například „kavárny“. Magnety a Jeden den je vysází jako štítky, Návod je vynechá.' }),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        title: f.text({ required: true }).label({ en: 'Name and place', cs: 'Jméno a místo' }),
        caption: f.text().label({ en: 'A few words', cs: 'Pár slov' }),
      },
      max: 6, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs of customers', cs: 'Fotografie zákazníků' })
      .help({ en: 'Manual shows up to four in a row (a swipe row on a phone). Magnets shows the first one, One Day all of them as cards.', cs: 'Návod jich ukáže až čtyři v řadě (na telefonu se přejíždí prstem). Magnety ukážou první, Jeden den všechny jako karty.' }),
    ...moment(),
  },
})

const features = defineBlock({
  label: { en: 'Features', cs: 'Co umí' },
  description: { en: 'The features from the Features section, each with the screen it is about.', cs: 'Funkce ze sekce Funkce, každá s obrazovkou, o které je řeč.' },
  icon: 'i-lucide-layout-grid',
  fields: {
    eyebrow: eyebrow().help({ en: 'Manual writes the number of the section before it. Magnets leaves it out.', cs: 'Návod před něj napíše číslo sekce. Magnety ho vynechají.' }),
    heading: heading().help({ en: 'Magnets does not show it (its features have headings of their own): screen readers still read it.', cs: 'Magnety ho nezobrazí (jejich funkce mají nadpisy vlastní), čtečky obrazovky ho přečtou.' }),
    text: text().help({ en: 'Magnets leaves it out.', cs: 'Magnety ho vynechají.' }),
    ...moment(),
  },
})

const pricing = defineBlock({
  label: { en: 'Price list', cs: 'Ceník' },
  description: { en: 'The plans, a switch between monthly and yearly payment, the limits of each plan and what happens after the trial.', cs: 'Tarify, přepínač měsíční a roční platby, limity tarifů a co se stane po zkušební době.' },
  icon: 'i-lucide-badge-dollar-sign',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    yearlyNote: f.text().label({ en: 'Note about yearly payment', cs: 'Poznámka k roční platbě' })
      .help({ en: 'Written under the switch between monthly and yearly payment. Leave it empty if the text above already says it.', cs: 'Píše se pod přepínač měsíční a roční platby. Když to říká už text nad ním, pole nechte prázdné.' }),
    afterLabel: f.text().label({ en: 'Line above what happens after the trial', cs: 'Řádek nad tím, co bude po zkušební době' }).help({ en: 'For example “After the trial”.', cs: 'Například „Po zkušební době“.' }),
    afterText: text().label({ en: 'What happens after the trial', cs: 'Co bude po zkušební době' }),
    afterNote: f.text({ multiline: true }).label({ en: 'A line more after the trial', cs: 'Ještě jedna věta k tomu' })
      .help({ en: 'Shown after the text above. Leave it empty if that text says it all.', cs: 'Ukáže se za textem výše. Když ten text řekne všechno, pole nechte prázdné.' }),
    moreText: f.text().label({ en: 'Line for bigger businesses', cs: 'Věta pro větší provozy' })
      .help({ en: 'For example “More than 50 people? *Write to us*, we will agree.”. The marked part becomes a link to the contact form.', cs: 'Například „Máte víc než 50 lidí? *Napište nám*, domluvíme se.“. Označená část se stane odkazem na kontaktní formulář.' }),
    ...moment(),
  },
})

const testimonials = defineBlock({
  label: { en: 'Testimonials', cs: 'Reference' },
  description: { en: 'The testimonials from the Testimonials section.', cs: 'Reference ze sekce Reference.' },
  icon: 'i-lucide-quote',
  fields: {
    eyebrow: eyebrow().help({ en: 'Magnets writes it above the heading. The other looks leave it out.', cs: 'Magnety ho píší nad nadpis. Ostatní vzhledy ho vynechají.' }),
    heading: heading().help({ en: 'Manual does not show it (the section continues the one above): screen readers still read it.', cs: 'Návod ho nezobrazí (sekce navazuje na tu nad sebou), čtečky obrazovky ho přečtou.' }),
    ...moment(),
  },
})

const changelog = defineBlock({
  label: { en: 'Changelog', cs: 'Novinky' },
  description: { en: 'The newest releases from the Changelog section.', cs: 'Nejnovější verze ze sekce Novinky.' },
  icon: 'i-lucide-history',
  fields: {
    eyebrow: eyebrow().help({ en: 'Manual writes the number of the section before it. Magnets writes it above the heading.', cs: 'Návod před něj napíše číslo sekce. Magnety ho píší nad nadpis.' }),
    heading: heading(),
    text: text(),
    linkLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'For example “All releases since 2021”. Leave it empty for no link.', cs: 'Například „Všechny novinky od roku 2021“. Když pole necháte prázdné, odkaz se nezobrazí.' }),
    linkUrl: link('Link destination', 'Cíl odkazu'),
    count: f.number({ int: true, min: 0 }).label({ en: 'How many releases to show', cs: 'Kolik novinek ukázat' })
      .help({ en: 'The newest ones. 0 shows all of them (for a page of its own).', cs: 'Nejnovější. 0 ukáže všechny (pro stránku o samotných novinkách).' }),
    image: photo('Photograph', 'Fotografie').help({ en: 'One Day shows it under the text, with its caption. The other looks leave it out.', cs: 'Jeden den ji ukáže pod textem, s popiskem. Ostatní vzhledy ji vynechají.' }),
    imageCaption: f.text().label({ en: 'Caption of the photograph', cs: 'Popisek fotografie' }),
    ...moment(),
  },
})

const questions = defineBlock({
  label: { en: 'Questions and answers', cs: 'Otázky a odpovědi' },
  description: { en: 'The questions from the Questions section, each opening to its answer.', cs: 'Otázky ze sekce Otázky, každá se otevře na odpověď.' },
  icon: 'i-lucide-circle-help',
  fields: {
    eyebrow: eyebrow().help({ en: 'Manual writes the number of the section before it. Magnets writes it above the heading.', cs: 'Návod před něj napíše číslo sekce. Magnety ho píší nad nadpis.' }),
    heading: heading(),
    text: text().help({ en: 'For example “Is your question missing? *Ask us.*”. The marked part becomes a link to the contact form.', cs: 'Například „Chybí tu vaše otázka? *Zeptejte se nás.*“. Označená část se stane odkazem na kontaktní formulář.' }),
    ...moment(),
  },
})

const team = defineBlock({
  label: { en: 'Who makes it, and the contact form', cs: 'Kdo to dělá a kontaktní formulář' },
  description: { en: 'A few words about the team with a photograph, where the data is and how to reach support (from Site settings), and a contact form.', cs: 'Pár slov o týmu s fotografií, kde jsou data a jak se dovolat podpory (z Nastavení webu), a kontaktní formulář.' },
  icon: 'i-lucide-users-round',
  fields: {
    eyebrow: eyebrow().help({ en: 'Manual writes the number of the section before it. Magnets writes it above the heading.', cs: 'Návod před něj napíše číslo sekce. Magnety ho píší nad nadpis.' }),
    heading: heading(),
    text: text().help({ en: 'Separate paragraphs with an empty line.', cs: 'Odstavce oddělte prázdným řádkem.' }),
    image: photo('Photograph of the team', 'Fotografie týmu'),
    imageCaption: f.text().label({ en: 'Caption of the photograph', cs: 'Popisek fotografie' }).help({ en: 'Manual writes it under the photograph, after its number.', cs: 'Návod ho píše pod fotografii za její číslo.' }),
    dataLabel: f.text().label({ en: 'Where the data is: title', cs: 'Kde jsou data: nadpis' }).help({ en: 'For example “Where the data is”.', cs: 'Například „Kde jsou data“.' }),
    dataHeadline: f.text().label({ en: 'Where the data is: headline', cs: 'Kde jsou data: hlavní věta' }),
    dataText: f.text().label({ en: 'Where the data is: a line more', cs: 'Kde jsou data: ještě věta' }),
    supportLabel: f.text().label({ en: 'Support: title', cs: 'Podpora: nadpis' }).help({ en: 'The hours, phone and e-mail come from Site settings.', cs: 'Hodiny, telefon a e-mail se berou z Nastavení webu.' }),
    outsideLabel: f.text().label({ en: 'Out of hours: title', cs: 'Mimo hodiny: nadpis' }).help({ en: 'Manual writes it as a third row.', cs: 'Návod ho píše jako třetí řádek.' }),
    outsideText: f.text().label({ en: 'Out of hours: text', cs: 'Mimo hodiny: text' }),
    formEyebrow: f.text().label({ en: 'Form: line above the heading', cs: 'Formulář: řádek nad nadpisem' }).help({ en: 'Magnets only.', cs: 'Jen Magnety.' }),
    formHeading: f.text({ required: true }).label({ en: 'Form: heading', cs: 'Formulář: nadpis' }),
    formText: f.text({ multiline: true }).label({ en: 'Form: text', cs: 'Formulář: text' }),
    formNote: f.text().label({ en: 'Form: small print', cs: 'Formulář: drobný text' })
      .help({ en: 'Beside the button. A *marked* part becomes a link to the privacy page. Magnets leaves it out.', cs: 'Vedle tlačítka. *Označená* část se stane odkazem na stránku o ochraně údajů. Magnety ho vynechají.' }),
    ...moment(),
  },
})

const contact = defineBlock({
  label: { en: 'Contact form', cs: 'Kontaktní formulář' },
  description: { en: 'Only the contact form, for a page of its own. The messages arrive in the admin.', cs: 'Jen kontaktní formulář, pro stránku o samotném kontaktu. Zprávy najdete v administraci.' },
  icon: 'i-lucide-mail',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    note: f.text().label({ en: 'Small print', cs: 'Drobný text' }).help({ en: 'Beside the button. A *marked* part becomes a link to the privacy page.', cs: 'Vedle tlačítka. *Označená* část se stane odkazem na stránku o ochraně údajů.' }),
    ...moment(),
  },
})

const cta = defineBlock({
  label: { en: 'Try it', cs: 'Výzva k vyzkoušení' },
  description: { en: 'The closing call: a heading and a field for an e-mail address. The addresses arrive in the admin.', cs: 'Závěrečná výzva: nadpis a pole pro e-mail. Zadané adresy najdete v administraci.' },
  icon: 'i-lucide-rocket',
  fields: {
    eyebrow: eyebrow().help({ en: 'Magnets leaves it out.', cs: 'Magnety ho vynechají.' }),
    heading: heading().help({ en: 'Magnets splits the words into three bars, like the opening.', cs: 'Magnety slova rozdělí na tři pruhy jako v úvodu.' }),
    text: text().help({ en: 'Text between *asterisks* is set in bold.', cs: 'Text mezi *hvězdičkami* se vysází tučně.' }),
    buttonLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    ...moment(),
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
  blocks: { opening, audience, features, pricing, testimonials, changelog, questions, team, contact, cta, text: richText, ...customTypeBlocks() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    product: { en: 'Footer: product', cs: 'Zápatí: produkt' },
    support: { en: 'Footer: support', cs: 'Zápatí: podpora' },
    legal: { en: 'Footer: legal', cs: 'Zápatí: právní' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the two forms below
]

// ── the contact form ──
// The website draws it per look (the kit's useSiteForm).
export const Contact = defineForm('contact', {
  label: { en: 'Messages', cs: 'Zprávy' },
  labelSingular: { en: 'Message', cs: 'Zpráva' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name', cs: 'Jméno' }),
    email: f.text({ required: true, format: 'email', max: 200 }).label({ en: 'E-mail', cs: 'E-mail' }),
    people: f.select({
      options: ['upto5', 'upto20', 'upto50', 'more'] as const, default: 'upto20',
      labels: {
        upto5: { en: 'up to 5', cs: 'do 5' }, upto20: { en: '6 to 20', cs: '6 až 20' },
        upto50: { en: '21 to 50', cs: '21 až 50' }, more: { en: 'more than 50', cs: 'víc než 50' },
      },
    }).label({ en: 'How many people you plan', cs: 'Kolik lidí plánujete' }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'Message', cs: 'Zpráva' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send message', cs: 'Odeslat zprávu' },
  successMessage: { en: 'Thank you, your message is on its way. We will reply within one working day.', cs: 'Děkujeme, zpráva odešla. Ozveme se do jednoho pracovního dne.' },
})

// ── the sign-up request: an e-mail address, in place of a real sign-up ──
export const Trial = defineForm('trial', {
  label: { en: 'Trial requests', cs: 'Zájemci o vyzkoušení' },
  labelSingular: { en: 'Trial request', cs: 'Zájemce o vyzkoušení' },
  fields: {
    email: f.text({ required: true, format: 'email', max: 200 }).label({ en: 'E-mail', cs: 'E-mail' }),
  },
  titleField: 'email',
  submitLabel: { en: 'Create an account', cs: 'Založit účet' },
  successMessage: { en: 'Thank you. We will send the link to create your account to this address.', cs: 'Děkujeme. Odkaz na založení účtu pošleme na tuto adresu.' },
})
export const FormSettings = defineFormSettings()
