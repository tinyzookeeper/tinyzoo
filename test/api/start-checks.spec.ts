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
  it('refuses to start without NUXT_SESSION_PASSWORD, or with one under 32 characters, and names it', async () => {
    for (const password of ['', 'too-short-for-a-session']) {
      const message = await failure({ NUXT_SESSION_PASSWORD: password })
      expect(message, `password "${password}"`).toContain('NUXT_SESSION_PASSWORD')
      expect(message).toMatch(/32 characters/)
    }
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
    }
    finally { await s.stop() }
  })
})
