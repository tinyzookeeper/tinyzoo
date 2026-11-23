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
  const weddings = await category(0, 'Svatby', 'svatby', 'Fotím celý den nebo jen obřad. Během dne se držím mezi hosty a do toho, co se děje, moc nezasahuji.')
  const portraits = await category(1, 'Portréty', 'portrety', 'V ateliéru s oknem na sever, u vás doma nebo venku.')
  const families = await category(2, 'Rodina', 'rodina', 'Miminka fotím nejraději u vás doma. Se staršími dětmi můžeme vyrazit ven.')
  const business = await category(3, 'Firemní', 'firemni', 'Portréty a reportáže z dílen, ateliérů a provozoven.')

  // ── albums: newest first on the website ──
  const album = (data: { title: string; slug: string; category: string; date: string; place: string; summary?: string; cover: string; photos: ReturnType<typeof gallery> }) =>
    s.upsert(Album, { status: 'published', summary: null, ...data })

  const annaVojta = await album({
    title: 'Anna a Vojta', slug: 'anna-a-vojta', category: weddings, date: '2026-08-21T22:00:00Z', place: 'Budislav',
    summary: 'Anna na statku v Budislavi trávila prázdniny. S Vojtou se tam vzali pod lípou, večeřeli v sadu a večer tančili ve stodole.',
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
    name: 'Portrét a rodina', price: 3900, description: 'Focení venku, u vás doma nebo v ateliéru.',
    includes: ['1 až 1,5 hodiny focení', '30 upravených fotografií', 'Online galerie s možností stažení', '5 fotografií na papíře 13 × 18 cm', 'Předání do 14 dnů'],
  })
  await pack(1, {
    name: 'Svatba · půlden', price: 19900, description: 'Obřad, gratulace, skupinové fotky a portréty.',
    includes: ['6 hodin focení', 'Schůzka nebo videohovor předem', '250 až 350 upravených fotografií', 'Online galerie pro vás i hosty', 'Předání do 6 týdnů'],
  })
  await pack(2, {
    name: 'Svatba · celý den', price: 32900, description: 'Od příprav po první tanec.', highlighted: true, highlightLabel: 'Od rána do večera',
    includes: ['12 hodin focení', 'Schůzka a obhlídka místa předem', '500 až 700 upravených fotografií', 'Online galerie pro vás i hosty', 'Krabička s 30 papírovými fotografiemi', 'Předání do 6 týdnů'],
  })

  // ── testimonials: the first is shown largest ──
  const testimonial = (position: number, name: string, occasion: string, text: string) =>
    s.upsert(Testimonial, { position, name, occasion, text }, { by: 'name' })
  await testimonial(0, 'Anna a Vojta', 'svatba v Budislavi', 'Johanu jsme na svatbě skoro nevnímali, a přesto má fotku každého, na kom nám záleží. Babička si tu svou nechala zarámovat.')
  await testimonial(1, 'Markéta', 'portrét v ateliéru', 'Nerada se fotím. S Johanou jsme si povídaly u okna a já po chvíli na foťák zapomněla.')
  await testimonial(2, 'Kubátovi', 'rodinné focení', 'Děti v lese tahaly klacky a honily se v listí. Doma teď máme nad gaučem fotku, na které se smějí obě.')

  // ── pages ──
  // A link to a page of this seed is a reference to it (what the admin's link picker stores), so
  // it follows the page when it is renamed.
  const enquiryBlock = (privacyUrl: string) => ({
    type: 'enquiry' as const,
    eyebrow: 'Poptávka',
    heading: 'Domluvme se *na focení.*',
    text: 'Napište mi, co chcete fotit, kdy a kde. Pokud mám volno, můžeme si krátce zavolat.',
    consent: 'Odesláním souhlasíte se *zpracováním osobních údajů*.',
    consentUrl: privacyUrl,
  })
  const stepsBlock = {
    type: 'steps' as const,
    eyebrow: 'Od první zprávy po galerii',
    heading: 'Jak to probíhá',
    items: [
      { title: 'Napíšete mi', text: 'Napište, kdy a kde chcete fotit a co chystáte.' },
      { title: 'Poznáme se', text: 'Sejdeme se v Litomyšli nebo si zavoláme. Probereme, kde budeme fotit a na čem vám záleží.' },
      { title: 'Potvrdíme termín', text: 'Termín si rezervujete podpisem smlouvy a zaplacením zálohy ve výši 30 %.' },
      { title: 'Focení a předání fotek', text: 'První ukázky posílám do týdne. Celou galerii předávám do 14 dnů, u svateb do 6 týdnů.' },
    ],
  }
  const testimonialsBlock = { type: 'testimonials' as const, eyebrow: '', heading: 'Napsali o focení', count: 3 }

  const privacy = await s.upsert(Page, {
    title: 'Ochrana osobních údajů', slug: 'ochrana-osobnich-udaju', status: 'published',
    sections: [{
      type: 'text', heading: 'Ochrana osobních údajů',
      body: doc(
        p('Ukázkový text. Před zveřejněním popište, jak s údaji klientů nakládáte vy.'),
        h2('Jaké údaje zpracovávám'),
        p('Z formuláře mám vaše jméno, e-mail a zprávu. Když si objednáte focení, zpracovávám i fakturační údaje a vaše fotografie.'),
        h2('Proč údaje potřebuji'),
        ul('abych vám mohla odpovědět', 'abych s vámi uzavřela smlouvu a vystavila fakturu', 'abych vám předala hotové fotografie'),
        h2('Jak dlouho je uchovávám'),
        p('Pokud se na focení nedomluvíme, poptávku do půl roku smažu. Fotografie ukládám tři roky od předání, pokud se nedomluvíme jinak.'),
      ),
    }],
  })
  const terms = await s.upsert(Page, {
    title: 'Obchodní podmínky', slug: 'obchodni-podminky', status: 'published',
    sections: [{
      type: 'text', heading: 'Obchodní podmínky',
      body: doc(
        p('Ukázkový text. Před zveřejněním sem vložte vlastní obchodní podmínky.'),
        h2('Rezervace termínu'),
        p('Termín rezervuji po podpisu smlouvy a zaplacení zálohy ve výši 30 %. Zbytek ceny zaplatíte do sedmi dnů po focení.'),
        h2('Zrušení a přesun'),
        p('Termín můžete jednou přesunout bez poplatku, pokud mi dáte vědět alespoň 30 dnů předem. Pokud focení zrušíte, zálohu nevracím.'),
        h2('Předání fotografií'),
        p('Upravené fotografie najdete v online galerii. Termín předání je uvedený u každého balíčku.'),
      ),
    }],
  })
  const contact = await s.upsert(Page, {
    title: 'Kontakt', slug: 'kontakt', status: 'published',
    metaDescription: 'Máte zájem o focení? Napište mi, kde a kdy by se vám hodilo.',
    sections: [enquiryBlock(refTo(s, privacy))],
  })

  const pricingBlock = {
    type: 'pricing' as const,
    eyebrow: 'Balíčky',
    heading: 'Ceník',
    text: 'Ceny jsou konečné. Nejsem plátkyně DPH. Cesta do 50 km od Litomyšle je v ceně, dál účtuji 8 Kč za kilometr.',
    buttonLabel: 'Zeptat se na termín', buttonUrl: refTo(s, contact),
    footnote: 'Firemní portréty a reportáže z provozu stojí obvykle od 6 500 Kč za půlden. Cenu upřesním podle rozsahu focení.',
    footnoteLinkLabel: 'Napište mi, co potřebujete.', footnoteLinkUrl: refTo(s, contact),
  }
  const aboutBlock = {
    type: 'about' as const,
    eyebrow: 'O mně',
    heading: 'Nejdřív se dívám. *Pak fotím.*',
    image: photo.about,
    imageCaption: 'Johana Loudová, Litomyšl',
    text: [
      'Po studiu fotografie v Opavě jsem se vrátila domů do Litomyšle. Mám tu ateliér s oknem na sever. Venku ráda fotím na loukách u Sebranic.',
      'Na svatbě ráda fotím, co se děje stranou. Třeba když si po obřadu konečně sednete. U portrétů si nejdřív povídáme, pak beru do ruky foťák.',
    ].join('\n\n'),
    facts: [
      { label: 'Svatby', value: 'Nejvýš dvacet ročně, abych měla na každou čas.' },
      { label: 'Světlo', value: 'Denní. Nejraději hodinu před západem slunce.' },
      { label: 'Bert', value: 'Můj pes. Když fotíme rodinu venku, můžu ho vzít s sebou.' },
    ],
    signature: 'Johana',
  }

  const galleryPage = await s.upsert(Page, {
    title: 'Galerie', slug: 'galerie', status: 'published',
    metaDescription: 'Prohlédněte si alba ze svateb, rodinného focení, portrétů a práce pro firmy.',
    sections: [{ type: 'albums', eyebrow: 'Všechna alba', heading: 'Galerie', text: 'Vyberte si kategorii nebo si prohlédněte všechna alba.' }],
  })
  const pricingPage = await s.upsert(Page, {
    title: 'Ceník', slug: 'cenik', status: 'published',
    metaDescription: 'Svatby od 19 900 Kč, portrét a rodina od 3 900 Kč. Co je v ceně a jak focení probíhá.',
    sections: [pricingBlock, stepsBlock, enquiryBlock(refTo(s, privacy))],
  })
  const aboutPage = await s.upsert(Page, {
    title: 'O mně', slug: 'o-mne', status: 'published',
    metaDescription: 'Johana Loudová, fotografka z Litomyšle. Svatby a portréty fotím od roku 2014.',
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
        text: 'Fotím svatby, portréty, rodiny a firmy ve východních Čechách. V ateliéru u okna, venku nebo u vás. Svatby od 19 900 Kč, portrét a rodina od 3 900 Kč.',
        images: [
          { image: photo.weddingMeadow, caption: 'Anna a Vojta · Budislav, srpen 2026' },
          { image: photo.familyHome, caption: 'Jana a Toník' },
          { image: photo.portraitGirl, caption: 'Eliška' },
        ],
        darkImage: photo.weddingDance,
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
          { label: 'V albu', value: '6 fotografií' },
        ],
        text: 'Na statku v Budislavi se sešlo šedesát hostů. Přijela jsem po poledni, když se Anna chystala v pokoji po babičce, a zůstala jsem až do půlnoci.',
        photos: [
          { image: photo.weddingGettingReady, time: '13.10', caption: 'Pokoj po babičce a okno na sever' },
          { image: photo.weddingCeremony, time: '15.00', caption: 'Obřad pod lípou' },
          { image: photo.weddingTable, time: '16.20', caption: 'Tabule v sadu' },
          { image: photo.weddingCouple, time: '18.40', caption: 'Deset minut jen pro sebe' },
          { image: photo.weddingDance, time: '21.30', caption: 'První tanec ve stodole' },
        ],
        closing: 'V albu najdete i fotografii z louky za statkem.',
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
    main: [s.link('Galerie', galleryPage), s.link('Jedna svatba', annaVojta), s.link('Ceník', pricingPage), s.link('O mně', aboutPage)],
    footer: [s.link('Galerie', galleryPage), s.link('Ceník', pricingPage), s.link('O mně', aboutPage), s.link('Kontakt', contact)],
    legal: [s.link('Ochrana osobních údajů', privacy), s.link('Obchodní podmínky', terms)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    siteName: 'Johana Loudová',
    look: looks.ids[0],
    colors: looks.all[0].presets[0].id,
    tagline: 'Fotím svatby, portréty, rodiny a firmy v Litomyšli a východních Čechách.',
    ctaLabel: 'Poptat termín',
    ctaUrl: refTo(s, contact),
    availability: 'V květnu, červnu a září 2027 mám ještě volné termíny.',
    // (contacts that are not anybody's: a number no phone has (Czech numbers do not start with 1),
    // addresses that lead nowhere, a street the town does not have)
    phone: '123 456 789',
    email: 'johana@loudova.example',
    address: 'Fotografická 14, Litomyšl',
    addressNote: 'po předchozí domluvě',
    instagram: 'https://instagram.example/johana.loudova',
    facebook: 'https://facebook.example/johana.loudova',
    companyId: '08412357',
    metaDescription: 'Svatby, portréty a rodinné fotografie z Litomyšle a východních Čech.',
    ogImage: photo.weddingMeadow,
  }, { ifMissing: true })
})
