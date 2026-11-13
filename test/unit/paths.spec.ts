import { describe, expect, it } from 'vitest'
import { buildRegistry, defineEntity, defineLocales, f, prefixedTemplates, sitePath, pathTemplateKeys } from 'tinyzoo'

const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })
const translated = { cs: '/aktuality/:slug', en: '/news/:slug' }

describe('website addresses', () => {
  it('fills one template per language, prefix included', () => {
    expect(sitePath(locales, translated, 'cs', { slug: 'zavod' })).toBe('/aktuality/zavod')
    expect(sitePath(locales, translated, 'en', { slug: 'race' })).toBe('/en/news/race')
    expect(sitePath(locales, '/blog/:slug', 'en', { slug: 'a b' })).toBe('/en/blog/a%20b')
    expect(sitePath(locales, translated, 'cs', { slug: '' })).toBeNull()
  })

  it('gives a language left out of the map no address', () => {
    expect(sitePath(locales, { cs: '/jen-cesky/:slug' }, 'en', { slug: 'x' })).toBeNull()
  })

  it('collects the placeholders of every language', () => {
    expect(pathTemplateKeys({ cs: '/:year/:slug', en: '/news/:slug' })).toEqual(['year', 'slug'])
    expect(pathTemplateKeys(undefined)).toEqual([])
  })

  it('hands the admin a preview template per language', () => {
    expect(prefixedTemplates(translated, locales)).toEqual({ cs: '/aktuality/:slug', en: '/en/news/:slug' })
    expect(prefixedTemplates('/blog/:slug', null)).toEqual({ '': '/blog/:slug' })
    expect(prefixedTemplates(undefined, locales)).toBeNull()
  })
})

describe('configuration', () => {
  const entity = (path: any) => defineEntity(`thing${Math.random().toString(36).slice(2, 8)}`, {
    label: 'Things', titleField: 'title',
    fields: { title: f.text(), slug: f.slug({ from: 'title' }) },
    content: { public: true, slug: 'slug', path },
  })

  it('needs languages for an address per language', () => {
    expect(() => buildRegistry({ e: entity(translated) })).toThrow(/no languages are defined/)
  })

  it('rejects unknown languages and a missing default', () => {
    expect(() => buildRegistry({ locales, e: entity({ cs: '/a/:slug', de: '/b/:slug' }) })).toThrow(/unknown language de/)
    expect(() => buildRegistry({ locales, e: entity({ en: '/b/:slug' }) })).toThrow(/default language "cs"/)
    expect(() => buildRegistry({ locales, e: entity({ cs: 'a/:slug' }) })).toThrow(/start with "\/"/)
  })

  it('accepts a valid map', () => {
    expect(() => buildRegistry({ locales, e: entity(translated) })).not.toThrow()
  })
})
