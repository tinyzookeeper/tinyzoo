import { describe, expect, it } from 'vitest'
import {
  assertSiteId, assertTemplateId, parseSharedDirectory, passwordOfDatabaseUrl, SHARED_PORT_RANGE, sharedDatabaseNameFor, sharedDatabasePrefix,
  sharedDatabaseUrl, sharedDirectoryText, sharedSiteRow, sharedSiteUrl, splitSiteEnv, sqlLiteral, withoutSharedSite, withSharedSite,
} from '../../cloud/shared/sharedHosting'
import { DEFAULT_PORT_RANGE } from '../../cloud/shared/ports'
import { quoteIdent } from '../../cloud/shared/slug'

// The shared hosting driver: one process per template, a database and a database user per site.
const ID = '7f3a2c1e-0b4d-4e6f-8a9b-0c1d2e3f4a5b'
const OTHER = '11111111-2222-4333-8444-555555555555'
const ENV = {
  NUXT_APP_SECRET: 'an-app-secret-of-at-least-32-characters',
  NUXT_CMS_AUTH_SETUP_TOKEN: 'setup-code',
  NUXT_CMS_STATUS_TOKEN: 'status-token',
  NUXT_CMS_MIGRATIONS_ON_START: 'true',
  NUXT_CMS_MAIL_TRANSPORT: 'log',
}

describe('the names of a site\'s database and database user', () => {
  it('come from the site\'s id, never from its address', () => {
    expect(sharedDatabaseNameFor(ID)).toBe('tzs_7f3a2c1e_0b4d_4e6f_8a9b_0c1d2e3f4a5b')
    expect(sharedDatabaseNameFor(ID, 'tzmt_e2e')).toBe('tzmt_e2e_7f3a2c1e_0b4d_4e6f_8a9b_0c1d2e3f4a5b')
    expect(sharedDatabaseNameFor(ID)).not.toBe(sharedDatabaseNameFor(OTHER))
  })

  it('are safe identifiers within Postgres\'s 63 characters, with the longest prefix too', () => {
    const name = sharedDatabaseNameFor(ID, 'a2345678901234567890')
    expect(name.length).toBeLessThanOrEqual(63)
    expect(quoteIdent(name)).toBe(`"${name}"`)
  })

  it('refuse anything that is not a site id', () => {
    for (const bad of ['', 'pekarna', '7F3A2C1E-0B4D-4E6F-8A9B-0C1D2E3F4A5B', `${ID}"; drop database x`, `${ID} `, '../../etc', ID.replace(/-/g, '')]) {
      expect(() => assertSiteId(bad), bad).toThrow()
      expect(() => sharedDatabaseNameFor(bad), bad).toThrow()
    }
    expect(assertSiteId(ID)).toBe(ID)
  })

  it('take the default prefix when none is set, and refuse an odd one', () => {
    expect(sharedDatabasePrefix('')).toBe('tzs')
    expect(sharedDatabasePrefix(undefined)).toBe('tzs')
    expect(sharedDatabasePrefix(' tzmt_e2e ')).toBe('tzmt_e2e')
    for (const bad of ['Tzs', 'tzs_', '_tzs', 'tz-s', '1tzs', 'tzs__x', 'tzs"', 'a23456789012345678901']) expect(() => sharedDatabasePrefix(bad), bad).toThrow()
  })
})

describe('a template\'s folder name', () => {
  it('is the template\'s id, and nothing that could leave the data folder', () => {
    expect(assertTemplateId('photographer')).toBe('photographer')
    expect(assertTemplateId('car-service')).toBe('car-service')
    for (const bad of ['', '..', '../x', 'a/b', 'A', 'a_b', '-a', 'a-', 'x'.repeat(41)]) expect(() => assertTemplateId(bad), bad).toThrow()
  })
})

