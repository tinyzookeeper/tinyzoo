import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Course, Instructor, Lesson, LessonKind, Navigation, Page, Question, SiteSettings, Tariff } from '../cms.config'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Studio template: the fictional movement studio Osnova in a former
// mill in Písek, with one week of 29 classes. One set of content for all three looks, worded as
// the design of the look the site is made in (texts/cs.ts holds every text of it): the home page
// has the sections of that design in its order.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3430 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//   SEED_LOOK=tabule … pnpm seed      (the content in Tabule's wording)
//
// It is safe to run again: entries are recognised by their name (pages by their address), a
// file by its name, and what is already as written here is left alone. The site's settings
// are only written when there are none yet, so a second run never undoes the owner's look or names.

export default defineSeed(async (s) => {
  // The look the site is made in (the cloud says it; the first one otherwise), and the demo as
  // that look's design words it.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)
  const { doc, p, h2 } = s.rich

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── kinds of classes, instructors, the week's classes, courses, prices, questions ──
  const kinds: string[] = []
  for (const [position, k] of demo.kinds.entries()) {
    kinds.push((await s.upsert(LessonKind, { position, name: k.name, shortName: k.shortName, summary: k.summary, audience: k.audience, levelNote: k.levelNote, duration: k.duration, image: photo[k.photo] }, { by: 'name' })).id)
  }
  const instructors: string[] = []
  for (const [position, i] of demo.instructors.entries()) {
    instructors.push((await s.upsert(Instructor, { position, name: i.name, label: i.label, bio: i.bio, photo: photo[i.photo], teaches: i.teaches.map((n) => kinds[n]!) }, { by: 'name' })).id)
  }
  for (const [day, start, end, title, kind, who, level, room, capacity, free] of demo.rows) {
    await s.upsert(Lesson, { title, day, start, end, level, room, capacity, free, kind: kinds[kind]!, instructor: instructors[who]! }, { by: ['title', 'day', 'start'] })
  }
  for (const [position, c] of demo.courses.entries()) {
    await s.upsert(Course, { position, title: c.title, kind: kinds[c.kind]!, text: c.text, startsOn: c.startsOn, lessons: c.lessons, price: c.price, capacity: c.capacity, free: c.free }, { by: 'title' })
  }
  for (const [position, t] of demo.tariffs.entries()) await s.upsert(Tariff, { position, ...t }, { by: 'name' })
  for (const [position, q] of demo.questions.entries()) await s.upsert(Question, { position, ...q }, { by: 'question' })

  // ── the blocks, each as this look's design words it ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const hero = {
    type: 'hero' as const, ...demo.hero,
    // Sál takes the first photograph, Tabule the second, Deka the second with the third on its corner.
    photos: [photo.room, photo.hero, photo.detail].map((image) => ({ image })),
  }
  const timetable = { type: 'timetable' as const, ...demo.timetable }
  const kindsBlock = { type: 'kinds' as const, ...demo.kindsBlock, helpUrl: demo.kindsBlock.helpUrl || null }
  const courses = { type: 'courses' as const, ...demo.coursesBlock }
  const prices = { type: 'prices' as const, ...demo.pricesBlock }
  const instructorsBlock = { type: 'instructors' as const, ...demo.instructorsBlock }
  // The three photographs of the rooms, in the order the look's design lays them out.
  const spacePhotos: Record<string, Array<keyof typeof photo>> = {
    sal: ['hero', 'lobby', 'detail'], tabule: ['room', 'detail', 'lobby'], deka: ['room', 'lobby', 'exterior'],
  }
  const space = {
    type: 'space' as const, eyebrow: demo.space.eyebrow, heading: demo.space.heading, text: demo.space.text, facts: demo.space.facts,
    photos: (spacePhotos[look.id] ?? spacePhotos.sal!).map((key) => ({ image: photo[key], caption: demo.space.captions[key] ?? '' })),
  }
  const where = { type: 'where' as const, ...demo.where, image: photo.exterior }
  const questions = { type: 'questions' as const, ...demo.questionsBlock }
  const signup = { type: 'signup' as const, ...demo.signup, steps: demo.signup.steps.map((text) => ({ text })) }

  // ── the pages: the home page has this look's sections in this look's order ──
  await s.upsert(Page, {
    title: demo.pages.home.title, slug: 'home', status: 'published', ogImage: photo.hero, metaDescription: demo.settings.metaDescription,
    sections: look.id === 'deka'
      ? [hero, kindsBlock, timetable, courses, instructorsBlock, prices, space, where, questions, signup]
      : [hero, timetable, kindsBlock, courses, prices, instructorsBlock, space, where, questions, signup],
  })
  // The timetable on a page of its own (the link under it, and the kinds' links when a page has no timetable).
  await s.upsert(Page, { title: demo.pages.timetable.title, slug: 'rozvrh', status: 'published', sections: [timetable, signup] })
  for (const [slug, page] of [['provozni-rad', demo.pages.rules], ['ochrana-osobnich-udaju', demo.pages.privacy]] as const) {
    await s.upsert(Page, {
      title: page.title, slug, status: 'published',
      sections: [{ type: 'text', heading: page.title, body: doc(p(page.lead), ...page.sections.flatMap((section) => [h2(section.heading), p(section.text)])) }],
    })
  }

  // ── the menu: the sections of the page; the links in the footer: the rules and the privacy text ──
  await s.global(Navigation, {
    main: demo.menu.map((item) => s.link(item.label, to(item.to))),
    legal: demo.legal.map((item) => s.link(item.label, item.url)),
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look: look.id,
    colors: look.presets[0].id,
    ctaUrl: to('signup'),
    ogImage: photo.hero,
  }, { ifMissing: true })
})
