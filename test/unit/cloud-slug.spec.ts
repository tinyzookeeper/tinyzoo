import { describe, expect, it } from 'vitest'
import {
  assertSlug, databaseNameFor, firstFreeSlug, isValidSlug, quoteIdent, RESERVED_SLUGS, SLUG_MAX, slugProblem, suggestSlug, tidySlugInput,
} from '../../cloud/shared/slug'

// A website's address in the hosted product: it becomes a host name, a database name and a
// folder name, so the rules are strict.
describe('the rules of an address', () => {
  it('takes lower-case letters, digits and single dashes between them, 3 to 40 characters', () => {
    for (const ok of ['abc', 'pekarna-na-ruzku', 'web2', '2-weby', 'a-b-c', 'a'.repeat(40)]) expect(slugProblem(ok), ok).toBeNull()
  })

  it('says what is wrong', () => {
    expect(slugProblem('')).toBe('empty')
    expect(slugProblem('ab')).toBe('short')
    expect(slugProblem('a'.repeat(41))).toBe('long')
    expect(slugProblem('Pekarna')).toBe('chars')
    expect(slugProblem('pekárna')).toBe('chars')
    expect(slugProblem('moje web')).toBe('chars')
    expect(slugProblem('moje_web')).toBe('chars')
    expect(slugProblem('moje.web')).toBe('chars')
    expect(slugProblem('-web')).toBe('edges')
    expect(slugProblem('web-')).toBe('edges')
    expect(slugProblem('moje--web')).toBe('edges')
  })

  it('refuses reserved names', () => {
    for (const name of ['www', 'admin', 'api', 'app', 'console', 'login', 'mail', 'cloud', 'status', 'demo', 'docs', 'keeper', 'tinyzoo']) {
      expect(RESERVED_SLUGS.has(name), name).toBe(true)
      expect(slugProblem(name), name).toBe('reserved')
    }
    // Only the whole name is reserved.
    expect(isValidSlug('admin-pekarna')).toBe(true)
  })

  it('refuses anything that could reach SQL or a path', () => {
    for (const bad of ['a"; drop database x; --', '../etc', 'a/b', 'a\\b', 'a b', 'a\0b', 'a\nb', '...', 'web;rm']) {
      expect(isValidSlug(bad), JSON.stringify(bad)).toBe(false)
      expect(() => assertSlug(bad)).toThrow()
      expect(() => databaseNameFor(bad)).toThrow()
    }
    expect(isValidSlug(undefined as unknown as string)).toBe(false)
    expect(isValidSlug(42 as unknown as string)).toBe(false)
  })
})

describe('an address suggested from a name', () => {
  it('drops accents and capitals and joins words with dashes', () => {
    expect(suggestSlug('Pekárna U Žlutého koně')).toBe('pekarna-u-zluteho-kone')
    expect(suggestSlug('  Květinářství   Fialka  ')).toBe('kvetinarstvi-fialka')
    expect(suggestSlug('Truhlářství Svoboda, s.r.o.')).toBe('truhlarstvi-svoboda-s-r-o')
    expect(suggestSlug('Müller & Søn – Straße')).toBe('muller-a-son-strasse')
    expect(suggestSlug('Café č. 5!')).toBe('cafe-c-5')
  })

  it('always gives a usable address, or nothing', () => {
    for (const name of ['Pekárna', 'AB', 'X', 'admin', 'www', 'Tinyzoo', 'a'.repeat(200), 'slovo '.repeat(30), '日本語', '!!!', '', '  ', '-', 'a-', '--a--']) {
      const slug = suggestSlug(name)
      expect(slug === '' || isValidSlug(slug), `${JSON.stringify(name)} → ${JSON.stringify(slug)}`).toBe(true)
    }
    expect(suggestSlug('!!!')).toBe('')
    expect(suggestSlug('日本語')).toBe('')
  })

  it('lengthens a name that is too short or reserved', () => {
    expect(suggestSlug('AB')).toBe('ab-web')
    expect(suggestSlug('Admin')).toBe('admin-web')
    expect(suggestSlug('Docs')).toBe('docs-web')
  })

  it('cuts a long name at the limit without a trailing dash', () => {
    const slug = suggestSlug('Sdružení přátel historických tramvají a trolejbusů města Brna')
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX)
    expect(slug.endsWith('-')).toBe(false)
    expect(isValidSlug(slug)).toBe(true)
  })
})

