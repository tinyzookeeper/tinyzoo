import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { defineEntity, defineLocales, f } from 'tinyzoo'
import { LANGUAGE_FILTERS, languageStateCond, parseLanguageFilters, translatedCond, workStateSql } from '../../packages/cms/server/utils/cmsTranslationWork'

// Where a translation stands, as SQL (the list's language filter, the home page's "Needs translating").
// The answers against a database are in test/api/translation-work.spec.ts; here: what is asked, and how.
const locales = defineLocales({ default: 'cs', locales: ['cs', 'en', 'de'] })
const entity = (name: string, opts: { perLocale?: boolean; publish?: boolean } = {}) => defineEntity(name, {
  label: name,
  titleField: 'title',
  fields: {
    title: f.text({ required: true }).localized(),
    body: f.richtext().localized(),
    status: f.select({ options: ['draft', 'live'] as const, default: 'draft' }),
    publishedAt: f.datetime().optional(),
  },
  publish: opts.publish === false ? undefined : { field: 'status', publishedValue: 'live', draftValue: 'draft', dateField: 'publishedAt', perLocale: !!opts.perLocale },
  content: { public: true },
})
const perLocale = entity('perPost', { perLocale: true })
const asOne = entity('onePost')
const noDrafts = entity('note', { publish: false })
const sqlOf = (cond: any) => new PgDialect().sqlToQuery(cond)

describe('parseLanguageFilters', () => {
  const reg = { locales }
  it('reads one or several states per translation language', () => {
    expect(parseLanguageFilters(perLocale, reg, { 'filter.lang:en': 'missing', 'filter.lang:de': 'translating,draft', 'q': 'x', 'filter.title': 'y' })).toEqual([
      { locale: 'en', states: ['missing'] },
      { locale: 'de', states: ['translating', 'draft'] },
    ])
  })
  it('ignores the default language, unknown languages and states, and empty values', () => {
    expect(parseLanguageFilters(perLocale, reg, { 'filter.lang:cs': 'missing', 'filter.lang:fr': 'missing', 'filter.lang:en': 'bogus', 'filter.lang:de': '' })).toEqual([])
    expect(parseLanguageFilters(perLocale, reg, { 'filter.lang:en': 'missing,bogus,missing' })).toEqual([{ locale: 'en', states: ['missing'] }])
  })
  it('takes the first of a repeated parameter', () => {
    expect(parseLanguageFilters(perLocale, reg, { 'filter.lang:en': ['draft', 'missing'] })).toEqual([{ locale: 'en', states: ['draft'] }])
  })
  it('says nothing for a site in one language or an entity without translations', () => {
    expect(parseLanguageFilters(perLocale, { locales: null } as any, { 'filter.lang:en': 'missing' })).toEqual([])
    const plain = defineEntity('plain', { label: 'p', titleField: 'title', fields: { title: f.text({ required: true }) } })
    expect(parseLanguageFilters(plain, reg, { 'filter.lang:en': 'missing' })).toEqual([])
  })
  it('a field key cannot clash with it (a key never holds a colon)', () => {
    expect(LANGUAGE_FILTERS).toEqual(['todo', 'missing', 'translating', 'draft', 'published', 'translated'])
  })
})

describe('languageStateCond', () => {
  it('per language: the state of its own and the date it was first live decide', () => {
    const translating = sqlOf(languageStateCond(perLocale, 'en', 'translating'))
    expect(translating.sql).toContain('"per_post_locales"."published" = false')
    expect(translating.sql).toContain('"per_post_locales"."first_live_at" is null or "per_post_locales"."first_live_at" > now()')
    expect(translating.params).toContain('en')
    const draft = sqlOf(languageStateCond(perLocale, 'en', 'draft')).sql
    expect(draft).toContain('"per_post_locales"."first_live_at" <= now()')
    expect(draft).toContain('"per_post_locales"."published" is not null')
  })
  it('without per-language publishing, nothing is being translated, and a translation row is a translation', () => {
    expect(sqlOf(languageStateCond(asOne, 'en', 'translating')).sql).toBe('false')
    expect(sqlOf(translatedCond(asOne, 'en')).sql).toBe('exists (select 1 from "one_post_locales" where "one_post_locales"."parent_id" = "one_post"."id" and "one_post_locales"."locale" = $1 and true)')
  })
  it('counts only the fields given (those the person may read), by what they hold', () => {
    const onlyTitle = sqlOf(translatedCond(asOne, 'en', ['title'])).sql
    expect(onlyTitle).toContain(`coalesce("one_post_locales"."title", '') <> ''`)
    expect(onlyTitle).not.toContain('"body"')
    const all = sqlOf(translatedCond(perLocale, 'en')).sql
    expect(all).toContain('jsonb_path_exists("per_post_locales"."body"')
    expect(sqlOf(translatedCond(perLocale, 'en', [])).sql).toBe('false')
  })
  it('needs translating: live or scheduled in the default language', () => {
    const todo = sqlOf(languageStateCond(perLocale, 'en', 'todo'))
    expect(todo.sql.startsWith('("per_post"."status" = $1 and')).toBe(true)
    expect(todo.params[0]).toBe('live')
    // No drafts: every entry counts.
    expect(sqlOf(languageStateCond(noDrafts, 'en', 'todo')).sql.startsWith('not exists')).toBe(true)
    expect(sqlOf(languageStateCond(noDrafts, 'en', 'draft')).sql).toBe('false')
  })
  it('on the website: the text visitors read, live in that language', () => {
    const live = sqlOf(languageStateCond(perLocale, 'en', 'published')).sql
    // The translation is shown (follows, or has been live), and the entry and the language are live.
    expect(live).toContain('"per_post_locales"."published" is null or "per_post_locales"."first_live_at" <= now()')
    expect(live).toContain('"per_post"."status" = ')
  })
  it('the work state is one word per row', () => {
    expect(sqlOf(workStateSql(perLocale, 'en')).sql).toMatch(/^\(case when exists .* then 'translating' when exists .* then 'draft' else 'missing' end\)$/s)
  })
})
