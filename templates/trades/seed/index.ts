import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Job, Navigation, Page, Review, Service, SiteSettings, Town } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Trades template: the fictional plumber and heating engineer Ondřej
// Jirsák and his crew in Nová Paka. One set of content for both looks; every text of it is in
// texts/cs.ts.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3422 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name (pages by their address), a
// file by its name, and what is already as written here is left alone. The site's settings
// are only written when there are none yet, so a second run never undoes the owner's look or name.

export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)
  const { doc, p, h2, ul } = s.rich

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── the price list, the jobs, the reviews, the towns ──
  for (const [position, item] of demo.prices.items.entries()) {
    await s.upsert(Service, { position, text: item.text, price: item.price, from: item.from ?? false, unit: item.unit ?? null, group: item.group, main: item.main ?? false, name: item.name }, { by: 'position' })
  }
  // The jobs and their photographs: a pair of before and after, or one photograph. (The last two
  // reuse photographs of the others: a radiator carried in, the copper pipes of the workshop.)
  const jobPhotos = [
    { before: photo.boilerBefore, after: photo.boilerAfter },
    { before: photo.bathBefore, after: photo.bathAfter },
    { photo: photo.floorHeating },
    { photo: photo.radiator },
    { photo: photo.attic },
    { photo: photo.crew },
    { photo: photo.workshop },
  ]
  for (const [position, item] of demo.jobs.items.entries()) {
    const pics = jobPhotos[position]!
    await s.upsert(Job, {
      position, ...item,
      photo: pics.photo ?? pics.after ?? null, before: pics.before ?? null, after: pics.after ?? null,
    }, { by: 'title' })
  }
  for (const [position, item] of demo.reviews.items.entries()) await s.upsert(Review, { position, ...item }, { by: 'name' })
  for (const [position, name] of demo.area.towns.entries()) await s.upsert(Town, { position, name, home: position === 0 }, { by: 'name' })

  // ── pages ──
  // A link to a page of this seed is a reference to it (what the admin's link picker stores), so
  // it follows the page when it is renamed.
  const privacy = await s.upsert(Page, {
    title: demo.privacy.title, slug: demo.privacy.slug, status: 'published',
    sections: [{
      type: 'text', heading: demo.privacy.title,
      body: doc(
        p(demo.privacy.intro),
        ...demo.privacy.sections.flatMap((section) => [h2(section.heading), section.items ? ul(...section.items) : p(section.text!)]),
      ),
    }],
  })

  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const enquiryBlock = {
    type: 'enquiry' as const, ...demo.enquiry,
  }
  const jobsBlock = { type: 'jobs' as const, eyebrow: demo.jobs.eyebrow, heading: demo.jobs.heading, text: demo.jobs.text, count: demo.jobs.count, all: false }
  // The home page has the sections of the look's design, in its order: Mistr's has the key
  // figures, Reflex's the photograph across the page.
  const { photo: _photo, ...openingText } = demo.opening
  const sections = {
    opening: { type: 'opening' as const, ...openingText, image: demo.opening.photo ? photo.portrait : null, secondaryUrl: to('enquiry') },
    facts: { type: 'facts' as const, items: demo.facts },
    photo: { type: 'photo' as const, image: photo.hero, caption: demo.widePhotoCaption },
    prices: {
      type: 'prices' as const, eyebrow: demo.prices.eyebrow, heading: demo.prices.heading, text: demo.prices.text,
      includedTitle: demo.prices.includedTitle, included: demo.prices.included.map((text) => ({ text })), note: demo.prices.note,
      linkLabel: demo.prices.linkLabel, linkUrl: to('enquiry'), linkNote: demo.prices.linkNote,
    },
    jobs: jobsBlock,
    steps: { type: 'steps' as const, ...demo.steps },
    about: {
      type: 'about' as const, eyebrow: demo.about.eyebrow, heading: demo.about.heading, text: demo.about.text,
      photos: [{ image: photo.crew, caption: demo.about.crewCaption }, { image: photo.van, caption: '' }],
      ownerImage: demo.about.ownerPhoto ? photo.portrait : null,
      licencesTitle: demo.about.licencesTitle, licences: demo.about.licences.map((text) => ({ text })),
    },
    reviews: { type: 'reviews' as const, eyebrow: demo.reviews.eyebrow, heading: demo.reviews.heading, count: demo.reviews.count },
    area: { type: 'area' as const, eyebrow: demo.area.eyebrow, heading: demo.area.heading, text: demo.area.text, image: demo.area.photo ? photo.hero : null, note: demo.area.note },
    enquiry: enquiryBlock,
  }
  const order = look.id === 'reflex'
    ? ['opening', 'photo', 'prices', 'jobs', 'steps', 'about', 'reviews', 'area', 'enquiry'] as const
    : ['opening', 'facts', 'prices', 'jobs', 'steps', 'about', 'reviews', 'area', 'enquiry'] as const
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.hero,
    metaDescription: demo.settings.metaDescription,
    sections: order.map((key) => sections[key]),
  })
  // The page of all jobs: every job, and the enquiry under them.
  await s.upsert(Page, {
    title: demo.jobsPage.title, slug: demo.jobsPage.slug, status: 'published',
    sections: [{ ...jobsBlock, heading: demo.jobsPage.heading, text: demo.jobsPage.text, all: true }, enquiryBlock],
  })

  // ── the menu: the sections of the page ──
  await s.global(Navigation, {
    main: [
      s.link(demo.menu.prices, to('prices')), s.link(demo.menu.jobs, to('jobs')), s.link(demo.menu.steps, to('steps')),
      s.link(demo.menu.about, to('about')), s.link(demo.menu.area, to('area')),
    ],
    legal: [s.link(demo.legalLink, privacy)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('enquiry'),
    ogImage: photo.hero,
  }, { ifMissing: true })
})
