import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Article, Author, Navigation, Page, Section, Series, SiteSettings } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Blog template: Souvrať, a small magazine from the highlands near Žďár
// with three authors, five sections, a series of twelve parts and a Sunday newsletter. One set
// of content for both looks; every text of it is in texts/cs.ts.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their headline or name (pages by their
// address), a file by its name, and what is already as written here is left alone. The site's
// settings are only written when there are none yet, so a second run never undoes the owner's
// look or name.

/** "Čtyřicet let pase ovce…" → "ctyricet-let-pase-ovce": an address from a headline, cut at a whole word. */
const slugOf = (text: string): string => {
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return plain.length <= 60 ? plain : plain.slice(0, 60).replace(/-[^-]*$/, '')
}

/** A day of the demo as the admin stores a date without a time: midnight in Europe/Prague. */
function pragueDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  for (const offset of [1, 2]) {
    const at = new Date(Date.UTC(y, m - 1, d, -offset))
    const hour = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: 'numeric', hourCycle: 'h23' }).format(at)
    if (Number(hour) === 0) return at.toISOString()
  }
  return new Date(Date.UTC(y, m - 1, d)).toISOString()
}

export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it. Both looks' home pages hold the same sections in the same order.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)
  const { doc, p, h2 } = s.rich
  const body = (paragraphs: string[]) => doc(...paragraphs.map((t) => (t.startsWith('## ') ? h2(t.slice(3)) : p(t))))

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── the sections, the authors, the series ──
  const section = {} as Record<string, string>
  for (const [position, x] of demo.sections.entries()) {
    section[x.key] = (await s.upsert(Section, { position, name: x.name, slug: slugOf(x.name), description: x.description }, { by: 'name' })).id
  }
  const author = {} as Record<string, string>
  for (const [position, x] of demo.authors.entries()) {
    author[x.key] = (await s.upsert(Author, { position, name: x.name, slug: slugOf(x.name), role: x.role, bio: x.bio, photo: photo[x.photo] }, { by: 'name' })).id
  }
  const series = await s.upsert(Series, {
    position: 0, name: demo.series.name, slug: slugOf(demo.series.name), description: demo.series.description, image: photo.samota,
    plannedParts: demo.series.plannedParts, byMonth: true, nextDate: pragueDay(demo.series.nextDate),
  }, { by: 'name' })

  // ── the articles ──
  for (const a of demo.articles) {
    await s.upsert(Article, {
      title: a.title, shortTitle: a.shortTitle ?? null, slug: slugOf(a.title), status: 'published', kind: a.kind ?? 'article', perex: a.perex, body: body(a.body),
      image: a.photo ? photo[a.photo] : null,
      imageCaption: a.photo ? demo.captions[a.photo] ?? null : null, imageCredit: a.photo ? demo.photoCredit : null,
      author: author[a.author]!, section: section[a.section]!, publishedAt: pragueDay(a.date), readingMinutes: a.minutes,
      lead: a.lead ?? false, pick: a.pick ?? false, brief: a.brief ?? false, mostReadRank: a.mostRead ?? null,
      series: null, seriesPart: null,
    }, { by: 'title' })
  }
  // The parts of the series are by the same author, in the section Krajina; the tenth is the third most read.
  for (const part of demo.parts) {
    await s.upsert(Article, {
      title: part.title, shortTitle: null, slug: slugOf(part.title), status: 'published', kind: 'article', perex: part.perex, body: body(part.body),
      image: null, imageCaption: null, imageCredit: null,
      author: author.tomas!, section: section.krajina!, publishedAt: pragueDay(part.date), readingMinutes: part.minutes,
      lead: false, pick: false, brief: false, mostReadRank: part.n === 10 ? 3 : null,
      series: series.id, seriesPart: part.n,
    }, { by: 'title' })
  }

  // ── the pages: the front page, the list of all articles, the search, the privacy policy ──
  const to = (anchor: keyof typeof words.anchors) => `/#${words.anchors[anchor]}`
  const home = demo.home
  await s.upsert(Page, {
    title: home.title, slug: 'home', status: 'published', ogImage: photo.pastevec, metaDescription: demo.settings.metaDescription,
    sections: [
      { type: 'front', ...home.front },
      { type: 'picks', ...home.picks, linkUrl: '/clanky' },
      { type: 'list', ...home.list, scope: 'rest', count: 6 },
      { type: 'series', ...home.series },
      { type: 'sections', ...home.sections },
      { type: 'newsletter', ...home.newsletter, consentUrl: '/ochrana-osobnich-udaju' },
      { type: 'authors', ...home.authors },
      { type: 'about', ...home.about, supportUrl: to('newsletter') },
    ],
  })
  await s.upsert(Page, {
    title: demo.archive.title, slug: 'clanky', status: 'published',
    sections: [{ type: 'list', heading: demo.archive.heading, text: demo.archive.text, scope: 'all', count: 100, links: [] }],
  })
  await s.upsert(Page, {
    title: demo.search.title, slug: 'hledat', status: 'published',
    sections: [{ type: 'search', heading: demo.search.heading, text: demo.search.text }],
  })
  const privacy = await s.upsert(Page, {
    title: demo.privacy.title, slug: 'ochrana-osobnich-udaju', status: 'published',
    sections: [{ type: 'text', heading: demo.privacy.heading, body: body(demo.privacy.paragraphs) }],
  })

  // ── the menus: the sections, the series; the privacy policy in the footer ──
  await s.global(Navigation, {
    main: [
      ...demo.sections.map((x) => s.link(x.name, `/rubrika/${slugOf(x.name)}`)),
      s.link(demo.menu.series, to('series')),
    ],
    legal: [s.link(demo.menu.privacy, privacy)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('newsletter'),
    aboutUrl: to('about'),
    ogImage: photo.pastevec,
  }, { ifMissing: true })
})
