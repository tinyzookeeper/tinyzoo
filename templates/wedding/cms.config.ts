import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'
import { OWN_COLOR_FIELD } from 'tinyzoo-template-kit/looks'

// The content model of the Wedding template: what the couple can write and change. One model
// for all three looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou.',
  en: 'Text between *asterisks* stands out, for example in italics.',
}

// ── the whole site: who, when, where ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'Your names, the day, the place, the look and the colours.', cs: 'Vaše jména, den a místo svatby, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Names and look', cs: 'Jména a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'ownColor'] },
      { label: { en: 'When and where', cs: 'Kdy a kde' }, fields: ['date', 'rsvpDeadline', 'venueName', 'venueArea', 'address', 'coordinates', 'mapUrl'] },
      { label: { en: 'Header and footer', cs: 'Záhlaví a zápatí' }, fields: ['ctaLabel', 'ctaUrl', 'email', 'closing', 'footerImage'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Your names', cs: 'Vaše jména' })
      .help({ en: 'Both first names with “and” between them, for example “Anna and Peter”. They open the website and stand in the footer.', cs: 'Obě křestní jména se spojkou „a“, například „Anežka a Šimon“. Otevírají web a stojí i v zápatí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Monogram', cs: 'Monogram' })
      .help({ en: 'Upload your own monogram to show it in the header in place of your initials.', cs: 'Nahrajte vlastní monogram a v záhlaví se zobrazí místo iniciál.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    // The owner's own main colour: the palette of the chosen colours follows it (templates/kit/palette.ts).
    ownColor: f.color().optional().label(OWN_COLOR_FIELD.label).help(OWN_COLOR_FIELD.help),
    date: f.datetime().optional().label({ en: 'Day and time of the ceremony', cs: 'Den a čas obřadu' }),
    rsvpDeadline: f.datetime({ allDay: true }).optional().label({ en: 'Reply by', cs: 'Odpověď do' })
      .help({ en: 'The last day for guests to confirm.', cs: 'Poslední den, kdy mají hosté potvrdit účast.' }),
    venueName: f.text().optional().label({ en: 'Name of the place', cs: 'Název místa' })
      .help({ en: 'For example “The Old Linden Farm”.', cs: 'Například „Statek U Staré lípy“.' }),
    venueArea: f.text().optional().label({ en: 'Where it is, in a few words', cs: 'Kde to je, pár slovy' })
      .help({ en: 'The village and the region, under the name of the place.', cs: 'Obec a kraj, pod názvem místa.' }),
    address: f.text().optional().label({ en: 'Address', cs: 'Adresa' }),
    coordinates: f.text().optional().label({ en: 'Coordinates', cs: 'Souřadnice' })
      .help({ en: 'For example “49.6402 N · 16.0617 E”.', cs: 'Například „49.6402 N · 16.0617 E“.' }),
    mapUrl: f.text({ format: 'url' }).optional().label({ en: 'Link to a map', cs: 'Odkaz do mapy' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail for guests', cs: 'E-mail pro hosty' }),
    closing: f.text().optional().label({ en: 'Closing words', cs: 'Slova na závěr' })
      .help({ en: 'A short line in the footer, for example “We look forward to seeing you.”', cs: 'Krátká věta do zápatí, například „Těšíme se na vás.“' }),
    footerImage: f.media({ accept: 'image/*' }).optional().label({ en: 'Photo behind the footer', cs: 'Fotografie pod zápatím' })
      .help({ en: 'Evening lays the footer over this photo. A wide, calm landscape works best.', cs: 'Vzhled Večer přes ni položí zápatí. Nejlépe se hodí široká klidná krajina.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'footerImage', 'ogImage'] },
})

// ── the programme of the day ──
export const ProgramItem = defineEntity('programItem', {
  label: { en: 'Programme', cs: 'Program dne' },
  labelSingular: { en: 'Programme item', cs: 'Bod programu' },
  description: { en: 'What happens when. Drag to put the items in order.', cs: 'Co se kdy děje. Pořadí změníte přetažením.' },
  icon: 'i-lucide-clock',
  titleField: 'title',
  admin: { list: { columns: ['time', 'title'], orderField: 'position' } },
  fields: {
    time: f.text({ required: true, max: 20 }).label({ en: 'Time', cs: 'Čas' }).help({ en: 'As you want it written, for example “12.30”.', cs: 'Tak, jak ho chcete napsat, například „12.30“.' }),
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
    // The order: editors arrange the list by dragging ("Arrange" in the admin), the website follows.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── where guests can stay ──
export const Lodging = defineEntity('lodging', {
  label: { en: 'Places to stay', cs: 'Ubytování' },
  labelSingular: { en: 'Place to stay', cs: 'Ubytování' },
  description: { en: 'Guesthouses and hotels nearby, with the distance and the price.', cs: 'Penziony a hotely poblíž, se vzdáleností a cenou.' },
  icon: 'i-lucide-bed-double',
  titleField: 'name',
  admin: { list: { columns: ['name', 'distance', 'price'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    distance: f.text().optional().label({ en: 'Distance', cs: 'Vzdálenost' }).help({ en: 'For example “1.5 km” or “On site”.', cs: 'Například „1,5 km“ nebo „Na místě“.' }),
    distanceNote: f.text().optional().label({ en: 'From where', cs: 'Odkud' }).help({ en: 'A word or two after the distance: “from the farm”.', cs: 'Slovo nebo dvě za vzdáleností: „od statku“.' }),
    description: f.text({ multiline: true }).optional().label({ en: 'Short description', cs: 'Krátký popis' }),
    price: f.text().optional().label({ en: 'Price', cs: 'Cena' }).help({ en: 'For example “790 Kč / person”. What follows the slash is written smaller.', cs: 'Například „790 Kč / osoba“. Text za lomítkem se napíše menší.' }),
    linkLabel: f.text().optional().label({ en: 'Link text', cs: 'Text odkazu' }),
    linkUrl: f.text({ format: 'link' }).optional().label({ en: 'Link destination', cs: 'Cíl odkazu' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the gift list ──
export const Gift = defineEntity('gift', {
  label: { en: 'Gifts', cs: 'Dary' },
  labelSingular: { en: 'Gift', cs: 'Dar' },
  description: { en: 'Your wishes. A guest reserves a gift on the website; you only see that it is taken, not by whom.', cs: 'Vaše přání. Host si dar zamluví na webu; uvidíte jen to, že je zamluvený, ne kým.' },
  icon: 'i-lucide-gift',
  titleField: 'name',
  admin: { list: { columns: ['name', 'price', 'reserved', 'open'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    description: f.text({ multiline: true }).optional().label({ en: 'A few words about it', cs: 'Pár slov k tomu' }),
    price: f.number({ int: true, min: 0 }).optional().label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
    reserved: f.boolean().label({ en: 'Reserved', cs: 'Zamluveno' })
      .help({ en: 'A guest turns this on with the “Reserve” button. Turn it off to offer the gift again.', cs: 'Zapne ho host tlačítkem „Rezervovat“. Vypnutím dar znovu nabídnete.' }),
    open: f.boolean().label({ en: 'A contribution anyone can add to', cs: 'Příspěvek, na který může přispět každý' })
      .help({ en: 'A honeymoon fund, for example. It cannot be reserved and stands first, larger than the rest.', cs: 'Třeba svatební cesta. Nedá se zamluvit a stojí první, větší než ostatní.' }),
    buttonLabel: f.text().optional().label({ en: 'Button text', cs: 'Text tlačítka' }).help({ en: 'For a contribution: “Contribute to the trip”.', cs: 'U příspěvku: „Přispět na cestu“.' }),
    buttonUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── practical questions ──
export const Question = defineEntity('question', {
  label: { en: 'Questions', cs: 'Otázky' },
  labelSingular: { en: 'Question', cs: 'Otázka' },
  description: { en: 'What guests ask about: what to wear, children, rain.', cs: 'Na co se hosté ptají: co na sebe, děti, déšť.' },
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

// ── who to call on the day ──
export const Contact = defineEntity('contact', {
  label: { en: 'Contacts on the day', cs: 'Kontakty v den svatby' },
  labelSingular: { en: 'Contact', cs: 'Kontakt' },
  description: { en: 'The witnesses or whoever answers the phone on the day.', cs: 'Svědci nebo kdokoli, kdo v den svatby zvedne telefon.' },
  icon: 'i-lucide-phone',
  titleField: 'name',
  admin: { list: { columns: ['name', 'role', 'phone'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    role: f.text().optional().label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “Maid of honour”.', cs: 'Například „Svědkyně nevěsty“.' }),
    note: f.text().optional().label({ en: 'Looks after', cs: 'Má na starosti' }).help({ en: 'For example “the bus, parking, the way there”.', cs: 'Například „autobus, parkování, cesta“.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).label({ en, cs })

const invitation = defineBlock({
  label: { en: 'Invitation', cs: 'Pozvánka' },
  description: { en: 'Your names, the day and the place from Site settings, a photo of the two of you and a few words to your guests.', cs: 'Vaše jména, den a místo z Nastavení webu, vaše fotografie a pár slov hostům.' },
  icon: 'i-lucide-mail-open',
  fields: {
    eyebrow: eyebrow().help({ en: 'For example “We joyfully invite you to our wedding”.', cs: 'Například „S radostí vás zveme na naši svatbu“.' }),
    greeting: f.text().label({ en: 'Greeting', cs: 'Oslovení' }).help({ en: 'For example “Dear family and friends,”.', cs: 'Například „Milí rodiče, sourozenci a přátelé,“.' }),
    lead: f.text({ multiline: true }).label({ en: 'First sentence', cs: 'První věta' })
      .help({ en: 'The sentence that follows the greeting. Evening sets it large.', cs: 'Věta, která navazuje na oslovení. Vzhled Večer ji vysází velkým písmem.' }),
    text: text(),
    image: photo('Photo of the two of you', 'Fotografie vás dvou')
      .help({ en: 'A portrait works best. Announcement shows it in an oval, Evening in a frame.', cs: 'Nejlépe na výšku. Oznámení ji ukáže v oválu, Večer v rámečku.' }),
    nightImage: photo('Photo for Evening', 'Fotografie pro vzhled Večer')
      .help({ en: 'Evening opens with this photo across the whole screen, your names over its top half. Choose a wide one with a dark, calm sky, or leave this empty to use the photo above.', cs: 'Večer jí otevře celou obrazovku a přes horní polovinu napíše jména. Vyberte širokou fotografii s tmavou klidnou oblohou, nebo pole nechte prázdné a použije se fotografie výše.' }),
    coverImage: photo('Photo for Magazine', 'Fotografie pro vzhled Magazín')
      .help({ en: 'Magazine shows this photo tall beside your names. Leave it empty to use the first photo.', cs: 'Magazín ji ukáže na výšku vedle jmen. Když pole necháte prázdné, použije se první fotografie.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Second link text', cs: 'Text druhého odkazu' }),
    secondaryUrl: link('Second link destination', 'Cíl druhého odkazu'),
  },
})

const story = defineBlock({
  label: { en: 'Our story', cs: 'Náš příběh' },
  description: { en: 'How you met and how the proposal went, in two or three parts with photos.', cs: 'Jak jste se poznali a jak proběhla žádost o ruku, ve dvou nebo třech částech s fotografiemi.' },
  icon: 'i-lucide-heart',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    parts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'When and where', cs: 'Kdy a kde' }).help({ en: 'For example “October 2019 · the Brno train”.', cs: 'Například „Říjen 2019 · rychlík z Brna“.' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'Magazine sets the words before the first comma larger.', cs: 'Magazín vysází slova před první čárkou větším písmem.' }),
      },
      max: 3, itemLabel: { en: 'Part', cs: 'Část' },
    }).label({ en: 'Parts', cs: 'Části' }),
    closing: f.text().label({ en: 'Closing sentence', cs: 'Věta na závěr' }),
    wideImage: photo('Photo across the page', 'Fotografie přes celou šířku')
      .help({ en: 'Magazine shows it across the whole page under the story.', cs: 'Magazín ji ukáže pod příběhem přes celou šířku stránky.' }),
    wideCaption: f.text().label({ en: 'Its caption', cs: 'Její popisek' }),
  },
})

const programme = defineBlock({
  label: { en: 'Programme of the day', cs: 'Program dne' },
  description: { en: 'The items of the Programme section in order, with one or two photos.', cs: 'Body ze sekce Program dne popořadě, s jednou nebo dvěma fotografiemi.' },
  icon: 'i-lucide-clock',
  fields: {
    eyebrow: eyebrow().help({ en: 'Leave it empty to show the wedding day from Site settings.', cs: 'Když pole necháte prázdné, zobrazí se den svatby z Nastavení webu.' }),
    heading: heading(),
    text: text(),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        label: f.text().label({ en: 'Time', cs: 'Čas' }).help({ en: 'The time the photo belongs to, for example “12.30”.', cs: 'Čas, ke kterému fotografie patří, například „12.30“.' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 2, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Announcement shows the first beside the list, Evening the last across the page, Magazine both.', cs: 'Oznámení ukáže první vedle programu, Večer poslední přes celou šířku, Magazín obě.' }),
  },
})

const place = defineBlock({
  label: { en: 'Place and getting there', cs: 'Místo a doprava' },
  description: { en: 'The address from Site settings with a link to a map, photos of the place and how to get there.', cs: 'Adresa z Nastavení webu s odkazem do mapy, fotografie místa a jak se tam dostat.' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Usually the name of the place.', cs: 'Obvykle název místa.' }),
    text: text(),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 3, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Announcement shows the first two side by side, Evening the first with the last laid over its corner, Magazine the first.', cs: 'Oznámení ukáže první dvě vedle sebe, Večer první a přes její roh poslední, Magazín první.' }),
    notes: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }).help({ en: 'For example “By car”.', cs: 'Například „Autem“.' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
        firstLabel: f.text().label({ en: 'Small figure: what', cs: 'Malý údaj: co' }).help({ en: 'For example “There”.', cs: 'Například „Tam“.' }),
        firstValue: f.text().label({ en: 'Small figure: value', cs: 'Malý údaj: hodnota' }).help({ en: 'For example “11.00”.', cs: 'Například „11.00“.' }),
        secondLabel: f.text().label({ en: 'Second figure: what', cs: 'Druhý údaj: co' }),
        secondValue: f.text().label({ en: 'Second figure: value', cs: 'Druhý údaj: hodnota' }),
      },
      max: 4, itemLabel: { en: 'Note', cs: 'Poznámka' },
    }).label({ en: 'Getting there', cs: 'Doprava' }),
  },
})

const lodging = defineBlock({
  label: { en: 'Where to stay', cs: 'Kde přespat' },
  description: { en: 'The places from the Places to stay section.', cs: 'Místa ze sekce Ubytování.' },
  icon: 'i-lucide-bed-double',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
  },
})

const rsvp = defineBlock({
  label: { en: 'Reply form', cs: 'Potvrzení účasti' },
  description: { en: 'Guests say whether they come, how many of them and what they eat. The replies arrive in the admin.', cs: 'Hosté napíšou, zda přijedou, kolik jich bude a co si dají. Odpovědi najdete v administraci.' },
  icon: 'i-lucide-mail-check',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    meals: f.list({
      fields: { name: f.text({ required: true }).label({ en: 'Dish', cs: 'Jídlo' }) },
      max: 8, itemLabel: { en: 'Dish', cs: 'Jídlo' },
    }).label({ en: 'Main courses to choose from', cs: 'Hlavní chody na výběr' })
      .help({ en: 'Leave the list empty and the form does not ask about the meal.', cs: 'Když seznam necháte prázdný, formulář se na jídlo neptá.' }),
    busLabel: f.text().label({ en: 'Question about a ride', cs: 'Otázka na dopravu' })
      .help({ en: 'A sentence guests tick, for example “We want a seat on the wedding bus”. Leave it empty and the form does not ask.', cs: 'Věta, kterou hosté zaškrtnou, například „Chceme místo ve svatebním autobuse“. Když pole necháte prázdné, formulář se neptá.' }),
    image: photo().help({ en: 'Evening shows it beside the form.', cs: 'Vzhled Večer ji ukáže vedle formuláře.' }),
  },
})

const gifts = defineBlock({
  label: { en: 'Gift list', cs: 'Svatební dary' },
  description: { en: 'The wishes from the Gifts section. A guest can reserve one.', cs: 'Přání ze sekce Dary. Host si může dar zamluvit.' },
  icon: 'i-lucide-gift',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    image: photo(),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
    openLabel: f.text().label({ en: 'Line above the contribution', cs: 'Řádek nad příspěvkem' }).help({ en: 'For example “Our first wish”.', cs: 'Například „Přání první“.' }),
  },
})

const questions = defineBlock({
  label: { en: 'Questions and answers', cs: 'Otázky a odpovědi' },
  description: { en: 'The questions from the Questions section.', cs: 'Otázky ze sekce Otázky.' },
  icon: 'i-lucide-circle-help',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
  },
})

const contacts = defineBlock({
  label: { en: 'Contacts on the day', cs: 'Kontakty v den svatby' },
  description: { en: 'Who to call on the day, from the Contacts section.', cs: 'Komu v den svatby volat, ze sekce Kontakty.' },
  icon: 'i-lucide-phone',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
  },
})

const gallery = defineBlock({
  label: { en: 'Photographs', cs: 'Fotografie' },
  description: { en: 'A few photos of the two of you.', cs: 'Pár fotografií vás dvou.' },
  icon: 'i-lucide-images',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    photos: f.list({
      fields: { image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }) },
      max: 24, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Drag to change the order. A photo shown elsewhere on the page is left out, so none shows twice. Announcement shows five, Evening four, Magazine all of them.', cs: 'Pořadí změníte přetažením. Fotografie, která je na stránce jinde, se vynechá, takže se žádná neopakuje. Oznámení jich ukáže pět, Večer čtyři, Magazín všechny.' }),
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
  blocks: { invitation, story, programme, place, lodging, rsvp, gifts, questions, contacts, gallery, text: richText, ...customTypeBlocks() },
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
  formsPlugin(), // the replies of the form below
]

// ── the reply form ──
// The website draws it per look (the kit's useSiteForm). Two of its questions are worded by
// the couple in the "Reply form" block: the main course (a list of dishes) and the ride.
export const Rsvp = defineForm('rsvp', {
  label: { en: 'Replies', cs: 'Odpovědi hostů' },
  labelSingular: { en: 'Reply', cs: 'Odpověď' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }).help({ en: 'For example Jane and Peter Novak', cs: 'Například Jana a Petr Novákovi' }),
    attending: f.select({
      options: ['yes', 'no'] as const, default: 'yes',
      labels: { yes: { en: 'We will gladly come', cs: 'S radostí přijedeme' }, no: { en: 'Sadly, we cannot', cs: 'Bohužel nemůžeme' } },
    }).label({ en: 'Attendance', cs: 'Účast' }),
    adults: f.select({ options: ['1', '2', '3', '4', '5', '6'] as const, default: '2' }).label({ en: 'Number of adults', cs: 'Počet dospělých' }),
    children: f.text({ max: 200 }).optional().label({ en: 'Children and their age', cs: 'Děti a jejich věk' }).help({ en: 'For example 2 (4 and 7 years)', cs: 'Například 2 (4 a 7 let)' }),
    meal: f.text({ max: 200 }).optional().label({ en: 'Main course', cs: 'Hlavní chod' }),
    allergies: f.text({ max: 300 }).optional().label({ en: 'Allergies and diets', cs: 'Alergie a diety' }).help({ en: 'Gluten-free, no nuts…', cs: 'Bez lepku, bez ořechů…' }),
    song: f.text({ max: 300 }).optional().label({ en: 'A song that gets you dancing', cs: 'Písnička, při které půjdete na parket' }).help({ en: 'Artist and title', cs: 'Interpret a název' }),
    message: f.text({ multiline: true, max: 5000 }).optional().label({ en: 'A note for us', cs: 'Vzkaz pro nás' })
      .help({ en: 'We arrive just for the ceremony, we need a high chair…', cs: 'Přijedeme až na obřad, potřebujeme dětskou židličku…' }),
    ride: f.boolean().label({ en: 'Wants a ride', cs: 'Chce dopravu' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send reply', cs: 'Odeslat odpověď' },
  successMessage: { en: 'Thank you, we have your reply. If anything changes, write to us.', cs: 'Děkujeme, odpověď máme. Kdyby se cokoli změnilo, napište nám.' },
})
export const FormSettings = defineFormSettings()
