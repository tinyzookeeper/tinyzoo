import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Extra, Navigation, Page, Review, SeasonalOffer, Service, ServiceGroup, SiteSettings, TeamMember } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Garage template: the fictional Autoservis U Vlečky in Jičín, a garage
// behind the railway siding with three mechanics, two lifts and a price list of 37 lines in six
// groups. One set of content for all three looks, worded as the design of the look the site is
// made in, and a home page with that design's sections in that design's order (texts/cs.ts holds
// every text of it).
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name (pages by their address), a
// file by its name, and what is already as written here is left alone. The site's settings
// are only written when there are none yet, so a second run never undoes the owner's look or name.

// ── days: the seasonal offer and the free dates are written from the day the seed runs, so the
//    demo always shows a season in progress and free days ahead ──
const ZONE = 'Europe/Prague'
const dayText = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const clockText = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
const plusDays = (day: string, n: number) => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) + n * 86_400_000).toISOString().slice(0, 10)
const weekday = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7
/** The moment a day starts at in the site's zone, as the admin stores an all-day date. */
function midnight(day: string): string {
  const base = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))
  for (const hours of [1, 2]) {
    const at = new Date(base - hours * 3_600_000)
    if (dayText(at) === day && clockText(at) === '00:00') return at.toISOString()
  }
  return new Date(base).toISOString()
}
/** The next working day on or after a day. */
const working = (day: string): string => (weekday(day) >= 5 ? working(plusDays(day, 1)) : day)
const slugOf = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default defineSeed(async (s) => {
  const { doc, p, h2 } = s.rich
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)
  type PhotoKey = keyof typeof photo

  // ── the price list: the groups, then the lines under them ──
  const group: Record<string, string> = {}
  for (const [position, g] of demo.groups.entries()) group[g.name] = (await s.upsert(ServiceGroup, { position, slug: slugOf(g.name), ...g }, { by: 'name' })).id
  for (const [position, [g, name, text, price, priceFrom, unit, duration]] of demo.services.entries()) {
    await s.upsert(Service, { position, group: group[g]!, name, text, price, priceFrom, unit, duration }, { by: 'name' })
  }

  // ── the seasonal offer: from the start of the season (or today) to the 11th of December ──
  const today = dayText(new Date())
  const year = +today.slice(0, 4) + (today > `${today.slice(0, 4)}-12-11` ? 1 : 0)
  const season = { from: `${year}-10-15` < today ? `${year}-10-15` : today, to: `${year}-12-11` }
  await s.upsert(SeasonalOffer, {
    position: 0, title: demo.season.title, text: demo.season.text, chip: demo.season.chip, image: photo.wheel,
    validFrom: midnight(season.from), validTo: midnight(season.to), prices: demo.season.prices,
    buttonLabel: demo.season.buttonLabel, buttonUrl: `/#${words.anchors.booking}`,
  }, { by: 'position' })

  // ── the people, what customers said, what comes with a repair ──
  for (const [position, m] of demo.team.people.entries()) await s.upsert(TeamMember, { position, name: m.name, role: m.role, years: m.years, text: m.text, photo: photo[m.photo as PhotoKey] }, { by: 'name' })
  for (const [position, r] of demo.reviews.items.entries()) await s.upsert(Review, { position, ...r }, { by: 'name' })
  for (const [position, x] of demo.extras.items.entries()) await s.upsert(Extra, { position, name: x.name, price: x.price, unit: x.unit, text: x.text, image: photo[x.photo as PhotoKey] }, { by: 'name' })

  // ── the text page of the footer ──
  const privacy = await s.upsert(Page, {
    title: demo.privacy.title, slug: demo.privacy.slug, status: 'published',
    sections: [{ type: 'text', heading: demo.privacy.heading, body: doc(p(demo.privacy.intro), ...demo.privacy.sections.flatMap((x) => [h2(x.heading), p(x.text)])) }],
  })

  // ── the one page: every section is a block, reached from the menu by its anchor. The sections
  //    are those of the look's design, in its order. ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const block = {
    hero: () => ({
      type: 'hero' as const, eyebrow: demo.hero.eyebrow, heading: demo.hero.heading, text: demo.hero.text,
      image: photo.hero, dashImage: photo.dusk, chestImage: photo.bonnet,
      primaryLabel: demo.hero.primaryLabel, primaryUrl: to('booking'), secondaryLabel: demo.hero.secondaryLabel, secondaryUrl: to('prices'),
    }),
    facts: () => ({ type: 'facts' as const, items: demo.facts.items }),
    lamps: () => ({ type: 'lamps' as const, heading: demo.lamps.heading, text: demo.lamps.text }),
    season: () => ({ type: 'season' as const }),
    prices: () => ({ type: 'prices' as const, eyebrow: demo.prices.eyebrow, heading: demo.prices.heading, text: demo.prices.text, footnote: demo.prices.footnote }),
    workshop: () => ({ type: 'workshop' as const, photos: demo.workshop.photos.map((x) => ({ image: photo[x.photo as PhotoKey], lead: x.lead, text: x.text })) }),
    steps: () => ({ type: 'steps' as const, eyebrow: demo.steps.eyebrow, heading: demo.steps.heading, text: demo.steps.text, steps: demo.steps.steps }),
    makes: () => ({
      type: 'makes' as const, eyebrow: demo.makes.eyebrow, heading: demo.makes.heading, groups: demo.makes.groups,
      notHeading: demo.makes.notHeading, notText: demo.makes.notText, notDoing: demo.makes.notDoing,
    }),
    extras: () => ({ type: 'extras' as const, heading: demo.extras.heading }),
    team: () => ({ type: 'team' as const, eyebrow: demo.team.eyebrow, heading: demo.team.heading, text: demo.team.text }),
    reviews: () => ({ type: 'reviews' as const, eyebrow: demo.reviews.eyebrow, heading: demo.reviews.heading }),
    booking: () => ({ type: 'booking' as const, ...demo.booking }),
    where: () => ({ type: 'where' as const, ...demo.where, photo: photo.yard }),
  }
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.hero,
    metaDescription: demo.settings.metaDescription,
    sections: demo.sections.map((name) => block[name as keyof typeof block]()),
  })

  // ── the menus: the sections of the page, the links under it, the small print ──
  await s.global(Navigation, {
    main: demo.menu.main.map(([label, section]) => s.link(label, to(section))),
    footer: demo.menu.footer.map(([label, section]) => s.link(label, to(section))),
    legal: [s.link(demo.privacy.title, privacy)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  const tyres = working(plusDays(today, 1))
  const service = working(plusDays(today, 3))
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('booking'),
    nextService: midnight(service),
    nextTyres: midnight(tyres),
    ogImage: photo.hero,
  }, { ifMissing: true })
})
