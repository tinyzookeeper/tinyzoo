import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Navigation, News, Page, Person, Product, Range, Service, SiteSettings } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Shop template: the fictional household-goods and hardware shop
// U Dvou klíčů in Chrudim. One set of content for all three looks, worded as the design of the
// look the site is made in (texts/cs.ts holds every text of it).
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
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)
  const { doc, p, h2, ul } = s.rich

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── the departments, the products, the services, the news, the people ──
  for (const [position, r] of demo.ranges.items.entries()) await s.upsert(Range, { position, ...r, image: photo[r.image] }, { by: 'name' })
  for (const [position, item] of demo.picks.items.entries()) {
    await s.upsert(Product, { position, ...item, image: photo[item.image], holdLabel: item.holdLabel || null, showUntil: null }, { by: 'name' })
  }
  for (const [position, item] of demo.services.items.entries()) await s.upsert(Service, { position, ...item }, { by: 'name' })
  for (const item of demo.news.items) await s.upsert(News, item, { by: 'title' })
  for (const [position, item] of demo.people.items.entries()) await s.upsert(Person, { position, ...item, image: photo[item.image] }, { by: 'name' })

  // ── the pages: the home page (every section is a block, reached from the menu by its anchor),
  //    all the news, and the privacy text ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.front,
    metaDescription: demo.settings.metaDescription,
    sections: [
      {
        type: 'intro', eyebrow: demo.intro.eyebrow, heading: demo.intro.heading, text: demo.intro.text, image: photo.interior,
        primaryLabel: demo.intro.primaryLabel, primaryUrl: demo.intro.primaryUrl,
        secondaryLabel: demo.intro.secondaryLabel, secondaryUrl: demo.intro.secondaryUrl, phoneNote: demo.intro.phoneNote,
      },
      { type: 'ranges', eyebrow: demo.ranges.eyebrow, heading: demo.ranges.heading, text: demo.ranges.text },
      {
        type: 'picks', eyebrow: demo.picks.eyebrow, heading: demo.picks.heading, text: demo.picks.text, count: demo.picks.count,
        emptyTitle: demo.picks.emptyTitle, emptyText: demo.picks.emptyText,
      },
      { type: 'services', eyebrow: demo.services.eyebrow, heading: demo.services.heading, text: demo.services.text, image: photo.counter },
      {
        type: 'news', eyebrow: demo.news.eyebrow, heading: demo.news.heading, count: demo.news.count,
        moreLabel: demo.news.moreLabel, moreUrl: '/novinky',
      },
      {
        type: 'people', eyebrow: demo.people.eyebrow, heading: demo.people.heading, text: demo.people.text, quote: demo.people.quote,
        shopImage: photo.interior, shopTitle: demo.people.shopTitle, shopRail: demo.people.shopRail, shopText: demo.people.shopText,
      },
      {
        type: 'ask', eyebrow: demo.ask.eyebrow, heading: demo.ask.heading, text: demo.ask.text, formHeading: demo.ask.formHeading, formText: demo.ask.formText,
        voucherLabel: demo.ask.voucherLabel, voucherValues: demo.ask.voucherValues, voucherValidity: demo.ask.voucherValidity, voucherText: demo.ask.voucherText,
      },
      { type: 'where', eyebrow: demo.where.eyebrow, heading: demo.where.heading, image: photo.front, ways: demo.where.ways, landmark: demo.where.landmark, walk: demo.where.walk, parking: demo.where.parking, parkingDistance: demo.where.parkingDistance, across: demo.where.across, opposite: demo.where.opposite, sideStreet: demo.where.sideStreet },
    ],
  })
  await s.upsert(Page, {
    title: demo.newsPage.title, slug: 'novinky', status: 'published',
    sections: [{ type: 'news', eyebrow: '', heading: demo.newsPage.heading, count: 0, moreLabel: '', moreUrl: null }],
  })
  const privacy = await s.upsert(Page, {
    title: demo.privacy.title, slug: 'ochrana-osobnich-udaju', status: 'published',
    sections: [{
      type: 'text', heading: demo.privacy.title,
      body: doc(
        p(demo.privacyBody.intro),
        h2(demo.privacyBody.h1), p(demo.privacyBody.p1),
        h2(demo.privacyBody.h2), ul(...demo.privacyBody.items),
        h2(demo.privacyBody.h3), p(demo.privacyBody.p3),
      ),
    }],
  })

  // ── the menus: the sections of the page (a link left empty in a design is not made) ──
  const sections = ['ranges', 'picks', 'services', 'news', 'people', 'ask', 'where'] as const
  await s.global(Navigation, {
    main: sections.filter((k) => demo.menu[k]).map((k) => s.link(demo.menu[k], to(k))),
    footer: (['ranges', 'services', 'news'] as const).map((k) => s.link(demo.footerMenu[k], to(k))),
    legal: [s.link(demo.privacy.title, privacy)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    hours: demo.hours,
    ctaUrl: to('ask'),
    ogImage: photo.front,
  }, { ifMissing: true })
})
