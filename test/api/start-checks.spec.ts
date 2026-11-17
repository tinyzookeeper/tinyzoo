import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Client } from '../helpers/api'
import { scratchDatabase, startServer } from '../helpers/server'
import { CMS_EXAMPLE_APP_SECRET } from '../../packages/cms/server/utils/cmsAppSecret'
import { BUILD_SECRETS } from '../setup/timers'

// A production server that is misconfigured does not start: it says which variable is
// wrong, instead of answering "ready" and failing the first sign-in with a 500.
let db: Awaited<ReturnType<typeof scratchDatabase>>
beforeAll(async () => { db = await scratchDatabase('startchecks') }, 60_000)
afterAll(async () => { await db?.drop() })

const failure = async (env: Record<string, string>): Promise<string> => {
  try {
    const s = await startServer(db.url, env)
    await s.stop()
  }
  catch (err: any) { return String(err.message) }
  return ''
}

describe('start-up checks (production)', () => {
  it('refuses to start without NUXT_APP_SECRET, or with one under 32 characters, and names it', async () => {
    for (const secret of ['', 'too-short-for-a-session']) {
      const message = await failure({ NUXT_APP_SECRET: secret })
      expect(message, `secret "${secret}"`).toContain('NUXT_APP_SECRET')
      expect(message).toMatch(/32 characters/)
    }
    // Nitro parses the environment as JSON where it can: JSON is not a secret.
    expect(await failure({ NUXT_APP_SECRET: '{"secret":"0123456789abcdef0123456789abcdef"}' })).toMatch(/NUXT_APP_SECRET was read as an object/)
  })

  it('refuses the example secret of the starter\'s .env.example, naming the variable and how to make a real one', async () => {
    const message = await failure({ NUXT_APP_SECRET: CMS_EXAMPLE_APP_SECRET })
    expect(message).toContain('NUXT_APP_SECRET is the example value')
    expect(message).toContain('openssl rand -base64 32')
    expect(message).not.toContain(CMS_EXAMPLE_APP_SECRET)
  })

  it('names NITRO_APP_SECRET when that is the one Nitro read (it wins over NUXT_APP_SECRET)', async () => {
    const message = await failure({ NUXT_APP_SECRET: 'a-long-enough-nuxt-app-secret-0123456789', NITRO_APP_SECRET: 'short-nitro-secret' })
    expect(message).toContain('NITRO_APP_SECRET is only 18 characters long')
    expect(message).not.toMatch(/NUXT_APP_SECRET is/)
  })

  it('refuses to start without a database address, naming DATABASE_URL and NUXT_CMS_DATABASE_URL', async () => {
    const message = await failure({ DATABASE_URL: '', NUXT_CMS_DATABASE_URL: '' })
    expect(message).toContain('DATABASE_URL')
    expect(message).toContain('NUXT_CMS_DATABASE_URL')
  })

  it('starts without NUXT_CMS_PUBLIC_URL, with one warning that says what needs it', async () => {
    const s = await startServer(db.url, { NUXT_CMS_PUBLIC_URL: '' })
    try {
      const warnings = s.logs.join('').match(/NUXT_CMS_PUBLIC_URL/g) ?? []
      expect(warnings.length).toBe(1)
      expect(s.logs.join('')).toMatch(/sitemap/i)
      expect((await new Client(s.baseURL).get('/api/health/ready')).status).toBe(200)
      // no address of its own: no sitemap, rather than one with whatever Host a request names
      expect((await fetch(`${s.baseURL}/sitemap.xml`, { headers: { 'x-forwarded-host': 'evil.test' } })).status).toBe(404)
    }
    finally { await s.stop() }
  })

  it('starts quietly when everything is set', async () => {
    const s = await startServer(db.url)
    try {
      expect(s.logs.join('')).not.toContain('NUXT_CMS_PUBLIC_URL')
      expect(s.logs.join('')).not.toContain('NUXT_SESSION_PASSWORD')
      expect(s.logs.join('')).not.toContain('NUXT_APP_SECRET')
    }
    finally { await s.stop() }
  })
})

