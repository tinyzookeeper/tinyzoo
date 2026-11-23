import { defineSeed } from 'tinyzoo'
import { gallery, refTo, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Album, Category, Navigation, Pack, Page, SiteSettings, Testimonial } from '../cms.config'
import { looks } from '../looks'
import { PHOTOS } from './photos'

// The demo content of the Photographer template: the fictional photographer Johana Loudová
// from Litomyšl. One set of content for all three looks.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their address (or name), a file by its
// name, and what is already as written here is left alone. The site's settings are only
// written when there are none yet, so a second run never undoes the owner's look or name.

export default defineSeed(async (s) => {
  const { doc, p, h2, ul } = s.rich

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── categories, in the order of the tabs ──
  const category = async (position: number, name: string, slug: string, description: string) =>
    (await s.upsert(Category, { name, slug, description, position })).id
  const weddings = await category(0, 'Svatby', 'svatby', 'Celý den nebo jen obřad. Držím se zpátky a hlídám chvíle, které se nedají zopakovat.')
  const portraits = await category(1, 'Portréty', 'portrety', 'V ateliéru s oknem na sever, u vás doma nebo venku.')
  const families = await category(2, 'Rodina', 'rodina', 'Novorozenci, děti a celé rodiny. Nejraději na procházce nebo doma v obýváku.')
  const business = await category(3, 'Firemní', 'firemni', 'Portréty a reportáže z dílen, ateliérů a provozoven.')

  // ── albums: newest first on the website ──
  const album = (data: { title: string; slug: string; category: string; date: string; place: string; summary?: string; cover: string; photos: ReturnType<typeof gallery> }) =>
    s.upsert(Album, { status: 'published', summary: null, ...data })

  const annaVojta = await album({
    title: 'Anna a Vojta', slug: 'anna-a-vojta', category: weddings, date: '2026-08-21T22:00:00Z', place: 'Budislav',
    summary: 'Svatba pro šedesát lidí na statku, kde Anna jako malá trávila prázdniny. Obřad pod lípou, tabule mezi jabloněmi a večer stodola.',
    cover: photo.weddingCouple,
    photos: gallery(
      [photo.weddingCeremony, 'Obřad pod lípou'],
      [photo.weddingTable, 'Tabule v sadu'],
      [photo.weddingCouple, 'Mezi jabloněmi'],
      [photo.weddingGettingReady, 'Před obřadem'],
      [photo.weddingDance, 'První tanec'],
      [photo.weddingMeadow, 'Louka za statkem'],
    ),
  })
  await album({ title: 'Markéta', slug: 'marketa', category: portraits, date: '2026-07-13T22:00:00Z', place: 'ateliér', cover: photo.portraitWoman, photos: gallery(photo.portraitWoman) })
  await album({ title: 'Matyáš, dvanáct dní', slug: 'matyas-dvanact-dni', category: families, date: '2026-06-27T22:00:00Z', place: 'Vysoké Mýto', cover: photo.familyNewborn, photos: gallery(photo.familyNewborn) })
  await album({ title: 'Keramická dílna Hany Peškové', slug: 'keramicka-dilna-hany-peskove', category: business, date: '2026-06-09T22:00:00Z', place: 'Polička', cover: photo.businessCraft, photos: gallery(photo.businessCraft) })
  await album({ title: 'Kubátovi v lese', slug: 'kubatovi-v-lese', category: families, date: '2025-10-18T22:00:00Z', place: 'Toulovcovy maštale', cover: photo.familyWalk, photos: gallery(photo.familyWalk) })
  await album({ title: 'Eliška', slug: 'eliska', category: portraits, date: '2025-10-04T22:00:00Z', place: 'pole u Sebranic', cover: photo.portraitGirl, photos: gallery(photo.portraitGirl) })
  await album({ title: 'Markéta a Ondřej', slug: 'marketa-a-ondrej', category: weddings, date: '2025-09-12T22:00:00Z', place: 'Litomyšl', cover: photo.weddingRings, photos: gallery([photo.weddingRings, 'Prsteny']) })
  await album({ title: 'Architektka Petra Dvořáková', slug: 'architektka-petra-dvorakova', category: business, date: '2025-05-21T22:00:00Z', place: 'Pardubice', cover: photo.businessPortrait, photos: gallery(photo.businessPortrait) })
  await album({ title: 'Pan Josef, truhlář', slug: 'pan-josef-truhlar', category: portraits, date: '2025-04-07T22:00:00Z', place: 'Dolní Újezd', cover: photo.portraitMan, photos: gallery(photo.portraitMan) })
  await album({ title: 'Jana a Toník', slug: 'jana-a-tonik', category: families, date: '2025-03-15T23:00:00Z', place: 'doma v Litomyšli', cover: photo.familyHome, photos: gallery(photo.familyHome) })

  // ── packages ──
  const pack = (position: number, data: { name: string; price: number; description: string; includes: string[]; highlighted?: boolean; highlightLabel?: string }) =>
    s.upsert(Pack, {
      position, name: data.name, price: data.price, description: data.description,
      includes: data.includes.map((text) => ({ text })),
      highlighted: data.highlighted ?? false, highlightLabel: data.highlightLabel ?? null,
    }, { by: 'name' })
  await pack(0, {
    name: 'Portrét a rodina', price: 3900, description: 'Hodina venku, u vás doma nebo v ateliéru.',
    includes: ['1 až 1,5 hodiny focení', '30 upravených fotografií', 'Online galerie ke stažení', '5 zvětšenin 13 × 18 cm', 'Hotovo do 14 dnů'],
  })
  await pack(1, {
    name: 'Svatba · půlden', price: 19900, description: 'Obřad, gratulace, skupinové fotky a portréty.',
    includes: ['6 hodin focení', 'Schůzka nebo videohovor předem', '250 až 350 upravených fotografií', 'Online galerie pro vás i hosty', 'Hotovo do 6 týdnů'],
  })
  await pack(2, {
    name: 'Svatba · celý den', price: 32900, description: 'Od příprav po první tanec.', highlighted: true, highlightLabel: 'Nejčastější volba',
    includes: ['12 hodin focení', 'Schůzka a obhlídka místa předem', '500 až 700 upravených fotografií', 'Online galerie pro vás i hosty', 'Krabička s 30 zvětšeninami', 'Hotovo do 6 týdnů'],
  })

  // ── testimonials: the first is shown largest ──
  const testimonial = (position: number, name: string, occasion: string, text: string) =>
    s.upsert(Testimonial, { position, name, occasion, text }, { by: 'name' })
  await testimonial(0, 'Anna a Vojta', 'svatba v Budislavi', 'Johanu jsme na svatbě skoro nevnímali, a přesto má fotku každého, na kom nám záleží. Babička si tu svou nechala zarámovat.')
  await testimonial(1, 'Markéta', 'portrét v ateliéru', 'Nerada se fotím. Po deseti minutách jsem na foťák zapomněla a na těch fotkách jsem to konečně já.')
  await testimonial(2, 'Kubátovi', 'rodinné focení', 'Se dvěma malými dětmi jsme čekali chaos. Byla z toho procházka lesem a fotky, které teď visí přes celou zeď v obýváku.')

  // ── pages ──
  // A link to a page of this seed is a reference to it (what the admin's link picker stores), so
  // it follows the page when it is renamed.
  const enquiryBlock = (privacyUrl: string) => ({
    type: 'enquiry' as const,
    eyebrow: 'Poptávka',
    heading: 'Napište mi *o termín.*',
    text: 'Stačí pár vět. Ozvu se do dvou pracovních dnů, a jestli je termín volný, domluvíme si krátký hovor.',
    consent: 'Odesláním souhlasíte se *zpracováním osobních údajů*.',
    consentUrl: privacyUrl,
  })
  const stepsBlock = {
    type: 'steps' as const,
    eyebrow: 'Od první zprávy po galerii',
    heading: 'Jak to probíhá',
    items: [
      { title: 'Napíšete mi', text: 'Termín, místo a pár vět o tom, co chystáte. Odpovídám do dvou pracovních dnů.' },
      { title: 'Poznáme se', text: 'U kávy v Litomyšli nebo přes videohovor. Projdeme den, místa a co je pro vás důležité.' },
      { title: 'Potvrdíme termín', text: 'Smlouvou a zálohou 30 %. Od té chvíle je datum vaše a nikomu jinému ho nedám.' },
      { title: 'Fotíme a dostanete galerii', text: 'Do týdne pošlu první ukázky. Celou galerii do 14 dnů, u svateb do 6 týdnů.' },
    ],
  }
  const testimonialsBlock = { type: 'testimonials' as const, eyebrow: '', heading: 'Napsali o focení', count: 3 }

  const privacy = await s.upsert(Page, {
    title: 'Ochrana osobních údajů', slug: 'ochrana-osobnich-udaju', status: 'published',
    sections: [{
      type: 'text', heading: 'Ochrana osobních údajů',
      body: doc(
        p('Tento text je ukázka. Nahraďte ho zněním, které odpovídá tomu, jak s údaji svých klientů opravdu nakládáte.'),
        h2('Jaké údaje zpracovávám'),
        p('Jméno, e-mail a to, co mi napíšete do poptávkového formuláře. U zakázek také fakturační údaje a fotografie, které pro vás pořídím.'),
        h2('K čemu je používám'),
        ul('abych vám odpověděla na poptávku', 'abych s vámi uzavřela smlouvu a vystavila fakturu', 'abych vám předala hotové fotografie'),
        h2('Jak dlouho je uchovávám'),
        p('Poptávky, ze kterých nevznikne zakázka, mažu do půl roku. Fotografie archivuji tři roky od předání, pokud se nedomluvíme jinak.'),
      ),
    }],
  })
  const terms = await s.upsert(Page, {
    title: 'Obchodní podmínky', slug: 'obchodni-podminky', status: 'published',
    sections: [{
      type: 'text', heading: 'Obchodní podmínky',
      body: doc(
        p('Tento text je ukázka. Nahraďte ho svými obchodními podmínkami.'),
        h2('Rezervace termínu'),
        p('Termín je závazně rezervovaný po podpisu smlouvy a zaplacení zálohy 30 %. Zbytek ceny je splatný do sedmi dnů po focení.'),
        h2('Zrušení a přesun'),
        p('Termín lze jednou bezplatně přesunout, nejpozději 30 dnů předem. Při zrušení ze strany klienta záloha propadá.'),
        h2('Předání fotografií'),
        p('Fotografie předávám v online galerii ve lhůtě uvedené u balíčku. Neupravené snímky nepředávám.'),
      ),
    }],
  })
  const contact = await s.upsert(Page, {
    title: 'Kontakt', slug: 'kontakt', status: 'published',
    metaDescription: 'Napište mi o termín focení. Odpovídám do dvou pracovních dnů.',
    sections: [enquiryBlock(refTo(s, privacy))],
  })

  const pricingBlock = {
    type: 'pricing' as const,
    eyebrow: 'Balíčky',
    heading: 'Ceník',
    text: 'Ceny jsou konečné, nejsem plátce DPH. Cesta do 50 km od Litomyšle je v ceně, dál počítám 8 Kč za kilometr.',
    buttonLabel: 'Zeptat se na termín', buttonUrl: refTo(s, contact),
    footnote: 'Firemní portréty a reportáže z dílen a provozoven nacením podle rozsahu, obvykle od 6 500 Kč za půlden.',
    footnoteLinkLabel: 'Napište mi, co potřebujete.', footnoteLinkUrl: refTo(s, contact),
  }
  const aboutBlock = {
    type: 'about' as const,
    eyebrow: 'O mně',
    heading: 'Držím se zpátky a *dívám se.*',
    image: photo.about,
    imageCaption: 'Johana Loudová, Litomyšl',
    text: [
      'Jsem Johana. Vyrostla jsem v Litomyšli a po studiu fotografie v Opavě jsem se sem vrátila. Mám tu malý ateliér s oknem na sever a kolem sebe krajinu, kterou znám nazpaměť.',
      'Nikoho nearanžuji do póz. Na svatbě hlídám chvíle, které se nedají zopakovat. U portrétů si nejdřív povídáme a foťák vytáhnu, až když na něj zapomenete.',
    ].join('\n\n'),
    facts: [
      { label: 'Svatby', value: 'Nejvýš dvacet ročně, abych měla na každou čas.' },
      { label: 'Světlo', value: 'Denní. Nejraději hodinu před západem slunce.' },
      { label: 'Bert', value: 'Můj pes. Na rodinná focení chodí se mnou a děti ho milují.' },
    ],
    signature: 'Johana',
  }

  const galleryPage = await s.upsert(Page, {
    title: 'Galerie', slug: 'galerie', status: 'published',
    metaDescription: 'Svatby, portréty, rodiny a firemní focení: všechna alba na jednom místě.',
    sections: [{ type: 'albums', eyebrow: 'Všechna alba', heading: 'Galerie', text: 'Svatby, portréty, rodiny a firemní focení. Vyberte si kategorii, nebo je projděte všechny.' }],
  })
  const pricingPage = await s.upsert(Page, {
    title: 'Ceník', slug: 'cenik', status: 'published',
    metaDescription: 'Svatby od 19 900 Kč, portrét a rodina od 3 900 Kč. Co je v ceně a jak focení probíhá.',
    sections: [pricingBlock, stepsBlock, enquiryBlock(refTo(s, privacy))],
  })
  const aboutPage = await s.upsert(Page, {
    title: 'O mně', slug: 'o-mne', status: 'published',
    metaDescription: 'Fotím lidi na přirozené světlo a bez strojených póz, od roku 2014.',
    sections: [aboutBlock, testimonialsBlock, enquiryBlock(refTo(s, privacy))],
  })

  await s.upsert(Page, {
    title: 'Úvod', slug: 'home', status: 'published', ogImage: photo.weddingMeadow,
    metaDescription: 'Svatby, portréty a rodinné fotografie z Litomyšle a východních Čech. Svatby od 19 900 Kč, portrét a rodina od 3 900 Kč.',
    sections: [
      {
        type: 'hero',
        eyebrow: 'Fotografka · Litomyšl · od roku 2014',
        heading: 'Fotím, co se *opravdu stalo.*',
        text: 'Svatby, portréty, rodiny a firmy ve východních Čechách. Bez póz a na světlo, které zrovna je. Svatby od 19 900 Kč, portrét a rodina od 3 900 Kč.',
        images: [
          { image: photo.weddingMeadow, caption: 'Anna a Vojta · Budislav, srpen 2026' },
          { image: photo.familyHome, caption: 'Jana a Toník' },
          { image: photo.portraitGirl, caption: 'Eliška' },
        ],
        primaryLabel: 'Prohlédnout galerii', primaryUrl: refTo(s, galleryPage),
        secondaryLabel: 'Zeptat se na termín', secondaryUrl: refTo(s, contact),
      },
      {
        type: 'gallery',
        eyebrow: 'Vybrané fotografie', heading: 'Galerie', text: '',
        count: 14,
        allLabel: 'Všechna alba', allUrl: refTo(s, galleryPage),
      },
      {
        type: 'story',
        eyebrow: 'Jeden den · svatba',
        heading: 'Anna a Vojta',
        facts: [
          { label: 'Kdy', value: '22. srpna 2026' },
          { label: 'Kde', value: 'statek v Budislavi' },
          { label: 'V albu', value: '86 fotografií' },
        ],
        text: 'Svatba pro šedesát lidí na statku, kde Anna jako malá trávila prázdniny. Obřad pod lípou, tabule mezi jabloněmi a večer stodola. Byla jsem s nimi od jedné odpoledne do půlnoci.',
        photos: [
          { image: photo.weddingGettingReady, time: '13.10', caption: 'Pokoj po babičce a okno na sever' },
          { image: photo.weddingCeremony, time: '15.00', caption: 'Obřad pod lípou' },
          { image: photo.weddingTable, time: '16.20', caption: 'Tabule v sadu' },
          { image: photo.weddingCouple, time: '18.40', caption: 'Deset minut jen pro sebe' },
          { image: photo.weddingDance, time: '21.30', caption: 'První tanec ve stodole' },
        ],
        closing: 'V albu je všech 86 fotografií, od příprav po půlnoční loučení.',
        buttonLabel: 'Celé album', buttonUrl: refTo(s, annaVojta),
      },
      pricingBlock,
      aboutBlock,
      testimonialsBlock,
      stepsBlock,
      enquiryBlock(refTo(s, privacy)),
    ],
  })

  // ── menus ──
  await s.global(Navigation, {
    main: [s.link('Galerie', galleryPage), s.link('Jeden den', annaVojta), s.link('Ceník', pricingPage), s.link('O mně', aboutPage)],
    footer: [s.link('Galerie', galleryPage), s.link('Ceník', pricingPage), s.link('O mně', aboutPage), s.link('Kontakt', contact)],
    legal: [s.link('Ochrana osobních údajů', privacy), s.link('Obchodní podmínky', terms)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    siteName: 'Johana Loudová',
    look: looks.ids[0],
    colors: looks.all[0].presets[0].id,
    tagline: 'Svatby, portréty, rodiny a firemní focení. Litomyšl a východní Čechy.',
    ctaLabel: 'Poptat termín',
    ctaUrl: refTo(s, contact),
    availability: 'Na rok 2027 mám volné termíny v květnu, červnu a září.',
    phone: '731 482 906',
    // (addresses that lead nowhere: the demo's contacts are not anybody's)
    email: 'johana@johanaloudova.example',
    address: 'Toulovcovo náměstí 14, Litomyšl',
    addressNote: 'po předchozí domluvě',
    instagram: 'https://instagram.example/johana.loudova',
    facebook: 'https://facebook.example/johana.loudova',
    companyId: '08412357',
    metaDescription: 'Svatby, portréty a rodinné fotografie z Litomyšle a východních Čech.',
    ogImage: photo.weddingMeadow,
  }, { ifMissing: true })
})
