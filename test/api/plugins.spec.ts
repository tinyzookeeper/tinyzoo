import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { runUpgrade } from 'tinyzoo'
import { diskSource, siteUpgradeSteps, withDatabase } from '../../packages/cms/cli/db'
import { playgroundDir, testDatabaseUrl } from '../setup/database'
import { anonymous, type Client, signIn, testDb, truncateAll } from '../helpers/api'

// The plugin API, through the playground's example plugin ("events": an entity, an admin
// page, three server routes with three kinds of access, an upgrade step) and the forms
// plugin (its own spec, forms.spec.ts, covers the behaviour). Nothing in tinyzoo knows
// about "events": it all arrives through `export const plugins` in the playground's config.
const db = testDb()
let admin: Client
let editor: Client
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

describe('a plugin\'s entity', () => {
  it('is an ordinary collection: created, read and listed through the CMS API, in its own table', async () => {
    const res = await admin.post('/api/cms/events', { title: 'Spring race', startsAt: inDays(5), place: 'Tábor', capacity: 120 })
    expect(res.status).toBe(201)
    const { rows } = await db.query('select title, place, capacity from events')
    expect(rows).toEqual([{ title: 'Spring race', place: 'Tábor', capacity: 120 }])
    const list = (await editor.get('/api/cms/events')).body
    expect(list.rows.map((e: any) => e.title)).toEqual(['Spring race'])
  })

  it('validates like any other entity', async () => {
    expect((await admin.post('/api/cms/events', { title: 'No date' })).status).toBe(422)
    expect((await admin.post('/api/cms/events', { title: 'x', startsAt: inDays(1), capacity: -3 })).status).toBe(422)
  })

  it('shows in the admin graph with its owner, and is not on the public content API', async () => {
    const graph = (await admin.get('/api/cms/_graph')).body as any[]
    expect(graph.find((g) => g.name === 'events')).toMatchObject({ plugin: 'events', label: { en: 'Events' }, adminCreate: true })
    expect(graph.find((g) => g.name === 'post').plugin).toBeNull()
    expect((await anonymous().get('/api/content/events')).status).not.toBe(200)
  })
})

describe('a plugin\'s server routes (/api/cms/_p/<plugin>/…)', () => {
  it('default to signed-in people: anonymous is turned away', async () => {
    const res = await anonymous().get('/api/cms/_p/events/summary')
    expect(res.status).toBe(401)
    const ok = await editor.get('/api/cms/_p/events/summary')
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ total: 0, upcoming: 0, next: null })
  })

  it('answer from the plugin\'s own handler, with the database', async () => {
    await admin.post('/api/cms/events', { title: 'Past', startsAt: inDays(-3) })
    await admin.post('/api/cms/events', { title: 'Soon', startsAt: inDays(2) })
    await admin.post('/api/cms/events', { title: 'Later', startsAt: inDays(20) })
    const { body } = await editor.get('/api/cms/_p/events/summary')
    expect(body).toMatchObject({ total: 3, upcoming: 2, next: { title: 'Soon' } })
  })

  it('can be limited to administrators, before the handler runs', async () => {
    await admin.post('/api/cms/events', { title: 'Past', startsAt: inDays(-3) })
    expect((await anonymous().post('/api/cms/_p/events/clear-past', {})).status).toBe(401)
    expect((await editor.post('/api/cms/_p/events/clear-past', {})).status).toBe(403)
    expect((await db.query('select count(*)::int as n from events')).rows[0].n).toBe(1) // nothing happened
    const done = await admin.post('/api/cms/_p/events/clear-past', {})
    expect(done.status).toBe(200)
    expect(done.body).toEqual({ removed: 1 })
    expect((await db.query('select count(*)::int as n from events')).rows[0].n).toBe(0)
    expect((await db.query(`select action from cms_audit where action = 'events.clear_past'`)).rowCount).toBe(1)
  })

  it('can be open to anyone, here and on the public content API', async () => {
    await admin.post('/api/cms/events', { title: 'Soon', startsAt: inDays(2), place: 'Praha' })
    for (const path of ['/api/cms/_p/events/next', '/api/content/_events/next']) {
      const res = await anonymous().get(path)
      expect(res.status, path).toBe(200)
      expect(res.body.next).toMatchObject({ title: 'Soon', place: 'Praha' })
    }
  })

  it('stay closed where the plugin declares nothing: an unknown address, a wrong method', async () => {
    expect((await anonymous().get('/api/cms/_p/events/secret')).status).toBe(401)
    expect((await anonymous().get('/api/cms/_p/nothing/here')).status).toBe(401)
    expect((await editor.get('/api/cms/_p/events/secret')).status).toBe(404)
    expect((await anonymous().get('/api/cms/_p/events/clear-past')).status).toBe(401) // declared for POST only
  })

  it('run next to the plugin\'s own Nitro plugin (serverPlugins)', async () => {
    expect((await editor.get('/api/cms/_p/events/summary')).headers.get('x-cms-plugin')).toBe('events')
    expect((await anonymous().get('/api/cms/_p/events/next')).headers.get('x-cms-plugin')).toBe('events')
    expect((await editor.get('/api/cms/events')).headers.get('x-cms-plugin')).toBeNull() // only the plugin's own routes
  })

  it('keep the admin API\'s CSRF rule: a state-changing request must carry JSON', async () => {
    const res = await admin.request('POST', '/api/cms/_p/events/clear-past', { body: 'x=1', headers: { 'content-type': 'application/x-www-form-urlencoded' } })
    expect(res.status).toBe(415)
  })
})

