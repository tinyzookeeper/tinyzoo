import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Article, CaseStudy, Deadline, Navigation, Page, Person, Question, Service, ServiceGroup, SiteSettings } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Office template: the fictional tax and accounting office Tesař &
// Vondrová in Jihlava. One set of content for both looks, worded as the design of the look the
// site is made in (texts/cs.ts holds every text of it), with that design's sections in that
// design's order.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their address or their name, a file by its
// name, and what is already as written here is left alone. The site's settings are only written
// when there are none yet, so a second run never undoes the owner's look or names.

const PRAGUE = 'Europe/Prague'

/** Midnight of a day in Prague as a moment (all-day dates are stored that way): `2026-11-12` → `2026-11-11T23:00:00.000Z`. */
function allDay(year: number, month: number, day: number): string {
  for (const hoursBefore of [1, 2]) {
    const moment = new Date(Date.UTC(year, month - 1, day) - hoursBefore * 3_600_000)
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: PRAGUE, day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(moment)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    if (get('hour') === 0 && get('day') === day) return moment.toISOString()
  }
  throw new Error(`no midnight in Prague on ${year}-${month}-${day}`)
}

/** "2026-11-12" → midnight in Prague on that day. */
const dayOf = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  return allDay(y!, m!, d!)
}

/** Today in Prague, `days` days on, as a moment: the deadlines are always ahead of the day the seed runs. */
function inDays(days: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: PRAGUE, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date())
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + days))
  return allDay(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate())
}

export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)
  const lhuty = look.id === 'lhuty'

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── the services in their groups, the people, the questions, the deadlines ──
  const groups = []
  for (const [position, g] of demo.services.groups.entries()) groups.push(await s.upsert(ServiceGroup, { position, ...g }, { by: 'name' }))
  for (const [position, { group, ...item }] of demo.services.items.entries()) {
    await s.upsert(Service, { position, group: groups[group]!.id, ...item }, { by: 'name' })
  }
  for (const [position, { photo: shot, ...item }] of demo.people.items.entries()) await s.upsert(Person, { position, photo: photo[shot], ...item }, { by: 'name' })
  for (const [position, item] of demo.questions.items.entries()) await s.upsert(Question, { position, ...item }, { by: 'position' })
  // The dates are relative to today: "the nearest deadlines" are never stale.
  for (const { days, text } of demo.deadlines.items) await s.upsert(Deadline, { date: inDays(days), text }, { by: 'text' })

  // ── the cases and the articles: each has a page of its own ──
  const caseImage: Record<number, string> = { 0: photo.porada, 1: photo.stul }
  for (const [position, { body, ...item }] of demo.cases.items.entries()) {
    await s.upsert(CaseStudy, { position, status: 'published', image: caseImage[position] ?? null, body: s.rich.doc(...body.map((p) => s.rich.p(p))), ...item })
  }
  for (const { body, date, ...item } of demo.articles.items) {
    await s.upsert(Article, { status: 'published', date: dayOf(date), body: s.rich.doc(...body.map((p) => s.rich.p(p))), ...item })
  }

  // ── the pages ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const sections = [
    {
      type: 'opening' as const, ...demo.opening, primaryUrl: to('contact'), image: photo.schuzka,
    },
    // (Lhůty opens with the ruler of deadlines; Šanony with a wide photograph of the office)
    lhuty
      ? { type: 'deadlines' as const, eyebrow: '', heading: demo.deadlines.heading, count: 6 }
      : { type: 'photo' as const, image: photo.kancelar, caption: demo.photo.caption },
    { type: 'services' as const, eyebrow: demo.services.eyebrow, heading: demo.services.heading, text: demo.services.text },
    { type: 'audience' as const, eyebrow: demo.audience.eyebrow, heading: demo.audience.heading, text: demo.audience.text, items: demo.audience.items },
    {
      type: 'people' as const, eyebrow: demo.people.eyebrow, heading: demo.people.heading, text: demo.people.text,
      // (the photo of the office beside the heading is Lhůty's)
      image: lhuty ? photo.kancelar : null,
    },
    {
      type: 'steps' as const, eyebrow: demo.steps.eyebrow, heading: demo.steps.heading, items: demo.steps.items,
      image: lhuty ? photo.zasedacka : photo.schuzka,
    },
    { type: 'cases' as const, eyebrow: demo.cases.eyebrow, heading: demo.cases.heading, text: demo.cases.text, count: 0 },
    { type: 'articles' as const, eyebrow: demo.articles.eyebrow, heading: demo.articles.heading, count: 3, allLabel: demo.articles.allLabel, allUrl: '/clanky' },
    { type: 'questions' as const, eyebrow: demo.questions.eyebrow, heading: demo.questions.heading, image: lhuty ? null : photo.sanony },
    {
      type: 'contact' as const, eyebrow: demo.contact.eyebrow, heading: demo.contact.heading, text: demo.contact.text, formHeading: demo.contact.formHeading,
      consent: demo.contact.consent, image: photo.dum, route: demo.contact.route, hoursNote: demo.contact.hoursNote,
    },
  ]
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.kancelar,
    metaDescription: demo.settings.metaDescription,
    sections,
  })
  // The page with every article (the opening's link "Všechny články" leads to it).
  await s.upsert(Page, {
    title: demo.articlesPage.title, slug: 'clanky', status: 'published',
    sections: [{ type: 'articles', eyebrow: demo.articles.eyebrow, heading: demo.articlesPage.heading, count: 0, allLabel: '', allUrl: null }],
  })
  // The documents of the footer: demo texts the office replaces with its own.
  const documents = []
  for (const d of demo.documents) {
    documents.push(await s.upsert(Page, {
      title: d.title, slug: d.slug, status: 'published',
      sections: [{ type: 'text', heading: d.title, body: s.rich.doc(...d.paragraphs.map((p) => s.rich.p(p))) }],
    }))
  }

  // ── the menus: the sections of the home page, and the documents ──
  await s.global(Navigation, {
    main: [
      s.link(demo.menu.services, to('services')), s.link(demo.menu.people, to('people')), s.link(demo.menu.cases, to('cases')),
      s.link(demo.menu.articles, to('articles')), s.link(demo.menu.contact, to('contact')),
    ],
    legal: documents.map((entry, i) => s.link(demo.documents[i]!.title, entry)),
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('contact'),
    ogImage: photo.kancelar,
  }, { ifMissing: true })
})
