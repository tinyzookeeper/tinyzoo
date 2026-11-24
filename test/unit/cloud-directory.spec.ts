import { createDecipheriv, createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  decryptDirectorySecret, decryptSiteRow, directoryKey, encryptDirectorySecret, encryptSiteRow, isDirectorySecret,
} from '../../cloud/shared/directorySecret'
import { planById, PLANS } from '../../cloud/shared/plans'
import { sharedDomainUrl, sharedReaderRole, sharedReaderUrl, sharedSiteRow } from '../../cloud/shared/sharedHosting'

// The site directory of the shared driver as it is stored: every secret of a row encrypted the
// way tinyzoo reads it (packages/cms/server/utils/cmsSite.ts), and what a row says besides the
// secrets (the site's own domains, its state, the limits of its plan).

const KEY = 'directory-key-of-the-test-0123456789-abcdef'
const ID = '7f3a2c1e-0b4d-4e6f-8a9b-0c1d2e3f4a5b'
const ENV = {
  NUXT_APP_SECRET: 'an-app-secret-of-at-least-32-characters',
  NUXT_CMS_AUTH_SETUP_TOKEN: 'setup-code',
  NUXT_CMS_STATUS_TOKEN: 'status-token',
  NUXT_CMS_AUTH_ACCOUNT_ISSUER: 'https://tinyzoo.example',
  NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID: '99999999-8888-4777-8666-555555555555',
  NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET: 'a-client-secret',
  NUXT_CMS_MAIL_TRANSPORT: 'log',
}
const input = { siteId: ID, slug: 'atelier-svetlo', port: 4400, databaseUrl: 'postgres://tzs_x:pw@localhost:5434/tzs_x', env: ENV, siteDir: `/data/photographer/sites/${ID}` }

/**
 * What the reading side does (`decryptSecret` in cmsSite.ts), written out with node:crypto:
 * `enc:v1:` + base64url(iv 12 | tag 16 | ciphertext), AES-256-GCM, key = SHA-256 of the key text.
 */