describe('a plugin\'s admin page (/admin/p/<plugin>)', () => {
  const html = { accept: 'text/html' }

  it('is served inside the admin, with the plugin\'s own texts and a sidebar entry', async () => {
    await admin.post('/api/cms/events', { title: 'Spring race', startsAt: inDays(5) })
    const res = await admin.get('/admin/p/events', html)
    expect(res.status).toBe(200)
    const page = String(res.body)
    expect(page).toContain('Events overview') // the page's title and the sidebar entry: text from the plugin's i18n
    expect(page).toContain('/admin/p/events')
    expect(page).toContain('data-test="events-total"')
    expect(page).toContain('Spring race') // fetched from the plugin's own route while rendering
  })

  it('is not there for somebody who is not signed in', async () => {
    const res = await anonymous().get('/admin/p/events', html)
    expect([301, 302, 303, 307, 308, 401]).toContain(res.status)
    expect(String(res.body)).not.toContain('data-test="events-total"')
  })

  it('carries the plugin\'s texts in every language to the browser', async () => {
    const page = String((await admin.get('/admin/p/events', html)).body)
    expect(page).toContain('Přehled akcí') // cs, in the public runtime config the admin reads its texts from
    expect(page).toContain('Übersicht der Veranstaltungen')
  })
})

describe('a plugin\'s upgrade step', () => {
  // The specs truncate every table, so the record the start-up migration made is gone: run
  // the runner the way `tinyzoo up` does, with the steps of the site's registered plugins.
  it('runs with tinyzoo\'s, does its work, and is recorded under the plugin\'s namespace and version', async () => {
    await db.query(`insert into events (title, starts_at, place) values ('No place', now(), null), ('Has place', now(), 'Praha')`)
    const result = await withDatabase(testDatabaseUrl(), async ({ transaction }) => runUpgrade(diskSource(playgroundDir), transaction, await siteUpgradeSteps(playgroundDir)))
    expect(result.steps.filter((s) => s.id.includes(':'))).toEqual([{ id: 'events:backfill-place', ran: true }])
    expect((await db.query(`select title, place from events order by title`)).rows).toEqual([
      { title: 'Has place', place: 'Praha' }, { title: 'No place', place: 'To be announced' },
    ])
    expect((await db.query(`select id, since from cms_upgrades where id like '%:%'`)).rows).toEqual([{ id: 'events:backfill-place', since: '0.1.0' }])
    // recorded: the next run leaves it alone (the specs truncate between tests, so it is the same test)
    const again = await withDatabase(testDatabaseUrl(), async ({ transaction }) => runUpgrade(diskSource(playgroundDir), transaction, await siteUpgradeSteps(playgroundDir)))
    expect(again.steps.filter((s) => s.id.includes(':'))).toEqual([])
    // tinyzoo's own steps keep their plain ids
    expect((await db.query(`select id from cms_upgrades where id not like '%:%'`)).rows.every((r) => /^[a-z0-9-]+$/.test(r.id))).toBe(true)
  })
})
