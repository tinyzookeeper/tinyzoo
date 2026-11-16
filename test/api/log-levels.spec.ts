import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '../helpers/api'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'

// A visitor's mistyped address, or a scanner probing for plugin routes, is not an error of
// the server: it does not go to the log as level "error" with a stack trace (which pages
// whoever watches the log). A real server error still does (error-report.spec.ts).
let db: Awaited<ReturnType<typeof scratchDatabase>>
let server: SpawnedServer
let admin: Client
beforeAll(async () => {
  db = await scratchDatabase('loglevels')
  server = await startServer(db.url, { NUXT_CMS_AUTH_SETUP_TOKEN: 'log-setup' })
  admin = new Client(server.baseURL)
  expect((await admin.post('/api/cms/_auth/setup', { name: 'Ada Admin', email: 'ada@example.com', password: 'correct horse battery', token: 'log-setup' })).status).toBe(201)
}, 120_000)
afterAll(async () => { await server?.stop(); await db?.drop() })

const lines = () => server.logs.join('').split('\n').filter((l) => l.startsWith('{')).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)

describe('what the log says about requests that fail', () => {
  it('a 404 of the website, or of an unmatched /api/cms/_p/* probe, is no error and has no stack', async () => {
    expect((await fetch(server.baseURL + '/tahle-stranka-neexistuje')).status).toBe(404)
    // Someone signed in probing for a plugin route that does not exist.
    const probe = (method: string) => fetch(server.baseURL + '/api/cms/_p/nothing/here', { method, headers: { cookie: admin.cookie, 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined })
    expect((await probe('GET')).status).toBe(404)
    expect((await probe('POST')).status).toBe(404)
    await new Promise((r) => setTimeout(r, 300))
    const about = lines().filter((l: any) => /tahle-stranka|_p\/nothing/.test(String(l.path)))
    expect(about.filter((l: any) => l.level === 'error')).toEqual([])
    expect(about.filter((l: any) => l.stack)).toEqual([])
    expect(server.logs.join('')).not.toMatch(/at .*\.mjs:\d+/) // no stack of Nitro's own printing either
  })

  it('says it once, shortly, at info level', async () => {
    await fetch(server.baseURL + '/api/cms/_p/nothing/else', { headers: { cookie: admin.cookie } })
    await new Promise((r) => setTimeout(r, 200))
    const mine = lines().filter((l: any) => l.path === '/api/cms/_p/nothing/else')
    expect(mine).toEqual([expect.objectContaining({ level: 'info', status: 404 })])
    expect(mine[0]).not.toHaveProperty('stack')
  })

  it('does not log a 401 at all', async () => {
    expect((await fetch(server.baseURL + '/api/cms/_graph')).status).toBe(401)
    await new Promise((r) => setTimeout(r, 200))
    expect(lines().filter((l: any) => l.path === '/api/cms/_graph')).toEqual([])
  })
})
