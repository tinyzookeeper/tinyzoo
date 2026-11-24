import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { pragueMoment } from '../app/utils/site'
import { AgeGroup, Article, Committee, Match, Navigation, Page, Player, Sponsor, Squad, Standing, SiteSettings } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Sports club template: the fictional football club TJ Tatran Hořany,
// the week before a home match with the league leader. One set of content for all three looks,
// worded as the design of the look the site is made in (texts/cs.ts holds every text of it).
//
// The matches are dated from the day the seed runs: the next home match falls on the first
// Saturday at least three days ahead, the others lie before and after it as in the design, so
// the demo always has both played and coming matches.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name (pages and articles by their
// address), a file by its name, and what is already as written here is left alone. The site's
// settings are only written when there are none yet, so a second run never undoes the owner's
// look or name.

/** The calendar day of today in Prague, as year, month (1–12) and day. */
function today() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/** The first Saturday at least three days from now, as a UTC date (only its calendar day matters). */
function nextSaturday(): Date {
  const t = today()
  const day = new Date(Date.UTC(t.y, t.m - 1, t.d + 3))
  while (day.getUTCDay() !== 6) day.setUTCDate(day.getUTCDate() + 1)
  return day
}

export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)
  const { doc, p } = s.rich

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── dates ──
  const anchor = nextSaturday()
  /** The instant a match starts: days from the next home match, and the kick-off in Prague. */
  const at = (offset: number, time = '0:00') => {
    const day = new Date(anchor)
    day.setUTCDate(day.getUTCDate() + offset)
    const [h, mi] = time.split(':').map(Number)
    return pragueMoment(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, mi).toISOString()
  }

  // ── the teams, in the order of the tabs ──
  const squadIds: Record<string, string> = {}
  for (const [position, key] of (Object.keys(demo.squads) as Array<keyof typeof demo.squads>).entries()) {
    const sq = demo.squads[key]
    squadIds[key] = (await s.upsert(Squad, { position, ...sq }, { by: 'name' })).id
  }

  // ── the news ──
  const articles: Record<string, string> = {}
  for (const [key, a] of Object.entries(demo.articles)) {
    articles[key] = (await s.upsert(Article, {
      title: a.title, slug: a.slug, status: 'published', date: at(a.offset), category: a.category,
      summary: a.summary, image: photo[a.photo as keyof typeof photo], body: doc(...a.body.map((text) => p(text))),
    })).id
  }

  // ── the matches ──
  const squadName = (key: string) => demo.squads[key as keyof typeof demo.squads].name
  for (const m of demo.matches) {
    const [homeGoals, awayGoals] = m.score ? m.score.split(':').map(Number) : [null, null]
    await s.upsert(Match, {
      squad: squadIds[m.squad]!, date: at(m.offset, m.time), opponent: m.opponent, home: m.home, round: m.round,
      goalsFor: m.score ? (m.home ? homeGoals : awayGoals)! : null, goalsAgainst: m.score ? (m.home ? awayGoals : homeGoals)! : null,
      scorers: m.scorers || null,
      // The last result of the A-team has its report.
      report: m.squad === 'a' && m.round === 10 ? articles.borova! : null,
      reference: `${squadName(m.squad)}, ${m.round}. kolo`,
    }, { by: 'reference' })
  }

  // ── the table ──
  for (const [position, [club, played, wins, draws, losses, score, points]] of demo.standings.entries()) {
    await s.upsert(Standing, { position, club, ours: club === demo.settings.siteName, played, wins, draws, losses, score, points }, { by: 'club' })
  }

  // ── the squad, the age groups, the partners, the committee ──
  for (const [position, [number, name, role, note, key]] of demo.players.entries()) {
    await s.upsert(Player, { position, name, number, role, note: note || null, photo: key ? photo[key as keyof typeof photo] : null }, { by: 'name' })
  }
  for (const [position, g] of demo.ageGroups.entries()) await s.upsert(AgeGroup, { position, ...g }, { by: 'name' })
  for (const [position, sp] of demo.partners.entries()) await s.upsert(Sponsor, { position, url: null, ...sp }, { by: 'name' })
  for (const [position, c] of demo.committee.entries()) await s.upsert(Committee, { position, ...c }, { by: 'name' })

  // ── the home page: the sections of the look's own design, in its order ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const blocks = {
    nextMatch: { type: 'nextMatch' as const, ...demo.nextMatch, image: photo.heroMatch, primaryUrl: to('fixtures'), secondaryUrl: to('about') },
    lastResult: { type: 'lastResult' as const, ...demo.lastResult, image: photo.heroMatch },
    fixtures: { type: 'fixtures' as const, ...demo.fixtures, moreUrl: '/zapasy' },
    table: { type: 'table' as const, ...demo.table, image: photo.net, asideLinkUrl: to('fixtures') },
    teams: { type: 'teams' as const, ...demo.teams, image: photo.net },
    roster: { type: 'roster' as const, ...demo.roster },
    news: { type: 'news' as const, ...demo.news, count: 4, linkUrl: '/aktuality' },
    join: { type: 'join' as const, ...demo.join, image: photo.youthTraining },
    sponsors: { type: 'sponsors' as const, ...demo.sponsors },
    about: { type: 'about' as const, ...demo.about, image: photo.ground },
  }
  // Dres has the news after the membership drive; the other two before it.
  const order = look.id === 'dres'
    ? ['nextMatch', 'lastResult', 'fixtures', 'table', 'teams', 'roster', 'join', 'news', 'sponsors', 'about'] as const
    : ['nextMatch', 'lastResult', 'fixtures', 'table', 'teams', 'roster', 'news', 'join', 'sponsors', 'about'] as const
  await s.upsert(Page, {
    title: demo.pages.home.title, slug: 'home', status: 'published', ogImage: photo.heroMatch,
    metaDescription: demo.settings.metaDescription,
    sections: order.map((key) => blocks[key]),
  })

  // ── the other pages: all articles, the whole fixture list, a text on privacy ──
  await s.upsert(Page, {
    title: demo.pages.news.title, slug: 'aktuality', status: 'published',
    sections: [{ ...blocks.news, heading: demo.pages.news.heading, count: 60, linkLabel: '', linkUrl: null }],
  })
  await s.upsert(Page, {
    title: demo.pages.fixtures.title, slug: 'zapasy', status: 'published',
    sections: [{ ...blocks.fixtures, heading: demo.pages.fixtures.heading, moreLabel: '', moreUrl: null }, blocks.table],
  })
  await s.upsert(Page, {
    title: demo.pages.privacy.title, slug: 'ochrana-osobnich-udaju', status: 'published',
    sections: [{ type: 'text', heading: demo.pages.privacy.heading, body: doc(...demo.pages.privacy.paragraphs.map((text) => p(text))) }],
  })

  // ── the menu: the sections of the page ──
  await s.global(Navigation, {
    main: [
      s.link(demo.menu.fixtures, to('fixtures')), s.link(demo.menu.table, to('table')), s.link(demo.menu.teams, to('teams')),
      s.link(demo.menu.news, to('news')), s.link(demo.menu.about, to('about')),
    ],
    legal: [s.link(demo.menu.privacy, '/ochrana-osobnich-udaju')],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('join'),
    ogImage: photo.heroMatch,
  }, { ifMissing: true })
})
