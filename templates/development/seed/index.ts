import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Flat, Floor, Milestone, Navigation, Page, Place, Reference, SiteSettings, Standard } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, FLAT_DATA, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Development template: the fictional building Starý sad, fourteen flats
// on the site of an old orchard in Olomouc-Neředín. One set of content for all three looks, worded
// as the design of the look the site is made in (texts/cs.ts holds every text of it), with the
// page's sections in the order of that design.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_LOOK=patra SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: the flats are recognised by their number, the other lists by their
// place in the list, pages by their address, a file by its name, and what is already as written
// here is left alone. The site's settings are only written when there are none yet, so a second
// run never undoes the owner's look or names.

export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`

  // ── photographs and the two documents ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)
  const pricelist = await s.upload('seed/media/cenik.pdf', { alt: 'Ceník bytů' })
  const standardsFile = await s.upload('seed/media/standardy.pdf', { alt: 'Standardy' })

  // ── the flats, the floors, the standards, the places, the stages, the finished buildings ──
  for (const f of FLAT_DATA) {
    await s.upsert(Flat, {
      number: f.number, slug: f.number.replace('.', '-'), floor: f.floor, layout: f.layout, area: f.area,
      outdoorKind: f.outdoorKind, outdoorArea: f.outdoorArea, orientation: f.orientation, price: f.price, state: f.state,
      note: demo.flatNotes[f.number] ?? null,
    }, { by: 'number' })
  }
  for (const floor of demo.floors) await s.upsert(Floor, floor, { by: 'number' })
  for (const [position, item] of demo.standards.items.entries()) await s.upsert(Standard, { position, ...item }, { by: 'position' })
  for (const [position, item] of demo.surroundings.items.entries()) await s.upsert(Place, { position, ...item }, { by: 'position' })
  for (const [position, item] of demo.progress.items.entries()) await s.upsert(Milestone, { position, ...item }, { by: 'position' })
  for (const [position, item] of demo.developer.items.entries()) await s.upsert(Reference, { position, ...item }, { by: 'position' })

  // ── a text page, linked from the footer ──
  const { doc, p, h2, ul } = s.rich
  const privacy = await s.upsert(Page, {
    title: demo.privacy.title, slug: 'ochrana-osobnich-udaju', status: 'published',
    sections: [{
      type: 'text', heading: demo.privacy.title,
      body: doc(
        p(demo.privacy.intro),
        ...demo.privacy.parts.flatMap((part) => [h2(part.heading), 'items' in part && part.items ? ul(...part.items) : p(('text' in part && part.text) || '')]),
      ),
    }],
  })

  // ── the home page: the sections of the design, in its order ──
  const blocks: Record<string, Record<string, unknown>> = {
    opening: {
      type: 'opening', eyebrow: demo.opening.eyebrow, headline: demo.opening.headline, text: demo.opening.text,
      image: photo.street, imageCaption: demo.opening.imageCaption,
      primaryLabel: demo.opening.primaryLabel, primaryUrl: to(demo.opening.primaryTo as keyof typeof words.anchors),
      secondaryLabel: demo.opening.secondaryLabel, secondaryUrl: to(demo.opening.secondaryTo as keyof typeof words.anchors),
      facts: demo.opening.facts,
    },
    overview: { type: 'overview', ...demo.overview },
    pricelist: { type: 'pricelist', ...demo.pricelist },
    standards: {
      type: 'standards', eyebrow: demo.standards.eyebrow, heading: demo.standards.heading, text: demo.standards.text,
      photos: demo.standards.photos.map((p, i) => ({ image: [photo.livingRoom, photo.bathroom][i]!, caption: p.caption })),
    },
    surroundings: {
      type: 'surroundings', eyebrow: demo.surroundings.eyebrow, heading: demo.surroundings.heading, text: demo.surroundings.text, note: demo.surroundings.note,
      photos: demo.surroundings.photos.map((p, i) => ({ image: [photo.tram, photo.park][i]!, caption: p.caption })),
    },
    progress: {
      type: 'progress', eyebrow: demo.progress.eyebrow, heading: demo.progress.heading, text: demo.progress.text, percent: 58, percentLabel: demo.progress.percentLabel,
      photos: demo.progress.photos.map((p, i) => ({ image: [photo.crane, photo.garden][i]!, caption: p.caption })),
      status: demo.progress.status, facts: demo.progress.facts,
    },
    gallery: {
      type: 'gallery', eyebrow: demo.gallery.eyebrow, heading: demo.gallery.heading, text: demo.gallery.text, note: demo.gallery.note,
      photos: demo.gallery.order.map((key) => ({
        image: photo[({ garden: 'garden', detail: 'detail', bathroom: 'bathroom', terrace: 'terrace', windows: 'windows' } as const)[key as 'garden']],
        caption: demo.gallery.captions[key as keyof typeof demo.gallery.captions],
        kind: key === 'windows' ? 'photo' : 'render',
      })),
    },
    financing: { type: 'financing', ...demo.financing },
    developer: {
      type: 'developer', eyebrow: demo.developer.eyebrow, heading: demo.developer.heading, text: demo.developer.text, image: photo.reference,
      imageCaption: demo.developer.imageCaption, listLabel: demo.developer.listLabel, note: demo.developer.note,
    },
    enquiry: {
      type: 'enquiry', eyebrow: demo.enquiry.eyebrow, heading: demo.enquiry.heading, text: demo.enquiry.text,
      office: demo.enquiry.office, wants: demo.enquiry.wants.map((name) => ({ name })),
    },
  }
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.street,
    metaDescription: demo.settings.metaDescription,
    sections: demo.home.blocks.map((type) => blocks[type]!) as never,
  })

  // ── the menu: the sections of the page, in the order of the design ──
  await s.global(Navigation, {
    main: demo.menuOrder.map((key) => s.link(demo.menu[key as keyof typeof demo.menu], to(key as keyof typeof words.anchors))),
    legal: [s.link(demo.menu.privacy, privacy)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    // Handover 1 October 2027, occupancy approval 1 August 2027 and the state of 23 November 2026
    // (all-day dates, in Europe/Prague).
    completion: '2027-09-30T22:00:00Z',
    approval: '2027-07-31T22:00:00Z',
    asOf: '2026-11-22T23:00:00Z',
    ctaUrl: to('enquiry'),
    sellerPhoto: photo.seller,
    pricelistFile: pricelist,
    standardsFile,
    ogImage: photo.street,
  }, { ifMissing: true })
})