describe('a password as an SQL literal', () => {
  it('is quoted, with quotes doubled', () => {
    expect(sqlLiteral('abc-DEF_123')).toBe('\'abc-DEF_123\'')
    expect(sqlLiteral('it\'s')).toBe('\'it\'\'s\'')
    expect(sqlLiteral('\'; drop role x; --')).toBe('\'\'\'; drop role x; --\'')
    expect(sqlLiteral('')).toBe('\'\'')
  })

  it('is an escape string when it holds a backslash, so the server\'s settings do not change its meaning', () => {
    expect(sqlLiteral('a\\b')).toBe('E\'a\\\\b\'')
    expect(sqlLiteral('a\\\'b')).toBe('E\'a\\\\\'\'b\'')
  })

  it('refuses a text Postgres cannot hold', () => {
    expect(() => sqlLiteral('a\0b')).toThrow()
    expect(() => sqlLiteral(undefined as unknown as string)).toThrow()
  })
})

describe('a site\'s addresses', () => {
  it('is its own host name on the template\'s port', () => {
    expect(sharedSiteUrl('pekarna-u-kone', 4400)).toBe('http://pekarna-u-kone.localhost:4400')
    expect(() => sharedSiteUrl('Bad_Slug', 4400)).toThrow()
    expect(() => sharedSiteUrl('pekarna', 0)).toThrow()
    expect(() => sharedSiteUrl('pekarna', 4400.5)).toThrow()
  })

  it('its database address keeps the cloud\'s server and names the site\'s own database and user', () => {
    const url = new URL(sharedDatabaseUrl('postgres://cms:cms@localhost:5434/tz_cloud_dev?sslmode=disable', 'tzs_x', 'pass-WORD_1'))
    expect([url.hostname, url.port, url.username, url.password, url.pathname, url.search]).toEqual(['localhost', '5434', 'tzs_x', 'pass-WORD_1', '/tzs_x', '?sslmode=disable'])
  })

  it('the password is read back from a database address, also one with characters that are escaped in it', () => {
    expect(passwordOfDatabaseUrl(sharedDatabaseUrl('postgres://cms:cms@localhost:5434/x', 'tzs_x', 'p@ss/w:rd#1'))).toBe('p@ss/w:rd#1')
    expect(passwordOfDatabaseUrl('postgres://user@localhost/x')).toBeNull()
    expect(passwordOfDatabaseUrl(undefined)).toBeNull()
    expect(passwordOfDatabaseUrl('not an address')).toBeNull()
  })

  it('the templates\' ports do not overlap the local driver\'s', () => {
    expect(SHARED_PORT_RANGE).toEqual({ from: 4400, to: 4419 })
    expect(SHARED_PORT_RANGE.from).toBeGreaterThan(DEFAULT_PORT_RANGE.to)
  })
})

describe('splitting a site\'s environment', () => {
  it('the secrets are the site\'s own; the rest belongs to the process that serves every site', () => {
    expect(splitSiteEnv(ENV)).toEqual({
      site: { secret: ENV.NUXT_APP_SECRET, setupToken: 'setup-code', statusToken: 'status-token' },
      process: { NUXT_CMS_MIGRATIONS_ON_START: 'true', NUXT_CMS_MAIL_TRANSPORT: 'log' },
    })
  })

  it('no secret of a site stays in the process\'s part', () => {
    const text = JSON.stringify(splitSiteEnv(ENV).process)
    for (const secret of [ENV.NUXT_APP_SECRET, 'setup-code', 'status-token']) expect(text).not.toContain(secret)
  })

  it('a site without a usable app secret is refused', () => {
    expect(() => splitSiteEnv({ ...ENV, NUXT_APP_SECRET: 'short' })).toThrow()
    expect(() => splitSiteEnv({})).toThrow()
  })
})

