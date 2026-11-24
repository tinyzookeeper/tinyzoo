import { defineSeed } from 'tinyzoo'
import { demoFor, refTo, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Document, Event, Navigation, News, Page, Person, Project, SiteSettings, Supporter } from '../cms.config'
import { looks } from '../looks'
import { todayKey } from '../app/utils/site'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { FILES, PHOTOS } from './photos'

// The demo content of the Association template: the fictional association Planá hruška, z. s.,
// of neighbours who look after old orchards, field avenues, a wet meadow and seven springs
// around Jablonné nad Orlicí. One set of content, worded as the design of the look the site is
// made in (texts/cs.ts holds every text of it).
//
// The dates of the events are written from the day the seed runs, so a new site's calendar is
// never stale: the nearest event is the first Saturday at least four days ahead, the others lie
// at the same distances from it as in the design, and the past ones before it.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name or address, a file by its
// name, and what is already as written here is left alone (on another day the events move to
// that day's calendar). The site's settings are only written when there are none yet, so a
// second run never undoes the owner's look or name.

const DAY = 86_400_000
/** A day key moved by whole days. */
const addDays = (key: string, days: number): string => new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
const weekdayOf = (key: string): number => new Date(`${key}T00:00:00Z`).getUTCDay()

/** The moment of a wall-clock time in Prague ("2026-11-28", "09:00") as the UTC time stored. */
function inPrague(key: string, clock = '00:00'): string {
  const [h, m] = clock.split(':').map(Number) as [number, number]
  const wanted = Date.parse(`${key}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)
  const parts = (at: number) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at).map((p) => [p.type, Number(p.value)]))
  const shown = (at: number) => { const p = parts(at); return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!) }
  // (the offset of Prague from UTC on that day, found from what the clock there shows)
  let at = wanted - (shown(wanted) - wanted)
  at = wanted - (shown(at) - at)
  return new Date(at).toISOString()
}

/** "Sázíme alej k Mistrovicím" → "sazime-alej-k-mistrovicim" */
const slugOf = (title: string): string => title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default defineSeed(async (s) => {
  const { doc, p, h2, ul } = s.rich
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)

  // ── the calendar, from today ──
  const today = todayKey()
  let nearestDay = addDays(today, 4)
  while (weekdayOf(nearestDay) !== 6) nearestDay = addDays(nearestDay, 1)
  const on = (offset: number) => addDays(nearestDay, offset)

  // ── photographs and the sample documents ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)
  const file = await uploadPhotos(s, 'seed/media', FILES)

  // ── projects, in the order of the year ──
  const imageOf = [photo.sad, photo.studanka, photo.louka, photo.mostovani, photo.alej]
  for (const [position, project] of demo.projects.entries()) await s.upsert(Project, { position, photo: imageOf[position] ?? null, ...project }, { by: 'title' })

  // ── events: coming (the nearest first), then the past ones with a photograph ──
  for (const e of demo.events.coming) {
    await s.upsert(Event, {
      title: e.title, slug: slugOf(e.title), status: 'published',
      date: inPrague(on(e.in), e.at), endTime: e.endTime || null,
      place: e.place, summary: e.summary, text: e.text || null, teaser: e.teaser || null, bring: e.bring || null,
      signup: e.signup, signupBy: 'signupBy' in e ? inPrague(on(e.signupBy as number)) : null,
      signupLabel: 'signupLabel' in e ? (e.signupLabel as string) : null,
      signupNote: 'signupNote' in e ? (e.signupNote as string) : null,
      capacity: 'capacity' in e ? (e.capacity as number) : null, registered: 'registered' in e ? (e.registered as number) : null,
      photo: null, recap: null,
    }, { by: 'title' })
  }
  for (const e of demo.events.past) {
    await s.upsert(Event, {
      title: e.title, slug: slugOf(e.title), status: 'published', date: inPrague(on(e.in), e.at),
      signup: false, photo: photo[e.photo], recap: e.recap,
    }, { by: 'title' })
  }

  // ── news, newest first on the website ──
  for (const n of demo.news.items) {
    await s.upsert(News, {
      title: n.title, slug: n.slug, status: 'published', date: inPrague(on(n.in)),
      summary: n.summary, photo: 'photo' in n ? photo[n.photo as 'susarna'] : null,
      body: doc(...n.body.map((text) => p(text))),
    })
  }

  // ── documents, people, supporters ──
  // (a document is told apart by its name and its note: the same name comes back every year, and a key cannot be empty, as "no year" is)
  for (const [position, d] of demo.documents.items.entries()) {
    await s.upsert(Document, { position, title: d.title, year: d.year, note: d.note, file: file[d.file as keyof typeof file] }, { by: ['title', 'note'] })
  }
  for (const [position, person] of demo.people.items.entries()) {
    await s.upsert(Person, {
      position, name: person.name, role: person.role, text: person.text, photo: photo[person.photo],
      phone: 'phone' in person ? person.phone : null, email: 'email' in person ? person.email : null, volunteers: 'volunteers' in person ? person.volunteers : false,
    }, { by: 'name' })
  }
  for (const [position, supporter] of demo.supporters.entries()) await s.upsert(Supporter, { position, ...supporter }, { by: 'name' })

  // ── the pages: the home page is the design's, then a calendar, all the news, the archive of documents and the privacy text ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const accounts = demo.accounts

  const eventsPage = await s.upsert(Page, {
    title: demo.pages.events.title, slug: demo.pages.events.slug, status: 'published',
    sections: [{
      type: 'events', heading: demo.pages.events.heading, text: demo.pages.events.text,
      limit: 40, allLabel: null, allUrl: null, lookbackHeading: demo.events.lookbackHeading, pastLimit: 12,
    }],
  })
  const newsPage = await s.upsert(Page, {
    title: demo.pages.news.title, slug: demo.pages.news.slug, status: 'published',
    sections: [{ type: 'news', heading: demo.pages.news.heading, count: 40, list: true, allLabel: null, allUrl: null }],
  })
  const documentsPage = await s.upsert(Page, {
    title: demo.pages.documents.title, slug: demo.pages.documents.slug, status: 'published',
    sections: [{ type: 'documents', heading: demo.documents.heading, text: demo.documents.text }],
  })
  const privacy = await s.upsert(Page, {
    title: demo.pages.privacy.title, slug: demo.pages.privacy.slug, status: 'published',
    sections: [{
      type: 'text', heading: demo.pages.privacy.title,
      body: doc(p(demo.privacy.lead), ...demo.privacy.sections.flatMap((sec) => [h2(sec.heading), p(sec.text)]), ul(...demo.privacy.list)),
    }],
  })

  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.hero,
    metaDescription: demo.settings.metaDescription,
    sections: [
      { type: 'opening', ...demo.opening, image: photo.hero, primaryUrl: to('events'), secondaryUrl: to('give') },
      { type: 'year', ...demo.year, asideLinkUrl: to('accounts') },
      { type: 'events', heading: demo.events.heading, text: demo.events.text, limit: demo.events.limit, allLabel: demo.events.allLabel, allUrl: refTo(s, eventsPage), lookbackHeading: demo.events.lookbackHeading, pastLimit: demo.events.pastLimit },
      {
        type: 'help', ...demo.help, volunteerImage: photo.naradi, qrImage: null,
        memberButtonUrl: to('contact'), sums: demo.help.sums,
      },
      {
        type: 'accounts', ...accounts, archiveUrl: refTo(s, documentsPage), income: accounts.income, expenses: accounts.expenses,
      },
      { type: 'people', heading: demo.people.heading, text: demo.people.text, helloLabel: demo.people.helloLabel, helloText: demo.people.helloText },
      { type: 'news', heading: demo.news.heading, count: demo.news.count, list: false, allLabel: demo.news.allLabel, allUrl: refTo(s, newsPage) },
      { type: 'contact', heading: demo.contact.heading, text: demo.contact.text, formHeading: demo.contact.formHeading, formText: demo.contact.formText, topics: demo.contact.topics.map((name) => ({ name })), formNote: demo.contact.formNote },
    ],
  })

  // ── the menu: the sections of the home page; the footer: the statutes, the privacy text, Facebook ──
  await s.global(Navigation, {
    main: [
      s.link(demo.menu.year, to('year')), s.link(demo.menu.events, to('events')), s.link(demo.menu.help, to('help')),
      s.link(demo.menu.accounts, to('accounts')), s.link(demo.menu.people, to('people')), s.link(demo.menu.contact, to('contact')),
    ],
    legal: [s.link(demo.legal.statutes, documentsPage), s.link(demo.legal.privacy, privacy), s.link(demo.legal.facebook, demo.facebookUrl)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    months: demo.months,
    ctaUrl: to('give'),
    ogImage: photo.hero,
  }, { ifMissing: true })
})
