import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { buildRegistry, defineEntity, defineLocales, definePages, emitSchema, f } from 'tinyzoo'
import { isBeingTranslated, perLocalePublishing, publishedCond, scheduleCond, shownTranslationCond } from '../../packages/cms/server/utils/cmsPublished'

// publish.perLocale: what it needs, the columns it adds, and the condition that decides what a language shows.
const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })
const entity = (name: string, publish: Record<string, unknown> | undefined, over: { localized?: boolean; dated?: boolean; published?: boolean } = {}) => defineEntity(name, {
  label: name,
  titleField: 'title',
  fields: {
    title: over.localized === false ? f.text({ required: true }) : f.text({ required: true }).localized(),
    status: f.select({ options: ['draft', 'live'] as const, default: 'draft' }),
    publishedAt: f.datetime().optional(),
  },
  publish: publish ? { field: 'status', publishedValue: 'live', draftValue: 'draft', ...(over.dated ? { dateField: 'publishedAt' } : {}), ...publish } as any : undefined,
  content: { public: true, ...(over.published ? { published: (t: any) => (t.status as any) } : {}) },
})
const sqlOf = (cond: any) => new PgDialect().sqlToQuery(cond)

describe('publish.perLocale', () => {
  it('needs a field that is translated', () => {
    expect(() => entity('plain', { perLocale: true }, { localized: false })).toThrow(/publish\.perLocale of "plain" needs at least one field marked \.localized\(\)/)
  })

  it('is not available for a page tree yet', () => {
    const blocks = {}
    expect(() => definePages({ blocks, name: 'treePage', localized: true, tree: true, perLocale: true })).toThrow(/not available for a page tree/)
    expect(definePages({ blocks, name: 'flatPage', localized: true, perLocale: true }).publish?.perLocale).toBe(true)
    expect(() => definePages({ blocks, name: 'unlocalized', perLocale: true })).toThrow(/needs at least one field marked \.localized\(\)/)
  })

  it('keeps the translation table\'s own state columns to itself', () => {
    expect(() => defineEntity('clash', {
      label: 'x', titleField: 'title',
      fields: { title: f.text({ required: true }).localized(), published: f.text().localized(), status: f.select({ options: ['draft', 'live'] as const, default: 'draft' }) },
      publish: { field: 'status', publishedValue: 'live', draftValue: 'draft', perLocale: true },
    })).toThrow(/cannot be called "published"/)
    expect(() => defineEntity('clash2', {
      label: 'x', titleField: 'title',
      fields: { title: f.text({ required: true }).localized(), firstLiveAt: f.text().localized(), status: f.select({ options: ['draft', 'live'] as const, default: 'draft' }) },
      publish: { field: 'status', publishedValue: 'live', draftValue: 'draft', perLocale: true },
    })).toThrow(/cannot be called "firstLiveAt"/)
  })

  it('adds a nullable state and date to the translations, and nothing to an entity without it', () => {
    const on = entity('onPost', { perLocale: true })
    const off = entity('offPost', {})
    expect(Object.keys(on.localesTable)).toEqual(expect.arrayContaining(['published', 'publishedAt', 'firstLiveAt']))
    expect(on.localesTable.published.notNull).toBe(false)
    expect(on.localesTable.publishedAt.notNull).toBe(false)
    expect(on.localesTable.firstLiveAt.notNull).toBe(false)
    expect(Object.keys(off.localesTable)).not.toContain('published')
    // The generated schema.ts says the same, and only for the entity that has the option.
    const source = emitSchema({ locales, on, off })
    const table = (name: string) => source.slice(source.indexOf(`export const ${name}Locales`), source.indexOf('\n\n', source.indexOf(`export const ${name}Locales`)))
    expect(table('onPost')).toContain(`published: boolean('published'),`)
    expect(table('onPost')).toContain(`publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date', precision: 3 }),`)
    expect(table('onPost')).toContain(`firstLiveAt: timestamp('first_live_at', { withTimezone: true, mode: 'date', precision: 3 }),`)
    expect(table('offPost')).not.toContain('published')
  })
})

