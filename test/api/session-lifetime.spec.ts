import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '../helpers/api'
import { scratchDatabase, startServer, type SpawnedServer } from '../helpers/server'

// A session ends `runtimeConfig.session.maxAge` after the sign-in, however often it is written
// again. nuxt-auth-utils 0.6 (Nuxt's useSession) counts its own age only from the last write,
// so tinyzoo keeps the time of the sign-in in the session (cms.iat) and checks it: a stolen
// cookie that keeps changing the language must not live forever.
//
// A server of its own with a maxAge of a few seconds, so the test can wait it out.
const MAX_AGE_S = 6
const SETUP = 'session-lifetime-setup-code'
const account = { name: 'Lifetime Admin', email: 'lifetime@test.local', password: 'a long enough password' }

let db: Awaited<ReturnType<typeof scratchDatabase>>
let server: SpawnedServer
beforeAll(async () => {
  db = await scratchDatabase('sessionlife')
  server = await startServer(db.url, { NUXT_SESSION_MAX_AGE: String(MAX_AGE_S), NUXT_CMS_AUTH_SETUP_TOKEN: SETUP })
}, 90_000)
afterAll(async () => {
  await server?.stop()
  await db?.drop()
})

const until = async (at: number) => {
  const wait = at - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

describe('the absolute session lifetime', () => {
  it('a session ends maxAge after the sign-in: writing it again (PATCH /me) does not extend it', async () => {
    const thief = new Client(server.baseURL)
    expect((await thief.post('/api/cms/_auth/setup', { ...account, token: SETUP })).status).toBe(201)
    const signedInAt = Date.now()
    expect((await thief.get('/api/cms/_auth/me')).status).toBe(200)

    // Halfway: the session is written again (a new cookie, sealed now).
    await until(signedInAt + (MAX_AGE_S / 2) * 1000)
    const before = thief.cookie
    const patched = await thief.patch('/api/cms/_auth/me', { locale: null })
    expect(patched.status).toBe(200)
    expect(thief.cookie).not.toBe(before)
    // For comparison: a session that really was signed in now.
    const fresh = new Client(server.baseURL)
    expect((await fresh.post('/api/cms/_auth/login', { email: account.email, password: account.password })).status).toBe(200)

    // Past maxAge after the first sign-in, but well inside maxAge after the re-write.
    await until(signedInAt + MAX_AGE_S * 1000 + 700)
    const late = await thief.get('/api/cms/_auth/me')
    expect(late.status).toBe(401)
    // The cookie is dropped on that response, and nothing else opens with it.
    expect(thief.cookie).not.toContain('nuxt-auth-session=')
    expect((await fresh.get('/api/cms/_auth/me')).body?.user?.email).toBe(account.email)

    // Signing in again starts a new lifetime.
    const again = new Client(server.baseURL)
    expect((await again.post('/api/cms/_auth/login', { email: account.email, password: account.password })).status).toBe(200)
    expect((await again.get('/api/cms/_auth/me')).status).toBe(200)
  }, 30_000)

  it('the session cookie does not outlive the sign-in either: its Max-Age is the configured one', async () => {
    const c = new Client(server.baseURL)
    const res = await c.post('/api/cms/_auth/login', { email: account.email, password: account.password })
    expect(res.status).toBe(200)
    const cookie = res.headers.getSetCookie().find((l) => l.startsWith('nuxt-auth-session=')) ?? ''
    expect(cookie).toMatch(new RegExp(`Max-Age=${MAX_AGE_S}(;|$)`, 'i'))
  })
})