// nuxt-auth-utils 0.6 seals the sign-in cookie with a key derived from NUXT_APP_SECRET and
// ignores NUXT_SESSION_PASSWORD. Until 0.5 the old value stood in for the app secret, with a
// deprecation warning; from 0.6 a site that has only the old variable does not start, and the
// message says what to do.
describe('NUXT_SESSION_PASSWORD is not read any more', () => {
  const PASSWORD = 'the-old-session-password-of-this-site-0123456789'
  const SECRET = 'the-app-secret-of-this-site-at-least-32-characters'
  const SETUP = 'start-checks-setup-code'
  const account = { name: 'Old Admin', email: 'old-admin@test.local', password: 'a long enough password' }
  let cookie = ''

  it('refuses to start with only NUXT_SESSION_PASSWORD, naming NUXT_APP_SECRET and saying to rename it', async () => {
    const message = await failure({ NUXT_APP_SECRET: '', NUXT_SESSION_PASSWORD: PASSWORD })
    expect(message).toContain('NUXT_APP_SECRET is not set')
    expect(message).toMatch(/NUXT_SESSION_PASSWORD is set, but no longer used/)
    expect(message).toMatch(/Rename the variable to NUXT_APP_SECRET and keep its value/)
    // The old value itself is never printed.
    expect(message).not.toContain(PASSWORD)
  })

  it('names NUXT_APP_SECRET for a short old password too (it is not read, so its length does not matter)', async () => {
    const message = await failure({ NUXT_APP_SECRET: '', NUXT_SESSION_PASSWORD: 'too-short-for-a-session' })
    expect(message).toContain('NUXT_APP_SECRET is not set')
    expect(message).toMatch(/Rename the variable to NUXT_APP_SECRET/)
  })

  it('refuses a NITRO_SESSION_PASSWORD the same way', async () => {
    const message = await failure({ NUXT_APP_SECRET: '', NITRO_SESSION_PASSWORD: PASSWORD })
    expect(message).toMatch(/NITRO_SESSION_PASSWORD is set, but no longer used/)
  })

  it('a set NUXT_APP_SECRET is all it needs: signs people in, and an old NUXT_SESSION_PASSWORD next to it changes nothing', async () => {
    const s = await startServer(db.url, { NUXT_APP_SECRET: SECRET, NUXT_CMS_AUTH_SETUP_TOKEN: SETUP })
    try {
      const c = new Client(s.baseURL)
      expect((await c.post('/api/cms/_auth/setup', { ...account, token: SETUP })).status).toBe(201)
      expect(c.cookie).toContain('nuxt-auth-session=')
      expect((await c.get('/api/cms/_auth/me')).body.user.email).toBe(account.email)
      cookie = c.cookie
    }
    finally { await s.stop() }
    const again = await startServer(db.url, { NUXT_APP_SECRET: SECRET, NUXT_SESSION_PASSWORD: PASSWORD })
    try {
      const logs = again.logs.join('')
      expect(logs).not.toMatch(/deprecated|SESSION_PASSWORD/)
      const c = new Client(again.baseURL)
      c.cookie = cookie
      expect((await c.get('/api/cms/_auth/me')).body.user.email).toBe(account.email)
    }
    finally { await again.stop() }
  })

  it('a different NUXT_APP_SECRET does not open the old session (the secret is the key)', async () => {
    expect(cookie).not.toBe('')
    const s = await startServer(db.url, { NUXT_APP_SECRET: 'a-different-app-secret-of-at-least-32-characters', NUXT_SESSION_PASSWORD: SECRET })
    try {
      const c = new Client(s.baseURL)
      c.cookie = cookie
      expect((await c.get('/api/cms/_auth/me')).status).toBe(401)
    }
    finally { await s.stop() }
  })

  it('a set NITRO_APP_SECRET wins over the old variable as well', async () => {
    const s = await startServer(db.url, { NUXT_APP_SECRET: '', NITRO_APP_SECRET: 'a-nitro-app-secret-of-at-least-32-characters', NUXT_SESSION_PASSWORD: PASSWORD })
    try {
      expect(s.logs.join('')).not.toMatch(/deprecated/)
      const c = new Client(s.baseURL)
      c.cookie = cookie
      expect((await c.get('/api/cms/_auth/me')).status).toBe(401)
    }
    finally { await s.stop() }
  })
})

// The app secret (and the old session password) are read when the server starts, never at
// build time: a build whose environment had them writes none of them into `.output`. The test
// build gets three recognisable ones (test/setup/timers.ts, BUILD_SECRETS).
describe('the build', () => {
  // Every file of the output (symbolic links, to packages traced into it, are not followed).
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : e.isFile() ? [join(dir, e.name)] : [])

  it('writes no secret from its environment into the output, and nothing that stands in for the app secret', () => {
    const all = files(inject('outputDir'))
    expect(all.length).toBeGreaterThan(10)
    const found: string[] = []
    let standIn = 0
    for (const file of all) {
      const text = readFileSync(file).toString('latin1')
      for (const [name, value] of Object.entries(BUILD_SECRETS)) if (text.includes(value)) found.push(`${name} in ${file}`)
      // 0.4 and 0.5 put a copy of NUXT_SESSION_PASSWORD to the app secret into the server bundle; 0.6 has none.
      if (text.includes('tinyzoo.appSecretFrom')) standIn++
    }
    expect(found).toEqual([])
    expect(standIn).toBe(0)
  })
})
