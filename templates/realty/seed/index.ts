import { defineSeed } from 'tinyzoo'
import { demoFor, gallery, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Agent, Area, Listing, Navigation, Page, Sale, SiteSettings } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Realty template: the fictional agency Práh from Písek, three agents
// and seven properties. One content model for all three looks, worded as the design of the look
// the site is made in (texts/cs.ts holds every text of it), and the home page has the sections
// that design has, in its order.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name (pages by their address), a
// file by its name, and what is already as written here is left alone. The site's settings
// are only written when there are none yet, so a second run never undoes the owner's look or name.

/** "Byt 2+1 v cihlovém domě" → "byt-2-1-v-cihlovem-dome" */
const slugOf = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default defineSeed(async (s) => {
  const { doc, p, h2 } = s.rich
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── the agents, the properties, what was sold, where we work ──
  const agent: Record<string, string> = {}
  for (const [position, a] of demo.agents.items.entries()) {
    const { key, ...data } = a
    agent[key] = (await s.upsert(Agent, { position, photo: photo[key as 'martina' | 'tomas' | 'lenka'], ...data }, { by: 'name' })).id
  }
  for (const [position, l] of demo.listings.items.entries()) {
    const { agent: who, photos, ...data } = l
    await s.upsert(Listing, {
      position, status: 'published', slug: slugOf(l.title), ...data,
      shortLine: l.shortLine || null, priceUnit: l.priceUnit || null, priceNote: l.priceNote || null, layout: l.layout || null, district: l.district || null, street: l.street || null,
      storeys: l.storeys || null, energyClass: l.energyClass || null, parking: l.parking || null, viewings: l.viewings || null,
      extras: l.extras.map((e) => ({ ...e })),
      photos: gallery(...photos.map((k) => photo[k as keyof typeof photo])),
      agent: agent[who],
    }, { by: 'title' })
  }
  for (const [position, sale] of demo.sold.items.entries()) await s.upsert(Sale, { position, ...sale }, { by: 'client' })
  for (const [position, area] of demo.areas.items.entries()) await s.upsert(Area, { position, ...area, count: area.onRequest ? null : area.count }, { by: 'name' })

  // ── pages: every section of a page is a block, reached from the menu by its anchor ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const block = {
    opening: () => ({
      type: 'opening' as const, ...demo.opening, image: photo.town,
      primaryUrl: '/nabidka', secondaryUrl: to('sellers'),
      quickLinks: demo.opening.quickLinks,
    }),
    listings: (limit: number) => {
      const { items: _items, ...texts } = demo.listings
      return { type: 'listings' as const, ...texts, limit, watchdog: true }
    },
    detail: () => ({ type: 'detail' as const, ...demo.detail }),
    sellers: () => ({ type: 'sellers' as const, ...demo.sellers }),
    sold: () => ({ type: 'sold' as const, eyebrow: demo.sold.eyebrow, heading: demo.sold.heading, text: demo.sold.text }),
    agents: () => ({ type: 'agents' as const, eyebrow: demo.agents.eyebrow, heading: demo.agents.heading, text: demo.agents.text }),
    areas: () => ({ type: 'areas' as const, eyebrow: demo.areas.eyebrow, heading: demo.areas.heading, text: demo.areas.text, image: photo.town, towns: demo.areas.towns.map((t) => ({ labelX: null, labelY: null, anchor: 'start' as const, ...t })) }),
    contact: () => ({ type: 'contact' as const, eyebrow: demo.contact.eyebrow, heading: demo.contact.heading, text: demo.contact.text, viewings: demo.contact.viewings, topics: demo.contact.topics.map((name) => ({ name })) }),
  }
  // The design's own order of the sections.
  const ORDER: Record<string, Array<keyof typeof block>> = {
    katastr: ['opening', 'listings', 'detail', 'sellers', 'sold', 'agents', 'areas', 'contact'],
    cedule: ['opening', 'listings', 'detail', 'sold', 'sellers', 'agents', 'areas', 'contact'],
    rozsviceno: ['opening', 'listings', 'agents', 'detail', 'sellers', 'sold', 'areas', 'contact'],
  }
  const sections = ORDER[look.id]!.map((name) => (name === 'listings' ? block.listings(7) : block[name]()))
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.town,
    metaDescription: demo.settings.metaDescription,
    sections,
  })
  // The whole offer on a page of its own: every property, the filter, the box that watches the offer.
  await s.upsert(Page, {
    title: demo.offerPage.title, slug: 'nabidka', status: 'published', ogImage: photo.town,
    sections: [block.listings(0)],
  })
  const legalPage = (key: 'privacy' | 'consumer', slug: string) => s.upsert(Page, {
    title: demo.legal[key].title, slug, status: 'published',
    sections: [{
      type: 'text', heading: demo.legal[key].title,
      body: doc(
        p(demo.legal[key].intro),
        ...demo.legal[key].parts.flatMap((part) => [h2(part.heading), p(part.text)]),
      ),
    }],
  })
  const privacy = await legalPage('privacy', 'ochrana-osobnich-udaju')
  const consumer = await legalPage('consumer', 'informace-pro-spotrebitele')

  // ── menus ──
  const page = { privacy, consumer }
  await s.global(Navigation, {
    main: demo.menu.main.map((l) => s.link(l.label, to(l.to as keyof typeof words.anchors))),
    offer: demo.menu.offer.map((l) => s.link(l.label, l.url)),
    legal: demo.legal.menu.map((l) => s.link(l.label, 'hash' in l ? `${words.privacyUrl}#${l.hash}` : page[l.to as keyof typeof page])),
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('valuation'),
    ogImage: photo.town,
  }, { ifMissing: true })
})
