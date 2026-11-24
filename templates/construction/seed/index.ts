import { defineSeed } from 'tinyzoo'
import { demoFor, gallery, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Navigation, Page, Person, Project, Service, SiteSettings, Testimonial, Town } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Builders and architects template: the fictional firm Stavby Doubrava
// of Chotěboř, builder of family houses, renovations and roofs. One content model for all three
// looks, worded as the design of the look the site is made in (texts/cs.ts holds every text of
// it), and a home page with the sections that design has, in its order.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_LOOK=harmonogram SEED_URL=http://localhost:3435 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their address or name, a file by its name,
// and what is already as written here is left alone. The site's settings are only written when
// there are none yet, so a second run never undoes the owner's look or name.

type Section = 'hero' | 'facts' | 'building' | 'projects' | 'services' | 'process' | 'team' | 'testimonials' | 'enquiry' | 'contact'

/** The sections of the home page in the order each design has them. */
const HOME: Record<string, Section[]> = {
  vykres: ['hero', 'facts', 'projects', 'services', 'process', 'team', 'testimonials', 'enquiry', 'contact'],
  harmonogram: ['hero', 'building', 'projects', 'process', 'services', 'facts', 'team', 'testimonials', 'enquiry', 'contact'],
  zdivo: ['hero', 'facts', 'projects', 'services', 'process', 'team', 'testimonials', 'enquiry', 'contact'],
}

/** Midnight in the site's time zone (Europe/Prague), as the admin stores an all-day date. */
function pragueMidnight(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  const [y, m, d] = parts.split('-').map(Number) as [number, number, number]
  for (const offset of [1, 2]) {
    const t = new Date(Date.UTC(y, m - 1, d, 0, 0) - offset * 3_600_000)
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', hourCycle: 'h23' }).format(t)
    if (hour === '00') return t.toISOString()
  }
  return new Date(Date.UTC(y, m - 1, d)).toISOString()
}

