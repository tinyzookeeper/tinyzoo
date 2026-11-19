import { beforeAll, describe, expect, it } from 'vitest'
import type { CmsStatus } from 'tinyzoo'
import { anonymous, type Client, signIn } from '../helpers/api'
import { createTag } from '../helpers/fixtures'
import { STATUS_TOKEN } from '../setup/server'

// GET /api/health/status: the site summary a tool watching many sites reads. The shared
// test server sets NUXT_CMS_STATUS_TOKEN; a server without it answers 404
// (ops-server.spec.ts).
let admin: Client
beforeAll(async () => {
  admin = await signIn('admin')
  await createTag(admin, { name: 'Status zebra', slug: `status-zebra-${Date.now()}` })
})

describe('the status route', () => {
  it('asks for the token, as x-api-key or Bearer, and is never cached', async () => {
    const c = anonymous()
    expect((await c.get('/api/health/status')).status).toBe(401)
    expect((await c.get('/api/health/status', { 'x-api-key': 'wrong' })).status).toBe(401)
    // A signed-in admin is not enough: the route is for a machine with the token.
    expect((await admin.get('/api/health/status')).status).toBe(401)
    const key = await c.get('/api/health/status', { 'x-api-key': STATUS_TOKEN })
    expect(key.status).toBe(200)
    expect(key.headers.get('cache-control')).toBe('no-store')
    expect((await c.get('/api/health/status', { authorization: `Bearer ${STATUS_TOKEN}` })).status).toBe(200)
  })

  it('summarises the site: versions, health, content, people, media', async () => {
    const res = await anonymous().get<CmsStatus>('/api/health/status', { 'x-api-key': STATUS_TOKEN })
    const s = res.body
    expect(s).toMatchObject({ format: 'tinyzoo-status', version: 1 })
    expect(s.tinyzoo).toMatch(/^\d+\.\d+\.\d+/)
    expect(s.node).toBe(process.version)
    expect(s.site).toMatchObject({ admin: '/admin', auth: 'builtin', locales: ['cs', 'en'] })
    expect(s.site.publicUrl).toMatch(/^http/)
    expect(s.database).toMatchObject({ ok: true })
    expect(s.database.bytes).toBeGreaterThan(0)
    expect(s.webhooks).toEqual({ urls: 2, signed: true })
    expect(s.plugins.map((p) => p.name)).toEqual(['forms', 'events', 'analytics'])
    // The analytics plugin says whether it counts and where its daily totals are read.
    expect(s.analytics).toMatchObject({ enabled: true, collecting: expect.any(Boolean), rollupsPath: '/api/content/_analytics/rollups' })

    const tag = s.content.collections.find((c) => c.name === 'tag')!
    expect(tag).toMatchObject({ kind: 'collection' })
    expect(tag.count).toBeGreaterThan(0)
    expect(Date.parse(tag.lastEditAt!)).toBeGreaterThan(Date.now() - 10 * 60_000)
    expect(s.content.lastEditAt! >= tag.lastEditAt!).toBe(true)
    expect(s.content.collections.some((c) => c.kind === 'global')).toBe(true)
    expect(s.content.untranslated).toBeGreaterThanOrEqual(0)

    expect(s.people.active).toBeGreaterThan(0)
    expect(s.people.signedInLast30Days).toBeGreaterThan(0)
    expect(Date.parse(s.people.lastSignInAt!)).toBeGreaterThan(0)
    expect(s.media.files).toBeGreaterThanOrEqual(0)
    expect(s.errors.last24h).toEqual({ request: expect.any(Number), task: expect.any(Number), webhook: expect.any(Number) })
  })

  it('carries no personal data and no content', async () => {
    const res = await anonymous().get('/api/health/status', { 'x-api-key': STATUS_TOKEN })
    const text = JSON.stringify(res.body)
    expect(text).not.toMatch(/@/)
    expect(text).not.toContain('Status zebra')
  })
})
