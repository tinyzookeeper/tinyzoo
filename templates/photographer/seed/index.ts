import { defineSeed } from 'tinyzoo'
import { demoFor, gallery, refTo, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Album, Category, Navigation, Pack, Page, SiteSettings, Testimonial } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Photographer template: the fictional photographer Johana Loudová
// from Litomyšl. One set of content for all three looks, worded as the design of the look the
// site is made in (texts/cs.ts holds every text of it). All three designs run their sections in
// the same order, so one home page serves them; a look whose design ordered them otherwise would
// get its own list here.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_LOOK=negativ SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their address (or position), a file by
// its name, and what is already as written here is left alone. The site's settings are only
// written when there are none yet, so a second run never undoes the owner's look or name.

export default defineSeed(async (s) => {
  const { doc, p, h2, ul } = s.rich
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── categories, in the order of the tabs ──
  const category = async (position: number, slug: string, c: { name: string; description: string }) =>
    (await s.upsert(Category, { name: c.name, slug, description: c.description, position })).id
  const weddings = await category(0, 'svatby', demo.categories.weddings)
  const portraits = await category(1, 'portrety', demo.categories.portraits)
  const families = await category(2, 'rodina', demo.categories.families)
  const business = await category(3, 'firemni', demo.categories.business)

  // ── albums: newest first on the website ──
  const a = demo.albums
  const album = (data: { title: string; slug: string; category: string; date: string; place: string; summary?: string; cover: string; photos: ReturnType<typeof gallery> }) =>
    s.upsert(Album, { status: 'published', summary: null, ...data })
  // One photograph with the caption the look writes under it (none: the picture has no caption).
  const shot = (id: string, caption: string): string | [string, string] => (caption ? [id, caption] : id)

  const annaVojta = await album({
    title: a.annaVojta.title, slug: 'anna-a-vojta', category: weddings, date: a.annaVojta.date, place: a.annaVojta.place,
    summary: a.annaVojta.summary,
    cover: photo.weddingCouple,
    photos: gallery(...a.annaVojta.photos.map((p) => shot(photo[p.photo], p.caption))),
  })
  await album({ title: a.marketa.title, slug: 'marketa', category: portraits, date: a.marketa.date, place: a.marketa.place, cover: photo.portraitWoman, photos: gallery(photo.portraitWoman) })
  await album({ title: a.matyas.title, slug: 'matyas-dvanact-dni', category: families, date: a.matyas.date, place: a.matyas.place, cover: photo.familyNewborn, photos: gallery(photo.familyNewborn) })
  await album({ title: a.ceramics.title, slug: 'keramicka-dilna-hany-peskove', category: business, date: a.ceramics.date, place: a.ceramics.place, cover: photo.businessCraft, photos: gallery(photo.businessCraft) })
  await album({ title: a.kubatovi.title, slug: 'kubatovi-v-lese', category: families, date: a.kubatovi.date, place: a.kubatovi.place, cover: photo.familyWalk, photos: gallery(photo.familyWalk) })
  await album({ title: a.eliska.title, slug: 'eliska', category: portraits, date: a.eliska.date, place: a.eliska.place, cover: photo.portraitGirl, photos: gallery(photo.portraitGirl) })
  await album({ title: a.rings.title, slug: 'marketa-a-ondrej', category: weddings, date: a.rings.date, place: a.rings.place, cover: photo.weddingRings, photos: gallery(shot(photo.weddingRings, a.rings.caption)) })
  await album({ title: a.architect.title, slug: 'architektka-petra-dvorakova', category: business, date: a.architect.date, place: a.architect.place, cover: photo.businessPortrait, photos: gallery(photo.businessPortrait) })
  await album({ title: a.carpenter.title, slug: 'pan-josef-truhlar', category: portraits, date: a.carpenter.date, place: a.carpenter.place, cover: photo.portraitMan, photos: gallery(photo.portraitMan) })
  await album({ title: a.jana.title, slug: 'jana-a-tonik', category: families, date: a.jana.date, place: a.jana.place, cover: photo.familyHome, photos: gallery(photo.familyHome) })

  // ── packages ──
  // (found by their position, not their name, so a second run in another look's wording rewrites them)
  const pack = (position: number, price: number, data: { name: string; description: string; includes: string[]; highlightLabel?: string }, highlighted = false) =>
    s.upsert(Pack, {
      position, name: data.name, price, description: data.description,
      includes: data.includes.map((text) => ({ text })),
      highlighted, highlightLabel: data.highlightLabel ?? null,
    }, { by: 'position' })
  await pack(0, 3900, demo.packs.portrait)
  await pack(1, 19900, demo.packs.halfDay)
  await pack(2, 32900, demo.packs.fullDay, true)

  // ── testimonials: the first is shown largest ──
  const testimonial = (position: number, t: { name: string; occasion: string; text: string }) =>
    s.upsert(Testimonial, { position, ...t }, { by: 'position' })
  await testimonial(0, demo.testimonials.anna)
  await testimonial(1, demo.testimonials.marketa)
  await testimonial(2, demo.testimonials.kubatovi)

  // ── pages ──
  // A link to a page of this seed is a reference to it (what the admin's link picker stores), so
  // it follows the page when it is renamed.
  const enquiryBlock = (privacyUrl: string) => ({
    type: 'enquiry' as const,
    ...demo.enquiry,
    consentUrl: privacyUrl,
  })
  const stepsBlock = { type: 'steps' as const, ...demo.steps }
  const testimonialsBlock = { type: 'testimonials' as const, ...demo.testimonialsBlock, count: 3 }

  const legalPage = (slug: string, l: typeof demo.legal.privacy) => s.upsert(Page, {
    title: l.title, slug, status: 'published',
    sections: [{
      type: 'text', heading: l.title,
      body: doc(
        p(l.intro),
        ...l.parts.flatMap((part) => [h2(part.heading), part.list ? ul(...part.list) : p(part.text!)]),
      ),
    }],
  })
  const privacy = await legalPage('ochrana-osobnich-udaju', demo.legal.privacy)
  const terms = await legalPage('obchodni-podminky', demo.legal.terms)
  const contact = await s.upsert(Page, {
    title: demo.pages.contact.title, slug: 'kontakt', status: 'published',
    metaDescription: demo.pages.contact.metaDescription,
    sections: [enquiryBlock(refTo(s, privacy))],
  })

  const pricingBlock = {
    type: 'pricing' as const,
    ...demo.pricing,
    buttonUrl: refTo(s, contact),
    footnoteLinkUrl: refTo(s, contact),
  }
  const aboutBlock = {
    type: 'about' as const,
    eyebrow: demo.about.eyebrow,
    heading: demo.about.heading,
    image: photo.about,
    imageCaption: demo.about.imageCaption,
    text: demo.about.text.join('\n\n'),
    facts: demo.about.facts,
    signature: demo.about.signature,
  }

  const galleryPage = await s.upsert(Page, {
    title: demo.pages.gallery.title, slug: 'galerie', status: 'published',
    metaDescription: demo.pages.gallery.metaDescription,
    sections: [{ type: 'albums', eyebrow: demo.pages.gallery.eyebrow, heading: demo.pages.gallery.heading, text: demo.pages.gallery.text }],
  })
  const pricingPage = await s.upsert(Page, {
    title: demo.pages.pricing.title, slug: 'cenik', status: 'published',
    metaDescription: demo.pages.pricing.metaDescription,
    sections: [pricingBlock, stepsBlock, enquiryBlock(refTo(s, privacy))],
  })
  const aboutPage = await s.upsert(Page, {
    title: demo.pages.about.title, slug: 'o-mne', status: 'published',
    metaDescription: demo.pages.about.metaDescription,
    sections: [aboutBlock, testimonialsBlock, enquiryBlock(refTo(s, privacy))],
  })

  // Where a button of the home page leads, by the name the demo gives it.
  const to = (where: keyof typeof targets) => refTo(s, targets[where])
  const targets = { gallery: galleryPage, contact, pricing: pricingPage, about: aboutPage, album: annaVojta }

  const { hero, story } = demo.home
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.weddingMeadow,
    metaDescription: demo.home.metaDescription,
    sections: [
      {
        type: 'hero',
        eyebrow: hero.eyebrow,
        heading: hero.heading,
        text: hero.text,
        images: [photo.weddingMeadow, photo.familyHome, photo.portraitGirl].map((image, i) => ({ image, caption: hero.captions[i] ?? '' })),
        darkImage: photo.weddingDance,
        primaryLabel: hero.primaryLabel, primaryUrl: to(hero.primaryTo),
        secondaryLabel: hero.secondaryLabel, secondaryUrl: to(hero.secondaryTo),
      },
      {
        type: 'gallery',
        ...demo.home.gallery,
        count: 14,
        allUrl: to('gallery'),
      },
      {
        type: 'story',
        eyebrow: story.eyebrow,
        heading: story.heading,
        facts: story.facts,
        text: story.text,
        photos: story.photos.map((shot) => ({ image: photo[shot.photo], time: shot.time, caption: shot.caption })),
        closing: story.closing,
        buttonLabel: story.buttonLabel, buttonUrl: to('album'),
      },
      pricingBlock,
      aboutBlock,
      testimonialsBlock,
      stepsBlock,
      enquiryBlock(refTo(s, privacy)),
    ],
  })

  // ── menus ──
  const { main, footer } = demo.menu
  await s.global(Navigation, {
    main: [s.link(main.gallery, galleryPage), s.link(main.story, annaVojta), s.link(main.pricing, pricingPage), s.link(main.about, aboutPage)],
    footer: [s.link(footer.gallery, galleryPage), s.link(footer.pricing, pricingPage), s.link(footer.about, aboutPage), s.link(footer.contact, contact)],
    legal: [s.link(demo.legal.privacy.title, privacy), s.link(demo.legal.terms.title, terms)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: refTo(s, contact),
    ogImage: photo.weddingMeadow,
  }, { ifMissing: true })
})