function read(value: string, key = KEY): string {
  const raw = Buffer.from(value.slice('enc:v1:'.length), 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(key, 'utf8').digest(), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
}

// One fixed vector both sides agree on: this key, this iv (00 01 … 0b), this text, this result.
const VECTOR = {
  plain: 'postgres://site_user:p%40ss w0rd@db.internal:5432/site_db',
  iv: Buffer.from('000102030405060708090a0b', 'hex'),
  stored: 'enc:v1:AAECAwQFBgcICQoLjeGusMBTeUlIBMu-xXjWvfyj2GYh08DbVPeSMXzObMnaDiYo-ANZ5V_EZGlamJJKk2uYZle7FZEyY9-yIwE0PZwwEsjQiCrHUA',
}

describe('a secret of the site directory', () => {
  it('is written exactly as the fixed vector says', () => {
    expect(encryptDirectorySecret(VECTOR.plain, KEY, VECTOR.iv)).toBe(VECTOR.stored)
  })

  it('is read back from the fixed vector by the reading side\'s few lines of node:crypto', () => {
    expect(read(VECTOR.stored)).toBe(VECTOR.plain)
    expect(decryptDirectorySecret(VECTOR.stored, KEY)).toBe(VECTOR.plain)
  })

  it('has the layout enc:v1: + base64url(iv 12 | tag 16 | ciphertext)', () => {
    const raw = Buffer.from(VECTOR.stored.slice(7), 'base64url')
    expect(raw.subarray(0, 12).equals(VECTOR.iv)).toBe(true)
    expect(raw.length).toBe(12 + 16 + Buffer.byteLength(VECTOR.plain))
    expect(VECTOR.stored).toMatch(/^enc:v1:[A-Za-z0-9_-]+$/)
  })

  it('gets new random bytes every time, and still reads back the same', () => {
    const [a, b] = [encryptDirectorySecret('tajemství ž', KEY), encryptDirectorySecret('tajemství ž', KEY)]
    expect(a).not.toBe(b)
    expect(read(a)).toBe('tajemství ž')
    expect(read(b)).toBe('tajemství ž')
  })

  it('cannot be read with another key, nor when it was changed', () => {
    expect(() => decryptDirectorySecret(VECTOR.stored, 'another-key-of-at-least-32-characters-x')).toThrow()
    const tampered = VECTOR.stored.slice(0, -2) + (VECTOR.stored.endsWith('A') ? 'B' : 'A') + VECTOR.stored.slice(-1)
    expect(() => decryptDirectorySecret(tampered, KEY)).toThrow()
    expect(() => decryptDirectorySecret('enc:v1:AAAA', KEY)).toThrow()
  })

  it('leaves a text that is not encrypted as it is', () => {
    expect(decryptDirectorySecret('plain', KEY)).toBe('plain')
    expect(isDirectorySecret('plain')).toBe(false)
    expect(isDirectorySecret(VECTOR.stored)).toBe(true)
  })

  it('needs a key of 32 characters or more', () => {
    expect(() => encryptDirectorySecret('x', 'short')).toThrow()
    expect(() => directoryKey('short')).toThrow()
    expect(directoryKey('')).toBe('')
    expect(directoryKey(undefined)).toBe('')
    expect(directoryKey(KEY)).toBe(KEY)
  })
})

describe('a row as the directory stores it', () => {
  const row = sharedSiteRow(input)
  const stored = encryptSiteRow(row, KEY)

  it('has every secret encrypted: the database address, the site\'s secret, the setup code, the status token, the client secret', () => {
    for (const secret of [stored.databaseUrl, stored.secret, stored.config.auth.setupToken, stored.config.status.token, stored.config.auth.account!.clientSecret]) expect(secret).toMatch(/^enc:v1:/)
    const text = JSON.stringify(stored)
    for (const plain of [row.databaseUrl, 'pw@', row.secret, 'setup-code', 'status-token', 'a-client-secret']) expect(text).not.toContain(plain)
  })

  it('keeps what is not a secret readable: the hosts, the address, the folder, the issuer and the client id', () => {
    expect(stored.id).toBe(row.id)
    expect(stored.hosts).toEqual(row.hosts)
    expect(stored.publicUrl).toBe(row.publicUrl)
    expect(stored.config.storage).toEqual(row.config.storage)
    expect(stored.config.auth.account!.issuer).toBe('https://tinyzoo.example')
    expect(stored.config.auth.account!.clientId).toBe(ENV.NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID)
  })

  it('is what the reading side decrypts to the row', () => {
    expect(read(stored.databaseUrl)).toBe(row.databaseUrl)
    expect(read(stored.secret)).toBe(row.secret)
    expect(read(stored.config.status.token)).toBe('status-token')
    expect(decryptSiteRow(stored, KEY)).toEqual(row)
  })

  it('is stored as it is without a key, and an encrypted row cannot be read without one', () => {
    expect(encryptSiteRow(row, '')).toBe(row)
    expect(decryptSiteRow(row, '')).toEqual(row)
    expect(() => decryptSiteRow(stored, '')).toThrow()
  })

  it('is not encrypted twice', () => {
    expect(decryptSiteRow(encryptSiteRow(stored, KEY), KEY)).toEqual(row)
  })
})

describe('what a row says besides the secrets', () => {
  it('without a domain is the row as it always was', () => {
    const row = sharedSiteRow(input)
    expect(row.hosts).toEqual(['atelier-svetlo.localhost'])
    expect(row).not.toHaveProperty('alsoHosts')
    expect(row).not.toHaveProperty('state')
    expect(row.publicUrl).toBe('http://atelier-svetlo.localhost:4400')
    expect(sharedSiteRow({ ...input, domains: { main: null, others: [] }, state: 'active' })).toEqual(row)
  })

  it('with a main domain: the domain first, the other domains after it, the service address served as well', () => {
    const row = sharedSiteRow({ ...input, domains: { main: 'www.atelier.cz', others: ['atelier.cz'] } })
    expect(row.hosts).toEqual(['www.atelier.cz', 'atelier.cz'])
    expect(row.alsoHosts).toEqual(['atelier-svetlo.localhost'])
    expect(row.publicUrl).toBe('https://www.atelier.cz')
  })

  it('with verified domains and no main one: they redirect to the service address', () => {
    const row = sharedSiteRow({ ...input, domains: { main: null, others: ['www.atelier.cz'] } })
    expect(row.hosts).toEqual(['atelier-svetlo.localhost', 'www.atelier.cz'])
    expect(row).not.toHaveProperty('alsoHosts')
    expect(row.publicUrl).toBe('http://atelier-svetlo.localhost:4400')
  })

  it('never lists a host twice, nor the service address as a domain', () => {
    const row = sharedSiteRow({ ...input, domains: { main: 'www.atelier.cz', others: ['www.atelier.cz', 'atelier-svetlo.localhost', 'atelier.cz', 'atelier.cz'] } })
    expect(row.hosts).toEqual(['www.atelier.cz', 'atelier.cz'])
    expect(row.alsoHosts).toEqual(['atelier-svetlo.localhost'])
  })

  it('a local domain is plain http on the template\'s port, any other is https', () => {
    expect(sharedDomainUrl('www.atelier.localhost', 4400)).toBe('http://www.atelier.localhost:4400')
    expect(sharedDomainUrl('www.atelier.cz', 4400)).toBe('https://www.atelier.cz')
    expect(sharedDomainUrl('xn--kavrna-rta.cz', 4400)).toBe('https://xn--kavrna-rta.cz')
    for (const bad of ['', 'a b.cz', 'atelier.cz/x', 'atelier.cz:80', 'Atelier.cz']) expect(() => sharedDomainUrl(bad, 4400), bad).toThrow()
  })

  it('names its state only when the site is not simply served', () => {
    expect(sharedSiteRow({ ...input, state: 'paused' }).state).toBe('paused')
    expect(sharedSiteRow({ ...input, state: 'read-only' }).state).toBe('read-only')
    const moved = sharedSiteRow({ ...input, state: 'moved', movedTo: 'https://www.atelier.cz/' })
    expect(moved.state).toBe('moved')
    expect(moved.movedTo).toBe('https://www.atelier.cz')
    expect(sharedSiteRow({ ...input, state: 'paused', movedTo: 'https://www.atelier.cz' })).not.toHaveProperty('movedTo')
  })

  it('refuses a moved site without an address to send people to, and a state that is not one', () => {
    expect(() => sharedSiteRow({ ...input, state: 'moved' })).toThrow()
    expect(() => sharedSiteRow({ ...input, state: 'moved', movedTo: 'www.atelier.cz' })).toThrow()
    expect(() => sharedSiteRow({ ...input, state: 'moved', movedTo: 'https://www.atelier.cz/kontakt' })).toThrow()
    expect(() => sharedSiteRow({ ...input, state: 'stopped' as any })).toThrow()
  })

  it('carries the plan\'s limits in the storage settings', () => {
    const row = sharedSiteRow({ ...input, limits: planById('basic').storage })
    expect(row.config.storage).toEqual({ driver: 'local', local: { dir: `/data/photographer/sites/${ID}/uploads` }, maxSizeMb: 20, maxBytes: 1024 * 1024 * 1024 })
    expect(sharedSiteRow(input).config.storage).not.toHaveProperty('maxBytes')
    expect(() => sharedSiteRow({ ...input, limits: { maxSizeMb: 0, maxBytes: 1 } })).toThrow()
    expect(() => sharedSiteRow({ ...input, limits: { maxSizeMb: 1, maxBytes: 1.5 } })).toThrow()
  })
})

describe('the plans', () => {
  it('have one default plan with sensible numbers: 20 MB an upload, 1 GB in all', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['basic'])
    expect(planById('basic').storage).toEqual({ maxSizeMb: 20, maxBytes: 1024 * 1024 * 1024 })
  })

  it('give the default plan for an id that is unknown or missing', () => {
    expect(planById('gold')).toBe(planById('basic'))
    expect(planById(null)).toBe(planById('basic'))
    expect(planById('')).toBe(planById('basic'))
  })

  it('never let one upload be larger than everything a site may store', () => {
    for (const plan of PLANS) expect(plan.storage.maxSizeMb * 1024 * 1024).toBeLessThanOrEqual(plan.storage.maxBytes)
  })
})

describe('the reader of the directory table', () => {
  it('is named by the prefix and the template', () => {
    expect(sharedReaderRole('photographer')).toBe('tzs_reader_photographer')
    expect(sharedReaderRole('car-service', 'tzmt_e2e')).toBe('tzmt_e2e_reader_car_service')
    expect(() => sharedReaderRole('../x')).toThrow()
    expect(() => sharedReaderRole('a'.repeat(40), 'a2345678901234567890')).toThrow()
  })

  it('gets the cloud\'s server and database with its own name and password', () => {
    expect(sharedReaderUrl('postgres://cms:cms@localhost:5434/tz_cloud_dev?sslmode=disable', 'tz_cloud_dev', 'tzs_reader_photographer', 'p@ss/word')).toBe('postgres://tzs_reader_photographer:p%40ss%2Fword@localhost:5434/tz_cloud_dev?sslmode=disable')
  })
})