describe('a site\'s row in the site directory', () => {
  const input = { siteId: ID, slug: 'atelier-svetlo', port: 4400, databaseUrl: 'postgres://tzs_x:pw@localhost:5434/tzs_x', env: ENV, siteDir: `/data/photographer/sites/${ID}` }

  it('holds the site\'s id, host, address, database, secret and its own places', () => {
    expect(sharedSiteRow(input)).toEqual({
      id: ID,
      hosts: ['atelier-svetlo.localhost'],
      publicUrl: 'http://atelier-svetlo.localhost:4400',
      databaseUrl: 'postgres://tzs_x:pw@localhost:5434/tzs_x',
      secret: ENV.NUXT_APP_SECRET,
      config: {
        auth: { setupToken: 'setup-code' },
        status: { token: 'status-token' },
        storage: { driver: 'local', local: { dir: `/data/photographer/sites/${ID}/uploads` } },
      },
    })
  })

  it('gives e-mails a folder per site only when they are written to files', () => {
    expect(sharedSiteRow(input).config.mail).toBeUndefined()
    expect(sharedSiteRow({ ...input, env: { ...ENV, NUXT_CMS_MAIL_TRANSPORT: 'file' } }).config.mail).toEqual({ file: { dir: `/data/photographer/sites/${ID}/mail` } })
  })

  it('is the same text for the same site, so writing it again changes nothing', () => {
    expect(JSON.stringify(sharedSiteRow(input))).toBe(JSON.stringify(sharedSiteRow({ ...input, env: { ...ENV } })))
  })

  it('refuses a folder that is not absolute, a bad address and a bad id', () => {
    expect(() => sharedSiteRow({ ...input, siteDir: 'sites/x' })).toThrow()
    expect(() => sharedSiteRow({ ...input, slug: 'admin' })).toThrow()
    expect(() => sharedSiteRow({ ...input, siteId: 'x' })).toThrow()
  })
})

describe('the site directory', () => {
  const row = (siteId: string, slug: string) => sharedSiteRow({ siteId, slug, port: 4400, databaseUrl: `postgres://u:p@localhost/${slug}`, env: ENV, siteDir: `/data/t/sites/${siteId}` })
  const a = row(ID, 'prvni-web')
  const b = row(OTHER, 'druhy-web')

  it('gains a site at its end, and keeps the others as they were', () => {
    const one = withSharedSite([], a)
    expect(one).toEqual({ rows: [a], changed: true })
    const two = withSharedSite(one.rows, b)
    expect(two.rows).toEqual([a, b])
    expect(two.rows[0]).toBe(a)
  })

  it('does not change when the same row is put in again', () => {
    const again = withSharedSite([a, b], row(OTHER, 'druhy-web'))
    expect(again.changed).toBe(false)
    expect(again.rows).toEqual([a, b])
  })

  it('replaces a site\'s row in its place when it differs', () => {
    const moved = { ...b, publicUrl: 'http://druhy-web.localhost:4401' }
    expect(withSharedSite([a, b], moved)).toEqual({ rows: [a, moved], changed: true })
    expect(withSharedSite([b, a], moved)).toEqual({ rows: [moved, a], changed: true })
  })

  it('loses a site, and says when there was nothing to lose', () => {
    expect(withoutSharedSite([a, b], ID)).toEqual({ rows: [b], changed: true })
    expect(withoutSharedSite([b], ID)).toEqual({ rows: [b], changed: false })
  })

  it('is written as { sites: [...] } and read back the same', () => {
    const text = sharedDirectoryText([a, b])
    expect(JSON.parse(text)).toEqual({ sites: [a, b] })
    expect(parseSharedDirectory(text)).toEqual([a, b])
    expect(sharedDirectoryText([])).toBe('{\n  "sites": []\n}\n')
  })

  it('reads a bare list too, and gives no rows for a text that is not a directory', () => {
    expect(parseSharedDirectory(JSON.stringify([a]))).toEqual([a])
    for (const bad of ['', 'not json', '{}', '{"sites": 3}', 'null']) expect(parseSharedDirectory(bad), bad).toEqual([])
    expect(parseSharedDirectory('{"sites": [null, 3, {"id": 7}]}')).toEqual([])
  })
})