describe('typing an address', () => {
  it('tidies what is typed, and lets a dash stand at the end while typing goes on', () => {
    expect(tidySlugInput('Moje Pekárna')).toBe('moje-pekarna')
    expect(tidySlugInput('moje-')).toBe('moje-')
    expect(tidySlugInput('--moje')).toBe('moje')
    expect(tidySlugInput('a__b..c')).toBe('a-b-c')
    expect(tidySlugInput('x'.repeat(60)).length).toBe(SLUG_MAX)
    expect(tidySlugInput('a"; drop')).toBe('a-drop')
  })
})

describe('a free address close to a taken one', () => {
  it('is the address itself when it is free', async () => {
    expect(await firstFreeSlug('pekarna', () => false)).toBe('pekarna')
  })

  it('counts up from 2', async () => {
    const taken = new Set(['pekarna', 'pekarna-2', 'pekarna-3'])
    expect(await firstFreeSlug('pekarna', (s) => taken.has(s))).toBe('pekarna-4')
  })

  it('makes room for the number in a full-length address', async () => {
    const base = 'a'.repeat(SLUG_MAX)
    const free = await firstFreeSlug(base, (s) => s === base)
    expect(free).toBe(`${'a'.repeat(SLUG_MAX - 2)}-2`)
    expect(isValidSlug(free!)).toBe(true)
  })

  it('gives up on an unusable address, or when everything near is taken', async () => {
    expect(await firstFreeSlug('admin', () => false)).toBeNull()
    expect(await firstFreeSlug('Bad Slug', () => false)).toBeNull()
    expect(await firstFreeSlug('pekarna', () => true, 5)).toBeNull()
  })
})

describe('the database of a site', () => {
  it('is tzc_<slug> with dashes as underscores', () => {
    expect(databaseNameFor('pekarna-na-ruzku')).toBe('tzc_pekarna_na_ruzku')
    expect(databaseNameFor('web2')).toBe('tzc_web2')
  })

  it('never collides for two different addresses', () => {
    // A slug has no underscore, so "a-b" is the only slug that gives tzc_a_b.
    expect(isValidSlug('a_b')).toBe(false)
    expect(databaseNameFor('a-b-c')).not.toBe(databaseNameFor('a-bc'))
  })

  it('fits a Postgres identifier and is quoted', () => {
    const name = databaseNameFor('a'.repeat(SLUG_MAX))
    expect(name.length).toBeLessThanOrEqual(63)
    expect(quoteIdent(name)).toBe(`"${name}"`)
    for (const bad of ['a"b', 'A', 'a-b', 'a b', '', 'a'.repeat(64)]) expect(() => quoteIdent(bad), bad).toThrow()
  })
})

describe('a second cloud app on the same Postgres server', () => {
  it('names its sites\' databases with a prefix of its own', () => {
    expect(databaseNameFor('pekarna', 'tzc_e2e_')).toBe('tzc_e2e_pekarna')
    expect(databaseNameFor('a'.repeat(SLUG_MAX), 'tzc_walk_').length).toBeLessThanOrEqual(63)
  })

  it('refuses a prefix that does not start with tzc_ or would not be a safe name', () => {
    for (const bad of ['', 'x_', 'tzc', 'tzc_e2e', 'tzc_E2E_', 'tzc_a b_', 'tzc_"; drop_', 'tzc_averyveryverylong_']) expect(() => databaseNameFor('pekarna', bad), bad).toThrow()
  })
})
