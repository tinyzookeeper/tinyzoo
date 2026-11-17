import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '../helpers/api'
import { scratchDatabase, startServer } from '../helpers/server'

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
// ignores NUXT_SESSION_PASSWORD. Until 0.5, a deploy that still has only the old variable
// keeps working: the old value stands in for the app secret, with a deprecation warning.
describe('NUXT_SESSION_PASSWORD standing in for NUXT_APP_SECRET (deprecated)', () => {
  const PASSWORD = 'the-old-session-password-of-this-site-0123456789'
  const SETUP = 'start-checks-setup-code'
  const account = { name: 'Old Admin', email: 'old-admin@test.local', password: 'a long enough password' }
  let cookie = ''

  it('starts with only NUXT_SESSION_PASSWORD, says once that it is deprecated, and signs people in', async () => {
    const s = await startServer(db.url, { NUXT_APP_SECRET: '', NUXT_SESSION_PASSWORD: PASSWORD, NUXT_CMS_AUTH_SETUP_TOKEN: SETUP })
    try {
      const logs = s.logs.join('')
      expect(logs.match(/\[tinyzoo\] deprecated: NUXT_SESSION_PASSWORD is used as the app secret/g) ?? []).toHaveLength(1)
      expect(logs).toMatch(/Rename the variable to NUXT_APP_SECRET/)
      const c = new Client(s.baseURL)
      expect((await c.post('/api/cms/_auth/setup', { ...account, token: SETUP })).status).toBe(201)
      expect(c.cookie).toContain('nuxt-auth-session=')
      expect((await c.get('/api/cms/_auth/me')).body.user.email).toBe(account.email)
      cookie = c.cookie
      // The same signing in again, as a browser would.
      const again = new Client(s.baseURL)
      expect((await again.post('/api/cms/_auth/login', { email: account.email, password: account.password })).status).toBe(200)
      expect((await again.get('/api/cms/_auth/me')).status).toBe(200)
    }
    finally { await s.stop() }
  })

  it('renaming the variable to NUXT_APP_SECRET with the same value keeps everyone signed in, without the warning', async () => {
    expect(cookie).not.toBe('')
    const s = await startServer(db.url, { NUXT_APP_SECRET: PASSWORD })
    try {
      expect(s.logs.join('')).not.toContain('deprecated')
      const c = new Client(s.baseURL)
      c.cookie = cookie
      expect((await c.get('/api/cms/_auth/me')).body.user.email).toBe(account.email)
    }
    finally { await s.stop() }
  })

  it('a set NUXT_APP_SECRET always wins: NUXT_SESSION_PASSWORD is not used', async () => {
    const s = await startServer(db.url, { NUXT_APP_SECRET: 'a-different-app-secret-of-at-least-32-characters', NUXT_SESSION_PASSWORD: PASSWORD })
    try {
      expect(s.logs.join('')).not.toMatch(/\[tinyzoo\] deprecated/)
      const c = new Client(s.baseURL)
      c.cookie = cookie
      expect((await c.get('/api/cms/_auth/me')).status).toBe(401)
    }
    finally { await s.stop() }
  })

  it('a NUXT_SESSION_PASSWORD under 32 characters is refused like a short NUXT_APP_SECRET, naming both', async () => {
    const message = await failure({ NUXT_APP_SECRET: '', NUXT_SESSION_PASSWORD: 'too-short-for-a-session' })
    expect(message).toContain('NUXT_SESSION_PASSWORD (used because NUXT_APP_SECRET is not set)')
    expect(message).toMatch(/32 characters/)
  })
})
