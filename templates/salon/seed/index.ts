import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Navigation, Page, Person, Result, Review, Service, ServiceGroup, SiteSettings } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Salon template: the fictional Salon Pěšinka, a hairdresser and barber
// in Jičín, with a price list of 25 services in five groups and a team of four. One set of
// content for all three looks, worded as the design of the look the site is made in, and a home
// page with that design's sections in that design's order (texts/cs.ts holds every text of it).
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name (pages by their address), a
// file by its name, and what is already as written here is left alone. The site's settings
// are only written when there are none yet, so a second run never undoes the owner's look or name.

export default defineSeed(async (s) => {
  const { doc, p, h2 } = s.rich
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── the price list: groups, then their services ──
  const group: string[] = []
  for (const [position, name] of demo.groups.entries()) group.push((await s.upsert(ServiceGroup, { position, name }, { by: 'name' })).id)
  const service: Record<string, string> = {}
  for (const [position, item] of demo.services.entries()) {
    const quick = !!item.quickLabel
    service[item.name] = (await s.upsert(Service, {
      position, name: item.name, group: group[item.group]!, minutes: item.minutes, price: item.price,
      priceFrom: item.priceFrom ?? false, note: item.note ?? null, quick, quickLabel: item.quickLabel ?? null,
    }, { by: 'name' })).id
  }

  // ── the team ──
  const portrait: Record<string, string> = {
    'Radka Vejvodová': photo.radka, 'Simona Hájková': photo.simona, 'Tomáš Kubát': photo.tomas, 'Eliška Nová': photo.eliska,
  }
  const person: Record<string, string> = {}
  for (const [position, item] of demo.team.entries()) {
    const [mon, tue, wed, thu, fri, sat] = item.days.map(Boolean)
    person[item.name] = (await s.upsert(Person, { position, name: item.name, photo: portrait[item.name]!, role: item.role, bio: item.bio, bookLabel: item.bookLabel ?? null, mon, tue, wed, thu, fri, sat }, { by: 'name' })).id
  }

  // ── what left the chairs (in the order of the design), and what customers said ──
  for (const [position, item] of demo.results.entries()) {
    await s.upsert(Result, { position, title: item.title, photo: photo[item.photo], person: person[item.by]!, service: service[item.service]!, facts: item.facts ?? null }, { by: 'title' })
  }
  for (const [position, item] of demo.reviews.entries()) await s.upsert(Review, { position, ...item }, { by: 'name' })

  // ── the text page of the footer ──
  const privacy = await s.upsert(Page, {
    title: demo.privacy.title, slug: demo.privacy.slug, status: 'published',
    sections: [{
      type: 'text', heading: demo.privacy.heading,
      body: doc(p(demo.privacy.intro), ...demo.privacy.sections.flatMap((x) => [h2(x.heading), p(x.text)])),
    }],
  })

  // ── the one page: every section is a block, reached from the menu by its anchor. The sections
  //    are those of the look's design, in its order. ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const block = {
    opening: () => ({ type: 'opening' as const, ...demo.opening, image: photo.hero, image2: photo.bob, primaryUrl: to('booking'), secondaryUrl: to('pricelist') }),
    pricelist: () => ({ type: 'pricelist' as const, ...demo.pricelist }),
    team: () => ({ type: 'team' as const, ...demo.teamBlock }),
    results: () => ({ type: 'results' as const, ...demo.resultsBlock }),
    firstVisit: () => ({ type: 'firstVisit' as const, ...demo.firstVisit }),
    reviews: () => ({ type: 'reviews' as const, ...demo.reviewsBlock }),
    booking: () => ({ type: 'booking' as const, ...demo.booking }),
    visit: () => ({ type: 'visit' as const, ...demo.visit, image: photo.dum }),
    brands: () => ({
      type: 'brands' as const, ...demo.brands, names: demo.brands.names.map((name) => ({ name })), image: photo.detail,
      amounts: demo.brands.amounts.map((amount) => ({ amount })), voucherUrl: `mailto:${demo.settings.email}`,
    }),
  }
  await s.upsert(Page, {
    title: 'Úvod', slug: 'home', status: 'published', ogImage: photo.hero,
    metaTitle: demo.settings.metaTitle, metaDescription: demo.settings.metaDescription,
    sections: demo.home.map((name) => block[name]()),
  })

  // ── the menu: the sections of the page, and the footer's text page ──
  await s.global(Navigation, {
    main: demo.menuSections.map((name) => s.link(demo.menu[name]!, to(name))),
    legal: [s.link(demo.menu.privacy!, privacy)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ogImage: photo.hero,
  }, { ifMissing: true })
})
