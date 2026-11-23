import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Feature, Navigation, Page, Plan, PlanLimit, Question, Release, SiteSettings, Testimonial } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS, type PhotoKey } from './photos'

// The demo content of the Software template: the fictional product Odpolka, a schedule and
// attendance app for small businesses, made by four people in Olomouc. One set of content for all
// three looks, worded as the design of the look the site is made in (texts/cs.ts holds every
// text of it) and with the sections that design has, in its order.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_LOOK=magnety SEED_URL=http://localhost:3437 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their place in the list (pages by their
// address), a file by its name, and what is already as written here is left alone. The site's
// settings are only written when there are none yet, so a second run never undoes the owner's
// look or name.

/** Midnight of a day in Prague as a moment ("all day" dates are stored that way). */
function pragueDay([year, month, day]: number[]): string {
  const guess = Date.UTC(year!, month! - 1, day!)
  const offset = Number(/GMT([+-]\d+)/.exec(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Prague', timeZoneName: 'shortOffset' }).format(guess))?.[1] ?? 1)
  return new Date(guess - offset * 3_600_000).toISOString()
}

export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)
  const pic = (key: string | undefined) => (key ? photo[key as PhotoKey] : undefined)

  // ── the collections (an entry is its place in the list, so a second look's wording replaces the first's) ──
  for (const [position, f] of demo.features.items.entries()) {
    await s.upsert(Feature, {
      position, title: f.title, question: f.question ?? '', when: f.when ?? '', text: f.text, note: f.note ?? '',
      points: (f.points ?? []).map((text) => ({ text })), screen: f.screen, caption: f.caption ?? '', photo: pic(f.photo) ?? null,
    }, { by: 'position' })
  }
  for (const [position, p] of demo.pricing.plans.entries()) {
    await s.upsert(Plan, {
      position, name: p.name, forWhom: p.forWhom, monthly: p.monthly, yearly: p.yearly, highlighted: p.highlighted, badge: p.badge,
      items: p.items.map((text) => ({ text })),
    }, { by: 'position' })
  }
  for (const [position, l] of demo.pricing.limits.entries()) {
    await s.upsert(PlanLimit, { position, name: l.name, values: l.values.map((value) => ({ value })) }, { by: 'position' })
  }
  for (const [position, t] of demo.testimonials.items.entries()) {
    await s.upsert(Testimonial, { position, name: t.name, role: t.role, text: t.text, photo: pic(t.photo) ?? null, featured: t.featured }, { by: 'position' })
  }
  for (const [position, q] of demo.questions.items.entries()) await s.upsert(Question, { position, ...q }, { by: 'position' })
  for (const r of demo.changelog.releases) await s.upsert(Release, { date: pragueDay(r.date), version: r.version, title: r.title, text: r.text }, { by: 'version' })

  // ── the pages ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const moment = (d: { time: string; timeNote: string }) => ({ time: d.time, timeNote: d.timeNote })
  const blocks = {
    opening: () => ({
      type: 'opening' as const, eyebrow: demo.opening.eyebrow, heading: demo.opening.heading, text: demo.opening.text,
      primaryLabel: demo.opening.primaryLabel, primaryUrl: to('cta'), secondaryLabel: demo.opening.secondaryLabel, secondaryUrl: to('pricing'),
      note: demo.opening.note, facts: demo.opening.facts, screen: demo.opening.screen, caption: demo.opening.caption, notes: demo.opening.notes,
      photo: photo.kavarna, ...moment(demo.opening),
    }),
    audience: () => ({
      type: 'audience' as const, eyebrow: demo.audience.eyebrow, heading: demo.audience.heading, text: demo.audience.text,
      tags: demo.audience.tags.map((text) => ({ text })),
      photos: demo.audience.photos.map(({ photo: key, title, caption }) => ({ image: pic(key)!, title, caption })), ...moment(demo.audience),
    }),
    features: () => ({ type: 'features' as const, eyebrow: demo.features.eyebrow, heading: demo.features.heading, text: demo.features.text, ...moment(demo.features) }),
    pricing: () => ({
      type: 'pricing' as const, eyebrow: demo.pricing.eyebrow, heading: demo.pricing.heading, text: demo.pricing.text, yearlyNote: demo.pricing.yearlyNote,
      afterLabel: demo.pricing.afterLabel, afterText: demo.pricing.afterText, afterNote: demo.pricing.afterNote, moreText: demo.pricing.moreText, ...moment(demo.pricing),
    }),
    testimonials: () => ({ type: 'testimonials' as const, eyebrow: demo.testimonials.eyebrow, heading: demo.testimonials.heading, ...moment(demo.testimonials) }),
    changelog: () => ({
      type: 'changelog' as const, eyebrow: demo.changelog.eyebrow, heading: demo.changelog.heading, text: demo.changelog.text,
      linkLabel: demo.changelog.linkLabel, linkUrl: '/novinky', count: demo.changelog.count, image: photo.obchod, imageCaption: demo.changelog.imageCaption, ...moment(demo.changelog),
    }),
    questions: () => ({ type: 'questions' as const, eyebrow: demo.questions.eyebrow, heading: demo.questions.heading, text: demo.questions.text, ...moment(demo.questions) }),
    team: () => ({
      type: 'team' as const, eyebrow: demo.team.eyebrow, heading: demo.team.heading, text: demo.team.text, image: photo.tym, imageCaption: demo.team.imageCaption,
      dataLabel: demo.team.dataLabel, dataHeadline: demo.team.dataHeadline, dataText: demo.team.dataText, supportLabel: demo.team.supportLabel,
      outsideLabel: demo.team.outsideLabel, outsideText: demo.team.outsideText,
      formEyebrow: demo.team.formEyebrow, formHeading: demo.team.formHeading, formText: demo.team.formText, formNote: demo.team.formNote, ...moment(demo.team),
    }),
    cta: () => ({
      type: 'cta' as const, eyebrow: demo.cta.eyebrow, heading: demo.cta.heading, text: demo.cta.text, buttonLabel: demo.cta.buttonLabel, ...moment(demo.cta),
    }),
  }
  // The sections each design has, in its order (a block a design has no section for is drawn by
  // that look all the same: a site that changes its look keeps its content).
  const home = {
    navod: ['opening', 'features', 'audience', 'testimonials', 'pricing', 'changelog', 'questions', 'team', 'cta'],
    magnety: ['opening', 'audience', 'features', 'pricing', 'testimonials', 'changelog', 'questions', 'team', 'cta'],
    'jeden-den': ['opening', 'features', 'pricing', 'testimonials', 'changelog', 'questions', 'team', 'cta'],
  }[look.id] as Array<keyof typeof blocks>
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.kavarna,
    metaDescription: demo.settings.metaDescription,
    sections: home.map((type) => blocks[type]()),
  })

  // The changelog on a page of its own, with every release.
  await s.upsert(Page, {
    title: demo.pages.news.title, slug: 'novinky', status: 'published',
    sections: [{ ...blocks.changelog(), heading: demo.pages.news.heading, text: demo.pages.news.text, linkLabel: '', linkUrl: null, count: 0, image: null, imageCaption: '', time: '', timeNote: '' }],
  })
  await s.upsert(Page, {
    title: demo.pages.contact.title, slug: 'kontakt', status: 'published',
    sections: [{
      type: 'contact', eyebrow: demo.contact.eyebrow, heading: demo.contact.heading, text: demo.contact.text, note: demo.contact.note, time: '', timeNote: '',
    }],
  })
  const legal = async (slug: string, page: { title: string; paragraphs: string[] }) => s.upsert(Page, {
    title: page.title, slug, status: 'published',
    sections: [{ type: 'text', heading: page.title, body: s.rich.doc(...page.paragraphs.map((p) => s.rich.p(p))) }],
  })
  const terms = await legal('obchodni-podminky', demo.pages.terms)
  const privacy = await legal('ochrana-osobnich-udaju', demo.pages.privacy)
  const processing = await legal('zpracovatelska-smlouva', demo.pages.processing)
  const cookies = await legal('cookies', demo.pages.cookies)

  // ── the menus: the sections of the page, and the footer's three columns ──
  const m = demo.menu
  await s.global(Navigation, {
    main: [
      s.link(m.main.features, to('features')), s.link(m.main.pricing, to('pricing')), s.link(m.main.changelog, to('changelog')),
      s.link(m.main.questions, to('questions')), s.link(m.main.team, to('team')),
    ],
    product: [
      s.link(m.product.features, to('features')), s.link(m.product.pricing, to('pricing')), s.link(m.product.changelog, to('changelog')),
      s.link(m.product.app, 'https://app.odpolka.example/mobil'),
    ],
    support: [
      s.link(m.support.docs, 'https://napoveda.odpolka.example'), s.link(m.support.status, demo.settings.statusUrl), s.link(m.support.contact, to('contact')),
      s.link(demo.settings.loginLabel, demo.settings.loginUrl),
    ],
    legal: [s.link(m.legal.terms, terms), s.link(m.legal.privacy, privacy), s.link(m.legal.processing, processing), s.link(m.legal.cookies, cookies)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('cta'),
    ogImage: photo.kavarna,
  }, { ifMissing: true })
})
