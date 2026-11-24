import { defineSeed } from 'tinyzoo'
import { demoFor, refTo, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Insurer, Navigation, Notice, OpeningHour, Page, Service, SiteSettings, TeamMember } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Medical template: the fictional practice Ordinace U Lípy, general
// practitioners for adults in Jičín. One set of content for both looks; every text of it is in
// texts/cs.ts.
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

  // ── the hours, notices, services, team and insurers ──
  for (const [position, row] of shared.hours.items.entries()) await s.upsert(OpeningHour, { position, ...row }, { by: ['day', 'from'] })
  for (const [position, item] of demo.notices.items.entries()) {
    await s.upsert(Notice, { position, important: false, dateLine: null, badge: null, ...item }, { by: 'title' })
  }
  let position = 0
  for (const item of demo.services.covered) await s.upsert(Service, { position: position++, covered: true, ...item }, { by: 'name' })
  for (const item of demo.services.paid) await s.upsert(Service, { position: position++, covered: false, ...item }, { by: 'name' })
  const portraits = [photo.dvorakova, photo.beran, photo.markova, photo.sulcova]
  for (const [i, member] of demo.team.items.entries()) await s.upsert(TeamMember, { position: i, photo: portraits[i], ...member }, { by: 'name' })
  for (const [i, item] of demo.insurers.items.entries()) await s.upsert(Insurer, { position: i, ...item }, { by: 'short' })

  // ── the pages the footer links to ──
  const textPage = async (page: typeof demo.pages.privacy) => s.upsert(Page, {
    title: page.title, slug: page.slug, status: 'published',
    sections: [{
      type: 'text', heading: page.title,
      body: doc(
        p(page.intro),
        ...page.sections.flatMap((section) => [
          h2(section.heading),
          'text' in section ? p(section.text as string) : ul(...(section as { items: string[] }).items),
        ]),
      ),
    }],
  })
  const privacy = await textPage(demo.pages.privacy)
  const rights = await textPage(demo.pages.rights)
  const accessibility = await textPage(demo.pages.accessibility)

  // ── the one page of the website: every section is a block, reached from the menu by its anchor.
  //    The sections are those of the look's own design, in its order (Ciferník's has no wide photograph). ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const wide = look.id === 'cekarna' ? [{ type: 'photo' as const, image: photo.rozhovor }] : []
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.cekarna,
    metaDescription: demo.settings.metaDescription,
    sections: [
      { type: 'opening', ...demo.opening, image: photo.cekarna, primaryUrl: to('booking') },
      { type: 'notices', heading: demo.notices.heading },
      { type: 'hours', eyebrow: demo.hours.eyebrow, heading: demo.hours.heading, text: demo.hours.text },
      ...wide,
      {
        type: 'services', eyebrow: demo.services.eyebrow, heading: demo.services.heading, text: demo.services.text,
        coveredNote: demo.services.coveredNote, image: photo.tlak,
      },
      { type: 'prices', ...demo.prices, image: photo.tlak, roundImage: photo.detail },
      { type: 'insurers', heading: demo.insurers.heading },
      { type: 'team', eyebrow: demo.team.eyebrow, heading: demo.team.heading, text: demo.team.text },
      {
        type: 'booking', eyebrow: demo.booking.eyebrow, heading: demo.booking.heading,
        firstVisit: demo.booking.firstVisit.map((text) => ({ text })), bring: demo.booking.bring.map((text) => ({ text })),
        formText: demo.booking.formText, privacyUrl: refTo(s, privacy),
      },
      { type: 'location', ...demo.location, image: photo.dum },
    ],
  })

  // ── the menu: the sections of the page; and the links for patients ──
  await s.global(Navigation, {
    main: [
      s.link(demo.menu.hours, to('hours')), s.link(demo.menu.notices, to('notices')), s.link(demo.menu.services, to('services')), s.link(demo.menu.team, to('team')),
      s.link(demo.menu.booking, to('booking')), s.link(demo.menu.location, to('location')),
    ],
    legal: [s.link(demo.legal.privacy, privacy), s.link(demo.legal.rights, rights), s.link(demo.legal.accessibility, accessibility)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ogImage: photo.cekarna,
  }, { ifMissing: true })
})
