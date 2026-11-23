import { defineSeed } from 'tinyzoo'
import { uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Contact, Gift, Lodging, Navigation, Page, ProgramItem, Question, SiteSettings } from '../cms.config'
import { looks } from '../looks'
import { demo, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Wedding template: the fictional couple Anežka and Šimon, marrying
// on a farm in the Vysočina highlands. One set of content for all three looks; every text of
// it is in texts/cs.ts.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name (pages by their address), a
// file by its name, and what is already as written here is left alone. The site's settings
// are only written when there are none yet, so a second run never undoes the owner's look or names.

export default defineSeed(async (s) => {
  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── the programme, the places to stay, the gifts, the questions, the contacts ──
  for (const [position, item] of demo.programme.items.entries()) await s.upsert(ProgramItem, { position, ...item }, { by: 'title' })
  for (const [position, item] of demo.lodging.items.entries()) {
    // The last place is the meadow by the barn: its link leads to the reply form.
    await s.upsert(Lodging, { position, linkUrl: `/#${words.anchors.rsvp}`, ...item }, { by: 'name' })
  }
  for (const [position, item] of demo.gifts.items.entries()) {
    await s.upsert(Gift, {
      position, name: item.name, description: item.description, price: item.price ?? null,
      reserved: item.reserved ?? false, open: item.open ?? false,
      buttonLabel: item.buttonLabel ?? null, buttonUrl: item.open ? `mailto:${demo.settings.email}` : null,
    }, { by: 'name' })
  }
  for (const [position, item] of demo.questions.items.entries()) await s.upsert(Question, { position, ...item }, { by: 'question' })
  for (const [position, item] of demo.contacts.items.entries()) await s.upsert(Contact, { position, ...item }, { by: 'name' })

  // ── the one page: every section is a block, reached from the menu by its anchor ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.hero,
    metaDescription: demo.settings.metaDescription,
    sections: [
      {
        type: 'invitation', ...demo.invitation,
        image: photo.coupleClose, nightImage: photo.coupleEvening, coverImage: photo.coupleBarn,
        primaryUrl: to('rsvp'), secondaryUrl: to('programme'),
      },
      {
        type: 'story', eyebrow: demo.story.eyebrow, heading: demo.story.heading,
        parts: [
          { ...demo.story.parts[0]!, image: photo.coupleRocks },
          { ...demo.story.parts[1]!, image: photo.coupleBlanket },
        ],
        closing: demo.story.closing,
        wideImage: photo.hero, wideCaption: demo.story.wideCaption,
      },
      {
        // (no line above the heading: the day from Site settings stands there)
        type: 'programme', eyebrow: '', heading: demo.programme.heading, text: demo.programme.text,
        photos: [
          { image: photo.linden, ...demo.programme.photos[0]! },
          { image: photo.barn, ...demo.programme.photos[1]! },
        ],
      },
      {
        type: 'place', eyebrow: demo.place.eyebrow, heading: demo.place.heading, text: demo.place.text,
        photos: [
          { image: photo.venue, caption: '' },
          { image: photo.barn, caption: '' },
          { image: photo.linden, caption: demo.place.lindenCaption },
        ],
        notes: demo.place.notes.map((n) => ({ firstLabel: '', firstValue: '', secondLabel: '', secondValue: '', ...n })),
      },
      { type: 'lodging', eyebrow: demo.lodging.eyebrow, heading: demo.lodging.heading, text: demo.lodging.text },
      {
        type: 'rsvp', eyebrow: demo.rsvp.eyebrow, heading: demo.rsvp.heading, text: demo.rsvp.text,
        meals: demo.rsvp.meals.map((name) => ({ name })), busLabel: demo.rsvp.busLabel, image: photo.table,
      },
      {
        type: 'gifts', eyebrow: demo.gifts.eyebrow, heading: demo.gifts.heading, text: demo.gifts.text,
        image: photo.flowers, imageCaption: demo.gifts.imageCaption, openLabel: demo.gifts.openLabel,
      },
      { type: 'questions', eyebrow: demo.questions.eyebrow, heading: demo.questions.heading },
      { type: 'contacts', eyebrow: demo.contacts.eyebrow, heading: demo.contacts.heading, text: demo.contacts.text },
      {
        type: 'gallery', eyebrow: demo.gallery.eyebrow, heading: demo.gallery.heading, text: demo.gallery.text,
        // Every look leaves out what it shows elsewhere on the page and takes as many as it holds.
        photos: [photo.coupleAlley, photo.coupleDance, photo.coupleBarn, photo.hero, photo.landscape, photo.coupleClose, photo.coupleEvening, photo.table].map((image) => ({ image })),
      },
    ],
  })

  // ── the menu: the sections of the page ──
  await s.global(Navigation, {
    main: [
      s.link(demo.menu.story, to('story')), s.link(demo.menu.programme, to('programme')), s.link(demo.menu.place, to('place')),
      s.link(demo.menu.gifts, to('gifts')), s.link(demo.menu.questions, to('questions')),
    ],
    legal: [],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's names and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: looks.ids[0],
    colors: looks.all[0].presets[0].id,
    // Saturday 19 June 2027, 12.30, and Friday 30 April 2027 (all day), in Europe/Prague.
    date: '2027-06-19T10:30:00Z',
    rsvpDeadline: '2027-04-29T22:00:00Z',
    ctaUrl: to('rsvp'),
    footerImage: photo.landscape,
    ogImage: photo.hero,
  }, { ifMissing: true })
})
