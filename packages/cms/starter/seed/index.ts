import { defineSeed, type SeedEntry } from 'tinyzoo'
import { FormSettings, Navigation, News, Page, Redirect, SiteSettings } from '../cms.config'

// Demo content for the starter, in Czech and English: a small neighbourhood bakery.
// Put it into a running site with
//
//   SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// (on a new site this creates the first administrator with those details). It is safe
// to run again: entries are recognised by their address, a file by its name, and
// whatever is already as written here is left alone. `pnpm seed --dry-run` shows what
// it would do, `pnpm seed --reset` removes this content first and writes it fresh.
//
// Replace the texts and pictures with your own, or delete this folder when the site has
// its real content. Pictures are drawn shapes (seed/media), free to use.

export default defineSeed(async (s) => {
  const { doc, p, h2, ul, quote, bold, link, image } = s.rich

  // ── pictures ──
  const hero = await s.upload('seed/media/hero.jpg', {
    alt: 'Slunce nad zvlněnou krajinou v teplých barvách', altLocales: { en: 'The sun over rolling hills in warm colours' }, focal: { x: 70, y: 40 },
  })
  const about = await s.upload('seed/media/about.jpg', {
    alt: 'Tři klenutá okna a bochánky na pultu', altLocales: { en: 'Three arched windows and little loaves on a counter' },
  })
  const bread = await s.upload('seed/media/news-bread.jpg', {
    alt: 'Bochník s naříznutou kůrkou', altLocales: { en: 'A loaf with a scored crust' },
  })
  const morning = await s.upload('seed/media/news-morning.jpg', {
    alt: 'Východ slunce nad vodou', altLocales: { en: 'Sunrise over water' },
  })
  const logo = await s.upload('seed/media/logo.png', { alt: 'Logo pekárny', altLocales: { en: 'Bakery logo' } })

  // ── pages ──
  // A button that leads to a page of this seed is a reference to it (what the admin's link picker
  // stores), so it follows the page when it is renamed or moved, in each language. The seed writes
  // the same reference every run: a typed address ('/kontakt') would be written back over a link
  // converted by `tinyzoo links:convert`. Pages the website draws itself (/aktuality) stay typed.
  const refTo = (entry: SeedEntry) => s.link('', entry).url
  // (`position` is the order in the page tree: the pages are written contact first, so say it.)
  const contact = await s.upsert(Page, {
    title: 'Kontakt', slug: 'kontakt', status: 'published', position: 2,
    metaDescription: 'Adresa, otevírací doba a kontaktní formulář pekárny Na Růžku.',
    sections: [
      {
        type: 'text',
        body: doc(
          h2('Zastavte se, nebo napište'),
          p('Najdete nás na rohu u kostela v Dolní Lhotě. Na víkend je dobré objednat den předem, ať vám vyjde i vánočka.'),
        ),
      },
      { type: 'contact', heading: 'Napište nám' },
    ],
  }, {
    translations: {
      en: {
        title: 'Contact', slug: 'contact',
        metaDescription: 'Address, opening hours and the contact form of Corner Bakery.',
        sections: [
          {
            type: 'text',
            body: doc(
              h2('Drop in, or write to us'),
              p('You will find us on the corner by the church in Dolní Lhota. For the weekend it is best to order a day ahead, so there is a plaited loaf left for you.'),
            ),
          },
          { type: 'contact', heading: 'Write to us' },
        ],
      },
    },
  })

  const aboutPage = await s.upsert(Page, {
    title: 'O nás', slug: 'o-nas', status: 'published', position: 1,
    metaDescription: 'Rodinná pekárna z Dolní Lhoty. Kdo pečeme, z čeho a proč to děláme v malém.',
    sections: [
      {
        type: 'text',
        body: doc(
          h2('Rodinná pekárna z Dolní Lhoty'),
          p('Pekárnu Na Růžku jsme otevřeli v roce 2014 v bývalé trafice. Dnes v ní pečou čtyři lidé a pec zná každý z nich zpaměti.'),
          quote('Dobrý chléb se nedá uspěchat. Stačí mu dát čas a dobrou mouku.', 'Marie Kovářová, zakladatelka'),
          p('Mouku bereme z mlýna o dvě vsi dál, mléko od místního statkáře. Co zbyde, odvážíme večer do chráněného bydlení v sousední obci.'),
        ),
      },
      { type: 'image', image: bread, caption: 'Bochník těsně před pecí.' },
      { type: 'cta', heading: 'Přijďte ochutnat', buttonLabel: 'Kde nás najdete', buttonUrl: refTo(contact) },
    ],
  }, {
    translations: {
      en: {
        title: 'About us', slug: 'about',
        metaDescription: 'A family bakery from Dolní Lhota: who bakes, with what, and why we keep it small.',
        sections: [
          {
            type: 'text',
            body: doc(
              h2('A family bakery from Dolní Lhota'),
              p('We opened Corner Bakery in 2014, in a former tobacconist\'s. Four people bake in it today, and every one of them knows the oven by heart.'),
              quote('Good bread cannot be rushed. It just needs time and good flour.', 'Marie Kovářová, founder'),
              p('Our flour comes from a mill two villages away and our milk from a local farmer. What is left over goes in the evening to a sheltered home in the next village.'),
            ),
          },
          { type: 'image', image: bread, caption: 'A loaf just before the oven.' },
          { type: 'cta', heading: 'Come and taste', buttonLabel: 'Where to find us', buttonUrl: refTo(contact) },
        ],
      },
    },
  })

  await s.upsert(Page, {
    title: 'Úvod', slug: 'home', status: 'published', position: 0,
    metaTitle: 'Pekárna Na Růžku · čerstvé pečivo z Dolní Lhoty',
    metaDescription: 'Pečeme chleba na kvásku, rohlíky a sladké koláče každý den od půl šesté. Zastavte se na rohu u kostela.',
    ogImage: hero,
    sections: [
      {
        type: 'hero', heading: 'Chléb, který voní po ránu.',
        text: 'Pečeme z české mouky a na vlastním kvásku. Každé ráno od půl šesté čerstvé pečivo na rohu u kostela.',
        image: hero, buttonLabel: 'Co je nového', buttonUrl: '/aktuality',
      },
      {
        type: 'text',
        body: doc(
          h2('Pečeme po staru, v malém'),
          p('Těsto necháváme přes noc kynout a pečeme v kamenné peci. Proto máme každý den jen tolik, kolik za ráno vyprodáme.'),
          ul('chléb na kvásku, pšeničný i žitný', 'rohlíky, housky a vánočky', 'koláče a štrúdly podle sezóny'),
          p('Něco chybí? ', bold('Napište nám'), ' a upečeme to na zakázku.'),
        ),
      },
      { type: 'image', image: about, caption: 'Okna naší pekárny, každé ráno od půl šesté.' },
      { type: 'cta', heading: 'Objednejte si na víkend', buttonLabel: 'Napsat nám', buttonUrl: refTo(contact) },
    ],
  }, {
    translations: {
      en: {
        title: 'Home', slug: 'home',
        metaTitle: 'Corner Bakery · fresh bread from Dolní Lhota',
        metaDescription: 'Sourdough bread, rolls and sweet pastries baked every day from half past five. Find us on the corner by the church.',
        sections: [
          {
            type: 'hero', heading: 'Bread that smells like morning.',
            text: 'We bake with Czech flour and our own sourdough. Fresh bread every morning from half past five, on the corner by the church.',
            image: hero, buttonLabel: 'What is new', buttonUrl: '/en/news',
          },
          {
            type: 'text',
            body: doc(
              h2('Baked the old way, in small batches'),
              p('The dough rises overnight and goes into a stone oven. That is why we only have as much each day as we sell by lunchtime.'),
              ul('sourdough bread, wheat and rye', 'rolls, buns and plaited loaves', 'pastries and strudels by the season'),
              p('Missing something? ', bold('Write to us'), ' and we will bake it to order.'),
            ),
          },
          { type: 'image', image: about, caption: 'The windows of our bakery, open from half past five.' },
          { type: 'cta', heading: 'Order for the weekend', buttonLabel: 'Write to us', buttonUrl: refTo(contact) },
        ],
      },
    },
  })

  // ── news ──
  // (fixed dates, so a second run changes nothing)
  await s.upsert(News, {
    title: 'Nový žitný chléb s ořechy', slug: 'novy-zitny-chleb', status: 'published', publishedAt: '2026-10-12T06:30:00Z',
    cover: bread,
    perex: 'Od tohoto týdne pečeme žitný chléb s vlašskými ořechy a sušenými švestkami. Hotový je v sedm.',
    body: doc(
      p('Dlouho jsme ho zkoušeli a teď je hotový: tmavý žitný chléb na kvásku s vlašskými ořechy a sušenými švestkami z blízkého sadu.'),
      h2('Kdy ho máte čekat'),
      p('Pečeme ho v úterý, ve čtvrtek a v sobotu, vždy kolem sedmé ranní. Pokud ho chcete jistě, rezervujte si ho předem.'),
      p('Dejte nám vědět, jak chutná.'),
    ),
    metaDescription: 'Žitný chléb s vlašskými ořechy a sušenými švestkami, nově od října.',
  }, {
    translations: {
      en: {
        title: 'A new rye bread with walnuts', slug: 'new-rye-bread',
        perex: 'From this week we bake a rye bread with walnuts and dried plums. It comes out of the oven at seven.',
        body: doc(
          p('We tried it for a long time and now it is ready: a dark rye sourdough bread with walnuts and dried plums from a nearby orchard.'),
          h2('When to expect it'),
          p('We bake it on Tuesdays, Thursdays and Saturdays, always around seven in the morning. If you want to be sure of one, reserve it ahead.'),
          p('Let us know how it tastes.'),
        ),
        metaDescription: 'A rye bread with walnuts and dried plums, new from October.',
      },
    },
  })

  await s.upsert(News, {
    title: 'Slunce nad pecí: otevíráme už v pět', slug: 'otevirame-v-pet', status: 'published', publishedAt: '2026-11-02T05:00:00Z',
    cover: morning,
    perex: 'Přes zimu otevíráme o půl hodiny dřív, aby si pečivo stihli odnést i ti, kdo jedou na první autobus.',
    body: doc(
      p('Od listopadu je pult otevřený už od půl šesté, ještě před prvním autobusem do města.'),
      p('Čerstvé rohlíky a housky jsou hotové vždy před šestou, chléb se dopéká do sedmi.'),
      p(link('Otevírací dobu najdete na stránce Kontakt', '/kontakt')),
    ),
  }, {
    translations: {
      en: {
        title: 'Sun over the oven: we now open at five thirty', slug: 'now-open-at-half-five',
        perex: 'Over the winter we open half an hour earlier, so that people catching the first bus can pick up bread too.',
        body: doc(
          p('From November the counter opens at half past five, before the first bus into town.'),
          p('Fresh rolls and buns are ready before six; the bread keeps baking until seven.'),
          p(link('Opening hours are on the Contact page', '/en/contact')),
        ),
      },
    },
  })

  await s.upsert(News, {
    title: 'Jak vzniká kvásek', slug: 'jak-vznika-kvasek', status: 'published', publishedAt: '2026-11-09T07:00:00Z',
    cover: about,
    perex: 'Náš kvásek je starý dvanáct let a krmíme ho každý den. Zeptali jste se, jak to děláme.',
    body: doc(
      p('Kvásek je jen mouka a voda, které necháte dost času. Ten náš každý večer dostane novou dávku žitné mouky a čistou vodu.'),
      image(about, 'Tři klenutá okna a bochánky na pultu'),
      p('Pokud si chcete doma zkusit upéct vlastní chléb, rádi vám kousek kvásku dáme.'),
    ),
  }, {
    translations: {
      en: {
        title: 'How sourdough is made', slug: 'how-sourdough-is-made',
        perex: 'Our starter is twelve years old and we feed it every day. You asked how we do it.',
        body: doc(
          p('Sourdough is just flour and water given enough time. Ours gets a fresh portion of rye flour and clean water every evening.'),
          image(about, 'Three arched windows and little loaves on a counter'),
          p('If you would like to try baking your own bread at home, we will gladly give you a bit of our starter.'),
        ),
      },
    },
  })

  // One draft: the admin shows every state of an entry.
  await s.upsert(News, {
    title: 'Připravujeme vánoční štoly', slug: 'vanocni-stoly', status: 'draft',
    perex: 'Od prvního adventu upečeme štoly s mandlemi a rozinkami. Objednávky přijímáme od prosince.',
    body: doc(p('Tento text je zatím rozepsaný. Zveřejníte ho v administraci tlačítkem Zveřejnit.')),
  }, {
    translations: {
      en: { title: 'Christmas stollen are coming', slug: 'christmas-stollen', perex: 'From the first Sunday of Advent we bake stollen with almonds and raisins. Orders open in December.', body: doc(p('This text is still a draft. Publish it in the admin with the Publish button.')) },
    },
  })

  // ── menus, settings, forms ──
  await s.global(Navigation, {
    main: [s.link('Úvod', '/'), s.link('Aktuality', '/aktuality'), s.link('O nás', aboutPage), s.link('Kontakt', contact)],
    footer: [s.link('Kontakt', contact), s.link('Hledat', '/hledat')],
  }, {
    translations: {
      en: {
        main: [s.link('Home', '/en'), s.link('News', '/en/news'), s.link('About us', aboutPage, { locale: 'en' }), s.link('Contact', contact, { locale: 'en' })],
        footer: [s.link('Contact', contact, { locale: 'en' }), s.link('Search', '/en/search')],
      },
    },
  })

  await s.global(SiteSettings, {
    siteName: 'Pekárna Na Růžku',
    tagline: 'Čerstvé pečivo každý den od půl šesté.',
    logo,
    email: 'info@narozku.example',
    phone: '+420 600 000 000',
    address: 'Pekárna Na Růžku\nU kostela 12\n123 45 Dolní Lhota',
    openingHours: [
      { days: 'Po–Pá', hours: '5:30–17:00' },
      { days: 'So', hours: '6:00–12:00' },
      { days: 'Ne', hours: '7:00–10:00' },
    ],
    metaTitle: 'Pekárna Na Růžku',
    metaDescription: 'Rodinná pekárna z Dolní Lhoty: chléb na kvásku, rohlíky a koláče každý den od půl šesté.',
    ogImage: hero,
  }, {
    translations: {
      en: {
        tagline: 'Fresh bread every day from half past five.',
        openingHours: [
          { days: 'Mon–Fri', hours: '5:30–17:00' },
          { days: 'Sat', hours: '6:00–12:00' },
          { days: 'Sun', hours: '7:00–10:00' },
        ],
        metaTitle: 'Corner Bakery',
        metaDescription: 'A family bakery from Dolní Lhota: sourdough bread, rolls and pastries every day from half past five.',
      },
    },
  })

  // Who is told about messages from the contact form (replace with your own address).
  await s.global(FormSettings, { notifyTo: [{ email: 'info@narozku.example' }] })

  // An old address that now leads to the new one.
  await s.upsert(Redirect, { from: '/pekarna', to: '/o-nas', permanent: true }, { by: 'from' })
})