export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)
  const pic = (key: string) => photo[key as keyof typeof photo]

  // ── the projects: the finished ones, then the ones under construction ──
  const finishedProjects = [
    { slug: 'dum-v-libici-nad-doubravou', name: 'Dům v Libici nad Doubravou', kind: 'new', place: 'Libice nad Doubravou', year: 2025, area: 128, layout: '4+kk · přízemní', weeks: 38, contractWeeks: 40, system: 'masonry', systemNote: 'cihla 44 cm', priceFrom: 6_600_000, priceTo: 7_000_000, summary: demo.libice.summary,
      parameters: [{ label: 'Vytápění', value: 'tepelné čerpadlo, podlahové' }], photos: gallery(...demo.libice.photos.map((p) => [pic(p.photo), p.caption] as [string, string])),
      quote: 'Cena ve smlouvě byla stejná jako na poslední faktuře. A stěhovali jsme se o dva týdny dřív, než bylo v plánu.', quoteAuthor: 'Kateřina a Jan Novotní', quotePlace: 'Libice nad Doubravou', featured: true },
    { slug: 'drevostavba-v-krucemburku', name: 'Dřevostavba v Krucemburku', kind: 'new', place: 'Krucemburk', year: 2024, area: 112, weeks: 26, system: 'timber', priceFrom: 5_400_000, priceTo: 5_800_000, summary: demo.projectTexts.krucemburk, photos: gallery(photo.krucemburk) },
    { slug: 'chalupa-v-sobinove', name: 'Chalupa v Sobíňově', kind: 'renovation', place: 'Sobíňov', year: 2023, area: 146, weeks: 46, system: 'masonry', priceFrom: 4_200_000, priceTo: 4_600_000, summary: demo.projectTexts.sobinov, photos: gallery(photo.sobinov) },
    { slug: 'strecha-v-pribyslavi', name: 'Střecha v Přibyslavi', kind: 'roof', place: 'Přibyslav', year: 2025, area: 210, areaMeasure: 'roof', weeks: 4, system: 'other', systemNote: 'nový krov', priceFrom: 900_000, priceTo: 1_100_000, summary: demo.projectTexts.pribyslav, photos: gallery(photo.pribyslav) },
    { slug: 'pristavba-v-havlickove-brode', name: 'Přístavba v Havlíčkově Brodě', kind: 'extension', place: 'Havlíčkův Brod', year: 2024, area: 46, weeks: 17, system: 'timber', priceFrom: 1_900_000, priceTo: 2_200_000, summary: demo.projectTexts.brod, photos: gallery(photo.brod) },
    { slug: 'dum-ve-zdirci-nad-doubravou', name: 'Dům ve Ždírci nad Doubravou', kind: 'new', place: 'Ždírec nad Doubravou', year: 2022, area: 154, weeks: 42, system: 'masonry', priceFrom: 5_900_000, priceTo: 6_300_000, summary: demo.projectTexts.zdirec, photos: gallery(photo.zdirec) },
  ] as const
  for (const [position, p] of finishedProjects.entries()) {
    await s.upsert(Project, { status: 'published', state: 'done', featured: false, ...p, parameters: [...(('parameters' in p ? p.parameters : []) as Array<{ label: string; value: string }>)], position }, { by: 'slug' })
  }
  // The week a build under construction is in is counted from its start, so the start is set
  // to put each where the design has it today (a few days into its week).
  const now = Date.now()
  for (const [i, b] of demo.building.items.entries()) {
    await s.upsert(Project, {
      slug: b.slug, name: b.name, status: 'published', state: 'building', kind: b.kind as 'new', place: b.place, area: b.area, areaMeasure: b.kind === 'roof' ? 'roof' : 'usable',
      weeks: b.weeks, system: b.kind === 'roof' ? 'other' : 'masonry', systemNote: b.kind === 'roof' ? 'nový krov' : '',
      startDate: pragueMidnight(new Date(now - ((b.week - 1) * 7 + 3) * 86_400_000)), currentStage: b.stage, handoverDate: pragueMidnight(new Date(`${b.handover}T12:00:00Z`)),
      photos: gallery(pic(b.photo)), featured: false, parameters: [], position: finishedProjects.length + i,
    }, { by: 'slug' })
  }

  // ── services, people, clients' words, towns ──
  for (const [position, item] of demo.services.items.entries()) {
    await s.upsert(Service, { position, name: item.name, text: item.text, included: item.included.map((text) => ({ text })), excluded: item.excluded.map((text) => ({ text })), price: item.price, unit: item.unit }, { by: 'name' })
  }
  for (const [position, item] of demo.team.people.entries()) {
    await s.upsert(Person, { position, name: item.name, role: item.role, text: item.text, phone: item.phone, quote: item.quote, photo: pic(item.photo) }, { by: 'name' })
  }
  for (const [position, item] of demo.testimonials.items.entries()) await s.upsert(Testimonial, { position, ...item }, { by: 'name' })
  for (const [position, t] of demo.contact.towns.entries()) {
    await s.upsert(Town, { position, name: t.name, shortName: t.shortName ?? '', km: t.km, seat: t.seat ?? false, note: t.seat ? demo.contact.seatNote : '' }, { by: 'name' })
  }

  // ── the text pages, linked from the footer ──
  const textPage = (d: typeof demo.privacy, slug: string) => s.upsert(Page, {
    title: d.title, slug, status: 'published',
    sections: [{
      type: 'text', heading: d.title,
      body: s.rich.doc(s.rich.p(d.intro), ...d.sections.flatMap((sec) => [s.rich.h2(sec.heading), s.rich.p(sec.text)])),
    }],
  })
  const privacy = await textPage(demo.privacy, 'ochrana-osobnich-udaju')
  const cookies = await textPage(demo.cookies, 'cookies')

  // ── the blocks of the home page, then the pages ──
  const blocks = {
    hero: () => ({
      type: 'hero' as const, eyebrow: demo.hero.eyebrow, heading: demo.hero.heading, lead: demo.hero.lead, text: demo.hero.text,
      primaryLabel: demo.hero.primaryLabel, primaryUrl: to('enquiry'), image: pic(demo.hero.photo), caption: demo.hero.caption, captionShort: demo.hero.captionShort, note: demo.hero.note,
    }),
    facts: () => ({ type: 'facts' as const, heading: demo.facts.heading, text: demo.facts.text, items: demo.facts.items, ctaLabel: demo.facts.ctaLabel, ctaUrl: demo.facts.ctaLabel ? to('enquiry') : null }),
    building: () => ({ type: 'building' as const, eyebrow: demo.building.eyebrow, heading: demo.building.heading, text: demo.building.text }),
    projects: () => ({
      type: 'projects' as const, eyebrow: demo.projects.eyebrow, heading: demo.projects.heading, text: demo.projects.text,
      showFeatured: true, featuredLabel: demo.projects.featuredLabel, moreHeading: demo.projects.moreHeading, limit: 5, filter: true,
      archiveLabel: demo.projects.archiveLabel, archiveTitle: demo.projects.archiveTitle, archiveUrl: '/realizace', figure: demo.projects.figure, figureText: demo.projects.figureText, scaleWeeks: null,
    }),
    services: () => ({ type: 'services' as const, eyebrow: demo.services.eyebrow, heading: demo.services.heading, text: demo.services.text, note: demo.services.note }),
    process: () => ({
      type: 'process' as const, eyebrow: demo.process.eyebrow, heading: demo.process.heading, text: demo.process.text,
      steps: demo.process.steps.map((st) => ({ duration: '', weeks: null, payment: null, ...st })),
      totalLabel: demo.process.totalLabel, inspectionEvery: demo.process.inspectionEvery, inspectionTitle: demo.process.inspectionTitle, inspectionText: demo.process.inspectionText,
      paymentsTitle: demo.process.paymentsTitle, paymentsText: demo.process.paymentsText,
    }),
    team: () => ({ type: 'team' as const, eyebrow: demo.team.eyebrow, heading: demo.team.heading, text: demo.team.text, note: demo.team.note }),
    testimonials: () => ({ type: 'testimonials' as const, eyebrow: demo.testimonials.eyebrow, heading: demo.testimonials.heading }),
    enquiry: () => ({
      type: 'enquiry' as const, eyebrow: demo.enquiry.eyebrow, heading: demo.enquiry.heading, text: demo.enquiry.text, steps: demo.enquiry.steps,
      callLabel: demo.enquiry.callLabel, signature: demo.enquiry.signature, consent: demo.enquiry.consent,
      kinds: demo.enquiry.kinds.map((name) => ({ name })), starts: demo.enquiry.starts.map((name) => ({ name })),
    }),
    contact: () => ({
      type: 'contact' as const, officeEyebrow: demo.contact.officeEyebrow, officeHeading: demo.contact.officeHeading, officeNote: demo.contact.officeNote,
      regionEyebrow: demo.contact.regionEyebrow, regionHeading: demo.contact.regionHeading, regionText: demo.contact.regionText, otherPlaces: demo.contact.otherPlaces, rangeKm: demo.contact.rangeKm,
    }),
  }
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.libice, metaDescription: demo.settings.metaDescription,
    sections: (HOME[look.id] ?? HOME.vykres!).map((section) => blocks[section]()),
  })
  // The archive: every finished project, with the filter, and the enquiry under it.
  await s.upsert(Page, {
    title: demo.archive.title, slug: 'realizace', status: 'published', ogImage: photo.libice,
    sections: [
      { ...blocks.projects(), eyebrow: '', heading: demo.archive.heading, text: demo.archive.text, showFeatured: false, moreHeading: demo.archive.moreHeading, limit: null, archiveLabel: '', archiveTitle: '', archiveUrl: null, figure: '', figureText: '' },
      blocks.enquiry(),
    ],
  })

  // ── the menus: the sections of the home page, and the legal pages ──
  await s.global(Navigation, {
    main: demo.menu.map((m) => s.link(m.label, to(m.to))),
    legal: [s.link(demo.privacy.title, privacy), s.link(demo.cookies.title, cookies)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  const { menuNotes, ...settings } = demo.settings
  await s.global(SiteSettings, {
    ...settings,
    menuNotes,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('enquiry'),
    ogImage: photo.libice,
  }, { ifMissing: true })
})
