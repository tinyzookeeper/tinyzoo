import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { FeePeriod, Navigation, NewsItem, Page, Partner, ProgramItem, Question, Result, SiteSettings, Track, VenuePoint } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { eventDates, fillTokens } from './dates'
import { PHOTOS } from './photos'

// The demo content of the Event template: the fictional trail race Tři vrchy. One set of
// content for both looks, worded as the design of the look the site is made in (texts/cs.ts
// holds every text of it), with the sections of that design in its order. The date of the race
// is some months ahead of the day the seed runs, on a Saturday (seed/dates.ts).
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_LOOK=soutisk SEED_URL=http://localhost:3431 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name (pages by their address), a
// file by its name, and what is already as written here is left alone. The site's settings
// are only written when there are none yet, so a second run never undoes the owner's look or name.

export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it, with the dates that follow from the day of the race.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const dates = eventDates()
  const demo = fillTokens(demoFor(shared, demoByLook, look.id), dates.tokens)
  const { rich } = s

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── routes, fee periods, programme, results, news, partners, questions, points of the plan ──
  const track: Record<string, string> = {}
  for (const [position, t] of demo.routes.items.entries()) {
    const entry = await s.upsert(Track, {
      position, ...t,
      prices: t.prices.map((price) => ({ price })),
      peaks: t.peaks.map((p) => ({ km: p.km, height: p.height || null, label: p.label })),
    }, { by: 'name' })
    track[t.name] = entry.id
  }
  for (const [position, p] of demo.fees.periods.entries()) {
    // (winter and spring end on a day; the last, "on the spot", never)
    const validUntil = position === 0 ? dates.earlyIso : position === 1 ? dates.springIso : null
    await s.upsert(FeePeriod, { position, name: p.name, validUntil }, { by: 'name' })
  }
  for (const [position, item] of demo.programme.items.entries()) await s.upsert(ProgramItem, { position, ...item, highlight: item.highlight as 'none' | 'start' | 'ceremony' }, { by: 'title' })
  for (const [position, r] of demo.results.items.entries()) {
    await s.upsert(Result, { year: Number(dates.tokens.prevYear), track: track[r.track]!, category: r.category, place: r.place, name: r.name, club: r.club, time: r.time, record: r.record, position }, { by: 'name' })
  }
  for (const item of demo.news.items) {
    await s.upsert(NewsItem, {
      title: item.title, slug: item.slug, date: dates.ago(item.daysAgo), summary: item.summary,
      body: rich.doc(...item.body.map((text) => rich.p(text))), image: null,
    }, { by: 'title' })
  }
  for (const [position, p] of demo.partners.items.entries()) await s.upsert(Partner, { position, name: p.name, level: p.level as 'main' | 'partner' | 'supporter', url: null }, { by: 'name' })
  for (const [position, q] of demo.faq.items.entries()) await s.upsert(Question, { position, ...q }, { by: 'question' })
  // (the points differ in name between the looks: they are told apart by their place in the list)
  for (const [position, p] of demo.venue.points.entries()) await s.upsert(VenuePoint, { position, ...p }, { by: 'position' })

  // ── the pages ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const links = (list: Array<{ label: string; url: string }>) => list.map((l) => ({ label: l.label, url: l.url }))
  const blocks = {
    opening: () => ({
      type: 'opening' as const, ...demo.opening,
      image: photo.krajina, darkImage: photo.rano, secondaryUrl: to('routes'),
    }),
    routes: () => ({ type: 'routes' as const, eyebrow: demo.routes.eyebrow, heading: demo.routes.heading, text: demo.routes.text, links: links(demo.routes.links) }),
    programme: () => ({
      type: 'programme' as const, eyebrow: demo.programme.eyebrow, heading: demo.programme.heading, text: demo.programme.text,
      photos: [{ image: photo.mlha, caption: demo.programme.photos[0]!.caption }, { image: photo.start, caption: demo.programme.photos[1]!.caption }],
    }),
    fees: () => ({
      type: 'fees' as const, eyebrow: demo.fees.eyebrow, heading: demo.fees.heading, text: demo.fees.text,
      pricesNote: demo.fees.pricesNote, includedTitle: demo.fees.includedTitle,
      included: demo.fees.included.map((text) => ({ text })), notes: demo.fees.notes.map((text) => ({ text })),
    }),
    results: () => ({
      type: 'results' as const, eyebrow: demo.results.eyebrow, heading: demo.results.heading, text: demo.results.text,
      year: Number(dates.tokens.prevYear), all: false, image: photo.cil, links: links(demo.results.links),
    }),
    gallery: () => ({
      type: 'gallery' as const, eyebrow: demo.gallery.eyebrow, heading: demo.gallery.heading,
      linkLabel: demo.gallery.linkLabel, linkUrl: demo.gallery.linkUrl, credit: demo.gallery.credit,
      photos: demo.gallery.photos.map((p) => ({ image: photo[p.photo as keyof typeof photo], caption: p.caption })),
    }),
    practical: () => ({
      type: 'practical' as const, eyebrow: demo.practical.eyebrow, heading: demo.practical.heading,
      items: demo.practical.items.map((i) => ({ ...i, icon: i.icon as 'parking' })), image: photo.obcerstveni,
      rulesTitle: demo.practical.rulesTitle, rules: demo.practical.rules.map((text) => ({ text })),
      rulesLabel: demo.practical.rulesLabel, rulesUrl: '/propozice',
    }),
    venue: () => ({
      type: 'venue' as const, eyebrow: demo.venue.eyebrow, heading: demo.venue.heading, text: demo.venue.text,
      // (the sample drawing: a real site uploads its own plan and turns this off)
      plan: null, samplePlan: true, linkLabel: demo.venue.linkLabel,
    }),
    news: () => ({ type: 'news' as const, eyebrow: demo.news.eyebrow, heading: demo.news.heading, count: 3, linkLabel: demo.news.linkLabel, linkUrl: '/aktuality' }),
    faq: () => ({ type: 'faq' as const, eyebrow: demo.faq.eyebrow, heading: demo.faq.heading, text: demo.faq.text }),
    partners: () => {
      const { items: _list, ...text } = demo.partners
      return { type: 'partners' as const, ...text, image: photo.ves }
    },
    closing: () => ({ type: 'closing' as const, ...demo.closing }),
  }

  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.rano, metaDescription: demo.settings.metaDescription,
    sections: demo.home.order.map((kind) => blocks[kind as keyof typeof blocks]()),
  })
  const pages = demo.pages
  await s.upsert(Page, {
    title: pages.contact.title, slug: 'kontakt', status: 'published',
    sections: [{ type: 'contact', eyebrow: pages.contact.eyebrow, heading: pages.contact.heading, text: pages.contact.text }],
  })
  await s.upsert(Page, {
    title: pages.news.title, slug: 'aktuality', status: 'published',
    sections: [{ type: 'news', eyebrow: pages.news.eyebrow, heading: pages.news.heading, count: 0, linkLabel: '', linkUrl: null }],
  })
  await s.upsert(Page, {
    title: pages.results.title, slug: 'vysledky', status: 'published',
    sections: [{ type: 'results', eyebrow: pages.results.eyebrow, heading: pages.results.heading, text: pages.results.text, year: Number(dates.tokens.prevYear), all: true, image: null, links: [] }],
  })
  const textPage = (page: { heading: string; lead: string; sections: Array<{ heading: string; text?: string; items?: string[] }> }) => ({
    type: 'text' as const, heading: page.heading,
    body: rich.doc(
      rich.p(page.lead),
      ...page.sections.flatMap((section) => [rich.h2(section.heading), section.items ? rich.ul(...section.items) : rich.p(section.text ?? '')]),
    ),
  })
  await s.upsert(Page, { title: pages.rules.title, slug: 'propozice', status: 'published', sections: [textPage(pages.rules)] })
  await s.upsert(Page, { title: pages.privacy.title, slug: 'ochrana-osobnich-udaju', status: 'published', sections: [textPage(pages.privacy)] })

  // ── the menus: the sections of the home page and the pages ──
  const target = (key: string) => (key in words.anchors ? to(key as keyof typeof words.anchors) : key)
  const menu = (list: Array<{ label: string; to: string }>) => list.map((l) => s.link(l.label, target(l.to)))
  await s.global(Navigation, { main: menu(demo.menu.main), race: menu(demo.menu.race), years: menu(demo.menu.years), legal: menu(demo.menu.legal) })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    date: dates.start,
    registrationCloses: dates.registrationCloses,
    ogImage: photo.rano,
  }, { ifMissing: true })
})
