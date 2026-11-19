import { describe, expect, it } from 'vitest'
import { buildRegistry, defineEntity, f } from 'tinyzoo'
import * as config from '../../playground/cms.config'

describe('defineEntity', () => {
  it.each(['_secret', 'media', 'graph'])('rejects the reserved name %s', (name) => {
    expect(() => defineEntity(name, { label: 'X', titleField: 'title', fields: { title: f.text() } })).toThrow(/reserved/)
  })

  it('names FK columns `${key}Id` and leaves virtual relations without a column', () => {
    const cols = Object.keys(config.Post.table)
    expect(cols).toEqual(expect.arrayContaining(['id', 'title', 'authorId', 'heroId', 'createdAt', 'updatedAt']))
    expect(cols).not.toContain('tags') // m2m lives in a junction
    expect(Object.keys(config.Author.table)).not.toContain('posts') // one-to-many is virtual
  })
})

describe('validation schemas', () => {
  const author = '00000000-0000-4000-8000-000000000001'
  const body = { type: 'doc', content: [] }

  it('requires required fields on create and applies defaults', () => {
    const missing = config.Post.insertSchema.safeParse({ slug: 'x', author, body })
    expect(missing.success).toBe(false)

    const ok = config.Post.insertSchema.safeParse({ title: 'Hello', slug: 'hello', author, body })
    expect(ok.success).toBe(true)
    expect(ok.data).toMatchObject({ status: 'draft', tags: [] })
  })

  it('rejects a bad slug, enum value and email', () => {
    expect(config.Post.insertSchema.safeParse({ title: 'T', slug: 'Not A Slug', author, body }).success).toBe(false)
    expect(config.Post.insertSchema.safeParse({ title: 'T', slug: 't', author, body, status: 'archived' }).success).toBe(false)
    expect(config.Author.insertSchema.safeParse({ name: 'A', email: 'not-an-email' }).success).toBe(false)
  })

  // Regression: building the update schema from insertSchema.partial() fired the
  // create defaults on PATCH and silently reset omitted fields (tags → [], status → draft).
  it('does not apply create defaults on update', () => {
    const r = config.Post.updateSchema.safeParse({ title: 'Only the title' })
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ title: 'Only the title' })
  })

  it('accepts null to clear an optional media field', () => {
    expect(config.Post.updateSchema.safeParse({ hero: null }).success).toBe(true)
  })
})

describe('buildRegistry', () => {
  const reg = buildRegistry(config)

  it('collects entities, singletons and the m2m junction', () => {
    expect(reg.entities.map((e) => e.name).sort()).toEqual(['author', 'contactForm', 'events', 'formSettings', 'navigation', 'page', 'post', 'redirect', 'siteSettings', 'tag'])
    expect(reg.byName.get('siteSettings')?.singleton).toBe(true)
    expect(reg.junctions.map((j) => j.name)).toEqual(['post_to_tag'])
  })

  it('serialises a graph the admin can render, with labels and help text', () => {
    const post = reg.graph.find((g: any) => g.name === 'post')
    const field = (k: string) => post.fields.find((x: any) => x.key === k)
    expect(field('publishedAt').meta.label).toEqual({ en: 'Publish date', cs: 'Datum zveřejnění', de: 'Veröffentlichungsdatum' })
    expect(field('slug').meta).toMatchObject({ from: 'title', help: { en: expect.stringMatching(/title/) } })
    expect(field('status').meta).toMatchObject({ options: ['draft', 'published'], labels: { draft: { cs: 'Koncept' } } })
    expect(post).toMatchObject({ icon: 'i-lucide-newspaper', labelSingular: { en: 'Post' }, description: { cs: expect.any(String) } })
    expect(field('title')).toMatchObject({ required: true, ui: { edit: 'CmsFieldText', cell: 'CmsCellText' } })
  })

  it('carries editor placement and groups (seo() goes to a collapsed sidebar group)', () => {
    const post = reg.graph.find((g: any) => g.name === 'post')
    const meta = (k: string) => post.fields.find((x: any) => x.key === k).meta
    expect(meta('metaTitle')).toMatchObject({ position: 'sidebar', group: { en: 'Search & sharing' } })
    expect(meta('ogImage')).toMatchObject({ position: 'sidebar', group: { cs: 'Vyhledávače a sdílení' } })
    expect(meta('body').position).toBeUndefined() // decided by type in the admin
  })

  it('is memoised per config object', () => {
    expect(buildRegistry(config)).toBe(reg)
  })
})

describe('content languages', () => {
  it('only lets text, URL addresses, rich text and blocks be translated', () => {
    expect(() => f.media().localized()).toThrow(/can be localized/)
    expect(() => f.number().localized()).toThrow(/can be localized/)
    expect(f.text().localized().isLocalized).toBe(true)
  })

  it('needs defineLocales when anything is translatable', () => {
    const E = defineEntity('lonely', { label: 'L', titleField: 'name', fields: { name: f.text().localized() } })
    expect(() => buildRegistry({ E })).toThrow(/no languages are defined/)
  })

  it('builds a translations table for entities with localized fields only', () => {
    expect(config.Post.localized).toEqual(['title', 'slug', 'body', 'location'])
    expect(config.Post.localesTable).toBeTruthy()
    expect(config.Author.localesTable).toBeUndefined()
    expect(buildRegistry(config).locales).toMatchObject({ default: 'cs', locales: ['cs', 'en'] })
  })
})

describe('reserved field names', () => {
  it.each(['locale', 'locales', 'parentId', 'createdBy', 'id', 'path', 'paths', 'breadcrumbs', 'preview', '_key', '_type'])('refuses a field named %s', (key) => {
    expect(() => defineEntity('reserved_test', { label: 'R', titleField: 'name', fields: { name: f.text(), [key]: f.text() } as any })).toThrow(/reserved/)
  })
})

describe('text fields', () => {
  it('can be several lines long and capped in length', () => {
    const fld = f.text({ multiline: true, max: 5 })
    expect(fld.meta).toMatchObject({ multiline: true, max: 5 })
    expect(fld.zod('create').safeParse('a\nb').success).toBe(true)
    expect(fld.zod('create').safeParse('too long').success).toBe(false)
    expect(f.text().meta).toEqual({})
  })
})