describe('what is live in a language', () => {
  const reg = buildRegistry({ locales, post: entity('post', { perLocale: true }, { dated: true }), plain: entity('plainPost', {}, { dated: true }), custom: entity('customPost', { perLocale: true }, { dated: true, published: true }) })
  const e = (name: string) => reg.byName.get(name)!

  it('is the entry\'s own state for the default language, for no language and for an entity that publishes as one', () => {
    for (const name of ['post', 'plainPost', 'customPost']) {
      const own = sqlOf(publishedCond(e(name)))
      expect(sqlOf(publishedCond(e(name), null))).toEqual(own)
      expect(sqlOf(publishedCond(e(name), undefined))).toEqual(own)
      expect(own.sql).not.toContain('_locales')
    }
    // Another language changes nothing for an entity without the option.
    expect(sqlOf(publishedCond(e('plainPost'), 'en'))).toEqual(sqlOf(publishedCond(e('plainPost'))))
    expect(perLocalePublishing(e('plainPost'))).toBe(false)
    expect(perLocalePublishing(e('post'))).toBe(true)
  })

  it('asks the translation first for a language, and falls back to the entry', () => {
    const q = sqlOf(publishedCond(e('post'), 'en'))
    expect(q.sql).toContain('"post_locales"')
    expect(q.sql).toContain('coalesce(')
    expect(q.sql).toContain('"published" is not null')
    // The language is a bound parameter, never part of the text.
    expect(q.sql).not.toContain('en"')
    expect(q.params).toContain('en')
    // The schedule follows the same view: the translation's date while it has a state, the entry's otherwise.
    expect(sqlOf(scheduleCond(e('post'))).sql).not.toContain('_locales')
  })

  it('counts a state of its own only once the language has been on the website (one being translated follows the entry)', () => {
    const q = sqlOf(publishedCond(e('post'), 'en'))
    expect(q.sql).toContain('"first_live_at" <= now()')
    // What visitors see of the translation rows: following ones, and ones that have been on the website; never null.
    const shown = sqlOf(shownTranslationCond(e('post')))
    expect(shown.sql).toMatch(/^coalesce\(.*"published" is null.*"first_live_at" <= now\(\).*, false\)$/)
    expect(shownTranslationCond(e('plainPost'))).toBeUndefined()
    const now = Date.parse('2026-11-17T12:00:00Z')
    expect(isBeingTranslated({ published: false, firstLiveAt: null }, now)).toBe(true)
    expect(isBeingTranslated({ published: false, firstLiveAt: new Date(now + 60_000) }, now)).toBe(true) // a first date cancelled
    expect(isBeingTranslated({ published: false, firstLiveAt: new Date(now - 60_000) }, now)).toBe(false) // taken off
    expect(isBeingTranslated({ published: true, firstLiveAt: new Date(now + 60_000) }, now)).toBe(false) // scheduled: published
    expect(isBeingTranslated({ published: null, firstLiveAt: null }, now)).toBe(false) // follows
    expect(isBeingTranslated(undefined, now)).toBe(false)
  })

  it('runs the site\'s own content.published rule against that view', () => {
    const q = sqlOf(publishedCond(e('customPost'), 'en'))
    expect(q.sql).toContain('"custom_post_locales"')
    expect(q.sql).toContain('coalesce(')
  })

  it('is gated by the default language: a translation is live only where the entry is, and its own state too', () => {
    for (const name of ['post', 'customPost']) {
      const own = sqlOf(publishedCond(e(name)))
      const en = sqlOf(publishedCond(e(name), 'en'))
      // The entry's own condition (status, schedule, the site's rule) is in it as it stands, ahead of the language's own state.
      expect(en.sql.startsWith('(' + own.sql)).toBe(true)
      expect(en.sql.indexOf('_locales')).toBeGreaterThan(own.sql.length)
      // Following (no state of its own) can only be as live as the entry; so the language adds nothing but its own say.
      expect(en.sql.length).toBeGreaterThan(own.sql.length)
    }
  })
})
