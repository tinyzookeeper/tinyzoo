import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { Article, Navigation, Page, Project, Service, SiteSettings, Testimonial } from '../cms.config'
import { looks } from '../looks'
import { demo as sharedDemo, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Freelancer and consultant template: the fictional copywriter Magda
// Šubrtová from Brno. One set of content for all three looks; every text of it is in
// texts/cs.ts.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name or address, a file by its
// name, and what is already as written here is left alone. The site's settings are only
// written when there are none yet, so a second run never undoes the owner's look or name.

export default defineSeed(async (s) => {
  // The look the site is made in words the demo as that look's design does.
  const look = seedLook(looks)
  const demo = demoFor(sharedDemo, demoByLook, look)
  const first = looks.all.find((l) => l.id === look)!.presets[0].id
  const { doc, p, h2, ul } = s.rich

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)

  // ── the price list, the projects, the testimonials, the articles ──
  for (const [position, item] of demo.services.items.entries()) await s.upsert(Service, { position, ...item }, { by: 'name' })

  const projectPhotos = [photo.truhlarstvi, photo.vinarstvi, photo.ucetni, photo.penzion]
  const projectSlugs = ['kuchyne-habrina', 'vinarstvi-tri-sklepy', 'nabidka-saldo', 'chalupa-u-stare-lanovky']
  for (const [position, { story, ...item }] of demo.projects.items.entries()) {
    await s.upsert(Project, {
      position, status: 'published', slug: projectSlugs[position]!, image: projectPhotos[position]!, featured: true,
      body: doc(...story.map((text) => p(text))), ...item,
    }, { by: 'slug' })
  }

  for (const [position, item] of demo.testimonials.items.entries()) await s.upsert(Testimonial, { position, ...item }, { by: 'name' })

  const articlePhotos = [photo.ceny, photo.onas, photo.slova]
  const articleSlugs = ['ceny-na-webu', 'stranka-o-nas-neni-o-vas', 'sedm-slov-z-nabidky']
  for (const [i, { body, ...item }] of demo.articles.items.entries()) {
    await s.upsert(Article, {
      status: 'published', slug: articleSlugs[i]!, image: articlePhotos[i]!,
      body: doc(...body.map((text) => p(text))), ...item,
    }, { by: 'slug' })
  }

  // ── pages: the privacy text, then the pages every block links to ──
  const privacy = await s.upsert(Page, {
    title: demo.privacy.title, slug: 'ochrana-osobnich-udaju', status: 'published',
    sections: [{
      type: 'text', heading: demo.privacy.title,
      body: doc(
        p(demo.privacy.intro),
        ...demo.privacy.sections.flatMap((section) => [h2(section.heading), 'items' in section ? ul(...section.items!) : p(section.text!)]),
      ),
    }],
  })

  const projectsBlock = (over: Partial<typeof demo.projects> & { show: 'featured' | 'all' }) => ({
    type: 'projects' as const, eyebrow: demo.projects.eyebrow, question: demo.projects.question, heading: demo.projects.heading, text: demo.projects.text,
    linkLabel: '', linkUrl: null, ...over,
  })
  const articlesBlock = (count: number, withLink: boolean) => ({
    type: 'articles' as const, eyebrow: demo.articles.eyebrow, question: demo.articles.question, heading: demo.articles.heading, text: demo.articles.text,
    count, linkLabel: withLink ? demo.articles.linkLabel : '', linkUrl: withLink ? '/blog' : null,
  })

  await s.upsert(Page, {
    title: 'Zakázky', slug: 'zakazky', status: 'published', ogImage: photo.truhlarstvi,
    metaDescription: 'Čtyři zakázky a co se po nich změnilo: web truhlářství, popisky vín, nabídka účetní kanceláře a rezervace chalupy.',
    sections: [projectsBlock({ show: 'all' })],
  })
  await s.upsert(Page, {
    title: 'Blog', slug: 'blog', status: 'published', ogImage: photo.slova,
    metaDescription: 'Články o tom, jak psát o vlastní firmě srozumitelně: ceny na webu, stránka O nás, slova, která škrtat jako první.',
    sections: [articlesBlock(0, false)],
  })

  // ── the home page: every section is a block, reached from the menu by its anchor ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const o = demo.opening
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.portrait,
    metaDescription: demo.settings.metaDescription,
    sections: [
      {
        type: 'opening', eyebrow: o.eyebrow, strike: o.strike, question: o.question, heading: o.heading, text: o.text,
        image: photo.portrait, primaryLabel: o.primaryLabel, primaryUrl: to('contact'), secondaryLabel: o.secondaryLabel, secondaryUrl: to('services'),
        note: o.note, facts: o.facts, chipsTitle: o.chipsTitle,
        chips: o.chips.map((label, i) => ({ label, url: to((['services', 'services', 'projects', 'steps', 'about', 'contact'] as const)[i]!) })),
      },
      {
        type: 'services', eyebrow: demo.services.eyebrow, question: demo.services.question, heading: demo.services.heading, text: demo.services.text,
        footnote: demo.services.footnote, linkLabel: demo.services.linkLabel, linkUrl: to('contact'),
        helpTitle: demo.services.helpTitle, helpText: demo.services.helpText,
      },
      projectsBlock({ show: 'featured', linkLabel: demo.projects.linkLabel, linkUrl: '/zakazky' }),
      {
        type: 'steps', eyebrow: demo.steps.eyebrow, question: demo.steps.question, heading: demo.steps.heading, text: demo.steps.text,
        image: photo.interview, imageCaption: demo.steps.imageCaption, imageQuestion: demo.steps.imageQuestion, items: demo.steps.items,
      },
      { type: 'testimonials', heading: demo.testimonials.heading },
      {
        type: 'about', eyebrow: demo.about.eyebrow, question: demo.about.question, heading: demo.about.heading, text: demo.about.text,
        image: photo.walk, imageCaption: demo.about.imageCaption, secondImage: photo.workshop, timeline: demo.about.timeline,
      },
      articlesBlock(3, true),
      {
        type: 'contact', eyebrow: demo.contact.eyebrow, question: demo.contact.question, heading: demo.contact.heading, text: demo.contact.text,
        image: photo.desk, formTitle: demo.contact.formTitle, times: demo.contact.times.map((name) => ({ name })), note: demo.contact.note,
      },
    ],
  })

  // ── the menu: the sections of the page; the privacy page in the footer ──
  await s.global(Navigation, {
    main: [
      s.link(demo.menu.services, to('services')), s.link(demo.menu.projects, to('projects')),
      s.link(demo.menu.about, to('about')), s.link(demo.menu.articles, to('articles')),
    ],
    legal: [s.link(demo.legalMenu, privacy)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  await s.global(SiteSettings, {
    ...demo.settings,
    look,
    colors: first,
    ctaUrl: to('contact'),
    ogImage: photo.portrait,
  }, { ifMissing: true })
})
