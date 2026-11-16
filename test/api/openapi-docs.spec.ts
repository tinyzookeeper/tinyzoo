import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'

// The interactive API reference loads a script from a CDN and shows the content model on
// the admin's own origin: a production site gets it only when it asks (cms.content.docs).
let db: Awaited<ReturnType<typeof scratchDatabase>>
let closed: SpawnedServer
let open: SpawnedServer
let gated: SpawnedServer
beforeAll(async () => {
  db = await scratchDatabase('openapidocs')
  closed = await startServer(db.url)
  open = await startServer(db.url, { NUXT_CMS_CONTENT_DOCS: 'true' })
  gated = await startServer(db.url, { NUXT_CMS_CONTENT_DOCS: 'true', NUXT_CMS_CONTENT_TOKEN: 'a-token-for-the-docs-test' })
}, 180_000)
afterAll(async () => { await Promise.all([closed?.stop(), open?.stop(), gated?.stop()]); await db?.drop() })

describe('/api/openapi (the interactive reference)', () => {
  it('is off in production by default, and a 404 says nothing about it', async () => {
    const res = await fetch(closed.baseURL + '/api/openapi')
    expect(res.status).toBe(404)
    expect(await res.text()).not.toMatch(/scalar|jsdelivr/i)
  })

  it('is served when cms.content.docs is on: one pinned version, checked by its hash, no inline script', async () => {
    const res = await fetch(open.baseURL + '/api/openapi')
    expect(res.status).toBe(200)
    const html = await res.text()
    const script = /<script src="([^"]+)"([^>]*)>/.exec(html)!
    expect(script[1]).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/@scalar\/api-reference@\d+\.\d+\.\d+\/dist\/browser\/standalone\.js$/)
    expect(script[2]).toMatch(/integrity="sha384-[A-Za-z0-9+/]{64}"/)
    expect(script[2]).toContain('crossorigin="anonymous"')
    const csp = res.headers.get('content-security-policy')!
    const scriptSrc = /script-src ([^;]+)/.exec(csp)![1]!
    expect(scriptSrc).not.toContain('unsafe-inline')
    expect(scriptSrc).toContain(script[1])
    expect(scriptSrc).not.toContain('https://cdn.jsdelivr.net ') // not the whole CDN
  })

  it('stays a 404 behind a content token even when it is on (a browser cannot send the key)', async () => {
    expect((await fetch(gated.baseURL + '/api/openapi')).status).toBe(404)
  })

  it('leaves /api/openapi.json as documented: served (the code generators of the docs read it), gated by the token', async () => {
    const res = await fetch(closed.baseURL + '/api/openapi.json')
    expect(res.status).toBe(200)
    expect((await res.json()).openapi).toMatch(/^3\.1/)
    expect((await fetch(gated.baseURL + '/api/openapi.json')).status).toBe(401)
    expect((await fetch(gated.baseURL + '/api/openapi.json', { headers: { 'x-api-key': 'a-token-for-the-docs-test' } })).status).toBe(200)
  })
})
