import { join } from 'node:path'
import { defineSeed } from 'tinyzoo'
import { Author, Navigation, Page, Post, SiteSettings, Tag } from '../../../playground/cms.config'

// A seed written against the playground's content model (used by test/api/seed.spec.ts).
const media = (file: string) => join(import.meta.dirname, 'media', file)

export default defineSeed(async (s) => {
  const wide = await s.upload(media('wide.png'), { alt: 'Wide picture', altLocales: { en: 'Wide picture (en)' }, focal: { x: 40, y: 60 } })
  const tall = await s.upload(media('tall.png'), { alt: 'Tall picture' })

  const jana = await s.create(Author, { name: 'Jana Nováková', email: 'jana@seed.example', bio: s.rich.doc(s.rich.p('Writes about training.')) }, { by: 'email' })
  const training = await s.create(Tag, { name: 'Trénink', slug: 'trenink' }, { translations: { en: { name: 'Training' } } })
  const news = await s.create(Tag, { name: 'Novinky', slug: 'novinky' }, { translations: { en: { name: 'News' } } })

  await s.upsert(Post, {
    title: 'První článek', slug: 'prvni-clanek', status: 'published', publishedAt: new Date('2026-03-01T09:00:00Z'),
    author: jana.id, tags: [training.id, news.id], hero: wide,
    gallery: [{ mediaId: wide, caption: 'Široký' }, { mediaId: tall, caption: 'Vysoký' }],
    body: s.rich.doc(s.rich.h2('Úvod'), s.rich.p('Text s ', s.rich.bold('tučným'), ' slovem zebra.'), s.rich.image(tall, 'Vysoký obrázek')),
  }, { translations: { en: { title: 'First post', slug: 'first-post', body: s.rich.doc(s.rich.p('English text with the word zebra.')) } } })

  const home = await s.upsert(Page, {
    title: 'Úvod', slug: 'uvod', status: 'published',
    sections: [
      { type: 'hero', heading: 'Vítejte', lead: 'Ukázka', image: wide, buttonLabel: 'Číst', buttonUrl: '/blog/prvni-clanek' },
      { type: 'cards', heading: 'Karty', items: [{ title: 'Jedna', text: 'První', image: wide }, { title: 'Dvě', text: 'Druhá', image: tall }] },
      { type: 'text', heading: 'Text', body: s.rich.doc(s.rich.p('Odstavec.')) },
    ],
  }, {
    translations: { en: { title: 'Home', slug: 'home', sections: [{ type: 'hero', heading: 'Welcome', lead: 'Sample', image: wide, buttonLabel: 'Read', buttonUrl: '/en/blog/prvni-clanek' }] } },
  })

  await s.global(Navigation, {
    main: [s.link('Úvod', home), s.link('Články', '/blog')],
    footer: [s.link('Kontakt', '/kontakt', { newTab: true })],
  }, { translations: { en: { main: [s.link('Home', home, { locale: 'en' }), s.link('Posts', '/en/blog')] } } })

  await s.global(SiteSettings, {
    siteName: 'Seed site', tagline: 'Hello', logo: wide,
    openingHours: [{ days: 'Po–Pá', hours: '9–17' }, { days: 'So', hours: '9–12' }],
  })
})
