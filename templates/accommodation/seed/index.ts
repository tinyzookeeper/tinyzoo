import { defineSeed } from 'tinyzoo'
import { demoFor, gallery, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Feature, Navigation, Page, Review, Room, RoomPrice, Season, SiteSettings, Trip } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Accommodation template: the fictional guesthouse Vřesovka in the
// Orlické hory. One set of content for both looks, worded as the design of the look the site
// is made in, and with that design's sections on the home page in its order (texts/cs.ts holds
// every text of it).
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment; SEED_LOOK names the look); by hand:
//
//   SEED_LOOK=ode-dveri SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name (rooms and pages by their
// address, the house's features by their place in the list, since a look words them
// differently), a file by its name, and what is already as written here is left alone. The
// site's settings are only written when there are none yet, so a second run never undoes the
// owner's look or name.


export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)
  const { doc, p, ul } = s.rich

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)
  const pic = (key: string): string => photo[key as keyof typeof photo]

  // ── seasons, rooms and their prices ──
  const season: Record<string, string> = {}
  for (const [position, [key, item]] of Object.entries(demo.seasons).entries()) {
    season[key] = (await s.upsert(Season, {
      position, name: item.name, shortName: item.shortName || null, tone: item.tone, minNights: item.minNights,
      ranges: item.ranges.map((r) => ({ from: r.from, to: r.to, label: r.label })),
    }, { by: 'name' })).id
  }
  const room: Record<string, string> = {}
  for (const [position, [key, item]] of Object.entries(demo.roomItems).entries()) {
    room[key] = (await s.upsert(Room, {
      position, slug: key, name: item.name, kind: item.kind, floor: item.floor, beds: item.beds, area: item.area,
      summary: item.summary, description: item.description, equipment: item.equipment.map((text) => ({ text })),
      // (the card counts the photographs: the room's own, then the house's and the countryside's)
      gallery: gallery(pic(item.photo), ...item.more.map(pic)),
    })).id
    for (const [seasonKey, amount] of Object.entries(item.prices)) {
      const seasonName = demo.seasons[seasonKey as keyof typeof demo.seasons].name
      await s.upsert(RoomPrice, { label: `${item.name} · ${seasonName}`, room: room[key]!, season: season[seasonKey]!, amount }, { by: 'label' })
    }
  }

  // ── what the house offers, the trips, the reviews ──
  for (const [position, f] of demo.features.entries()) await s.upsert(Feature, { position, name: f.name, text: f.text, where: f.where || null }, { by: 'position' })
  for (const [position, t] of Object.values(demo.tripItems).entries()) {
    await s.upsert(Trip, {
      position, name: t.name, distance: t.distance, text: t.text,
      spring: t.seasons.includes('spring'), summer: t.seasons.includes('summer'), autumn: t.seasons.includes('autumn'), winter: t.seasons.includes('winter'),
      fromMonth: (t.fromMonth || null) as never, toMonth: (t.toMonth || null) as never, tag: t.tag || null,
    }, { by: 'name' })
  }
  for (const [position, r] of demo.reviewItems.entries()) {
    await s.upsert(Review, { position, name: r.name, town: r.town, stayed: r.stayed, room: room[r.room]!, text: r.text }, { by: 'name' })
  }

  // ── the pages of documents and the whole gallery ──
  const text = (page: { title: string; lead: string; points: string[] }) => ({
    title: page.title, status: 'published' as const,
    sections: [{ type: 'text' as const, heading: page.title, body: doc(p(page.lead), ul(...page.points)) }],
  })
  const rules = await s.upsert(Page, { slug: 'ubytovaci-rad', ...text(demo.pages.rules) })
  const cancellation = await s.upsert(Page, { slug: 'storno-podminky', ...text(demo.pages.cancellation) })
  const privacy = await s.upsert(Page, { slug: 'ochrana-osobnich-udaju', ...text(demo.pages.privacy) })
  await s.upsert(Page, {
    slug: 'galerie', title: demo.pages.gallery.title, status: 'published',
    sections: [{
      type: 'gallery', heading: demo.gallery.pageHeading, moreLabel: '', moreUrl: null, moreCount: null,
      photos: Object.values(photo).map((image) => ({ image, caption: '' })),
    }],
  })

  // ── the home page: the sections of the look's design, in its order ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const blocks = {
    opening: {
      type: 'opening', eyebrow: demo.opening.eyebrow, heading: demo.opening.heading, text: demo.opening.text,
      distances: demo.opening.distances, image: pic(demo.opening.image), secondImage: demo.opening.secondImage ? pic(demo.opening.secondImage) : null,
      quickButton: demo.opening.quickButton, quickNote: demo.opening.quickNote,
    },
    year: { type: 'year', heading: demo.year.heading, text: demo.year.text },
    rooms: { type: 'rooms', heading: demo.rooms.heading, text: demo.rooms.text },
    prices: {
      type: 'prices', heading: demo.prices.heading, text: demo.prices.text,
      includedHeading: demo.prices.includedHeading, included: demo.prices.included,
      extrasHeading: demo.prices.extrasHeading, extras: demo.prices.extras,
      notesHeading: demo.prices.notesHeading, notes: demo.prices.notes,
    },
    house: { type: 'house', heading: demo.house.heading, text: demo.house.text, image: pic(demo.house.image), imageCaption: demo.house.imageCaption },
    trips: { type: 'trips', heading: demo.trips.heading, photos: demo.trips.photos.map((x) => ({ image: pic(x.image), caption: x.caption })) },
    reviews: { type: 'reviews', heading: demo.reviews.heading },
    gallery: {
      type: 'gallery', heading: demo.gallery.heading, photos: demo.gallery.photos.map((x) => ({ image: pic(x.image), caption: x.caption })),
      moreLabel: demo.gallery.moreLabel, moreUrl: '/galerie', moreCount: demo.gallery.moreCount,
    },
    hosts: {
      type: 'hosts', eyebrow: demo.hosts.eyebrow, heading: demo.hosts.heading, lead: demo.hosts.lead, text: demo.hosts.text,
      image: photo.hostitele, ctaLabel: demo.hosts.ctaLabel, ctaUrl: to('enquiry'),
    },
    directions: {
      type: 'directions', heading: demo.directions.heading, placeLabel: demo.directions.placeLabel, facts: demo.directions.facts,
      carHeading: demo.directions.carHeading, carRoutes: demo.directions.carRoutes, carNote: demo.directions.carNote,
      trainHeading: demo.directions.trainHeading, trainSteps: demo.directions.trainSteps, trainNote: demo.directions.trainNote,
    },
    enquiry: {
      type: 'enquiry', heading: demo.enquiry.heading, text: demo.enquiry.text, steps: demo.enquiry.steps, callLabel: demo.enquiry.callLabel,
      adviceLabel: demo.enquiry.adviceLabel, moreRooms: demo.enquiry.moreRooms, consentUrl: `/${privacy.data.slug}`,
    },
  }
  const ORDER: Record<string, Array<keyof typeof blocks>> = {
    'cely-rok': ['opening', 'year', 'rooms', 'prices', 'house', 'trips', 'reviews', 'gallery', 'hosts', 'directions', 'enquiry'],
    'ode-dveri': ['opening', 'rooms', 'house', 'prices', 'trips', 'reviews', 'gallery', 'hosts', 'directions', 'enquiry'],
  }
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.dum,
    metaDescription: demo.settings.metaDescription,
    sections: (ORDER[look.id] ?? ORDER[looks.ids[0]]!).map((key) => blocks[key]) as never,
  })

  // ── the menu: the sections of the page; and the documents in the footer ──
  const MENU: Record<string, Array<keyof typeof demo.menu>> = {
    'cely-rok': ['rooms', 'prices', 'trips', 'hosts', 'directions'],
    'ode-dveri': ['rooms', 'house', 'prices', 'trips', 'directions'],
  }
  const ANCHOR: Record<keyof typeof demo.menu, keyof typeof words.anchors> = { rooms: 'rooms', house: 'house', prices: 'prices', trips: 'trips', hosts: 'hosts', directions: 'directions' }
  await s.global(Navigation, {
    main: (MENU[look.id] ?? MENU[looks.ids[0]]!).map((key) => s.link(demo.menu[key], to(ANCHOR[key]))),
    legal: [s.link(demo.legal.rules, rules), s.link(demo.legal.cancellation, cancellation), s.link(demo.legal.privacy, privacy)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('enquiry'),
    ogImage: photo.dum,
  }, { ifMissing: true })
})
