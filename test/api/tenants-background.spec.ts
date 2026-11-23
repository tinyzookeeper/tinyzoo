import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Client, doc, type ReceivedHook } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'
import { verifyWebhookSignature } from '../helpers/webhookSignature'
import { expectNoSiteErrors, siteClient, siteHooks, siteHooksMark, siteQuery, startTenants, type Tenants, type TenantSite, tenantGet, until, waitForSiteHooks } from '../helpers/tenants'

// Two sites in one process: work that runs after the response or with no request at all.
// Webhooks (each site has its own receiver and its own signing secret), the scheduled tasks
// (every second and every three seconds in the test build: the task has no site, it walks
// the directory) and what a broken site does to its neighbour.
//
// Site B's database is a copy of site A's: the posts below have the same id on both sites,
// so a webhook or a scheduled announcement that went to the wrong site would look right.
let t: Tenants
let adminA: Client
let adminB: Client
let shared: { author: string; draft: string; later: string }

beforeAll(async () => {
  t = await startTenants('background', {}, {
    async seed({ admin }) {
      const author = await createAuthor(admin, { name: 'Shared Author' })
      await createPost(admin, { author: author.id, title: 'Shared draft', slug: 'shared-draft', body: doc('Text') })
      await createPost(admin, { author: author.id, title: 'Shared, for later', slug: 'shared-later', body: doc('Text') })
    },
  })
  adminA = siteClient(t.a, 'admin')
  adminB = siteClient(t.b, 'admin')
  const id = async (slug: string) => (await siteQuery(t.a, 'select id from post where slug = $1', [slug]))[0].id
  shared = { author: (await siteQuery(t.a, 'select id from author'))[0].id, draft: await id('shared-draft'), later: await id('shared-later') }
  expect((await siteQuery(t.b, `select id from post where slug = 'shared-draft'`))[0].id).toBe(shared.draft)
}, 120_000)
afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

const settle = () => new Promise((r) => setTimeout(r, 500))
const about = (id: string, type?: string) => (h: ReceivedHook[]) => h.filter((x) => x.json.id === id && (!type || x.json.type === type))
const signedBy = (hook: ReceivedHook, site: TenantSite) => verifyWebhookSignature(hook.headers['x-cms-signature'], hook.body, site.webhookSecret)

describe('publish webhooks', () => {
  it('publishing on A calls A\'s receiver, signed with A\'s secret; B\'s receiver gets nothing. And the other way round', async () => {
    const marks = { a: siteHooksMark(t.a), b: siteHooksMark(t.b) }
    expect((await adminA.patch(`/api/cms/post/${shared.draft}`, { status: 'published' })).status).toBe(200)
    const [hook] = about(shared.draft, 'entry.published')(await waitForSiteHooks(t.a, marks.a, (h) => about(shared.draft, 'entry.published')(h).length > 0))
    expect(hook!.path).toBe('/hook')
    expect(hook!.json).toMatchObject({ type: 'entry.published', entity: 'post', id: shared.draft, public: true, paths: ['/blog/shared-draft'] })
    expect(hook!.headers['x-cms-event']).toBe('entry.published')
    expect(signedBy(hook!, t.a)).toBe(true)
    expect(signedBy(hook!, t.b)).toBe(false)
    await settle()
    expect(siteHooks(t.b, marks.b)).toEqual([])
    // On B the same entry id is still a draft: nothing was published there.
    expect((await tenantGet(t.b.url, '/api/content/post/shared-draft')).status).toBe(404)
    expect((await tenantGet(t.a.url, '/api/content/post/shared-draft')).status).toBe(200)

    // The reverse: B publishes its own copy of the entry.
    marks.a = siteHooksMark(t.a)
    expect((await adminB.patch(`/api/cms/post/${shared.draft}`, { status: 'published', title: 'Published on B' })).status).toBe(200)
    const [onB] = about(shared.draft, 'entry.published')(await waitForSiteHooks(t.b, marks.b, (h) => about(shared.draft, 'entry.published')(h).length > 0))
    expect(signedBy(onB!, t.b)).toBe(true)
    expect(signedBy(onB!, t.a)).toBe(false)
    await settle()
    expect(siteHooks(t.a, marks.a)).toEqual([])
  })

  it('changes on both sites at the same moment: every delivery reaches its own receiver with its own signature', async () => {
    const marks = { a: siteHooksMark(t.a), b: siteHooksMark(t.b) }
    const names = Array.from({ length: 10 }, (_, i) => i)
    await Promise.all(names.flatMap((i) => [
      createTag(adminA, { name: `Burst A ${i}`, slug: `burst-a-${i}` }),
      createTag(adminB, { name: `Burst B ${i}`, slug: `burst-b-${i}` }),
    ]))
    const tags = (h: ReceivedHook[]) => h.filter((x) => x.json.entity === 'tag' && x.json.type === 'entry.created')
    const [toA, toB] = await Promise.all([
      waitForSiteHooks(t.a, marks.a, (h) => tags(h).length >= 10),
      waitForSiteHooks(t.b, marks.b, (h) => tags(h).length >= 10),
    ])
    await settle()
    const idsOf = async (site: TenantSite, prefix: string) => (await siteQuery(site, `select id from tag where slug like $1`, [`${prefix}%`])).map((r) => r.id).sort()
    expect(tags(siteHooks(t.a, marks.a)).map((h) => h.json.id).sort()).toEqual(await idsOf(t.a, 'burst-a-'))
    expect(tags(siteHooks(t.b, marks.b)).map((h) => h.json.id).sort()).toEqual(await idsOf(t.b, 'burst-b-'))
    for (const h of tags(toA)) expect([signedBy(h, t.a), signedBy(h, t.b)]).toEqual([true, false])
    for (const h of tags(toB)) expect([signedBy(h, t.b), signedBy(h, t.a)]).toEqual([true, false])
  })

  it('a draft nobody can see sends nothing, on either receiver', async () => {
    const marks = { a: siteHooksMark(t.a), b: siteHooksMark(t.b) }
    const draft = await createPost(adminA, { author: shared.author, title: 'Quiet draft' })
    await adminA.patch(`/api/cms/post/${draft.id}`, { title: 'Still quiet' })
    await settle()
    expect(about(draft.id)(siteHooks(t.a, marks.a))).toEqual([])
    expect(siteHooks(t.b, marks.b)).toEqual([])
  })
})

describe('scheduled publishing', () => {
  const lastRun = async (site: TenantSite) => (await siteQuery(site, `select value->>'at' as at from cms_state where key = 'scheduler.lastRun'`))[0]?.at ?? null
  const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString()

  it('the task (it has no site of its own) runs in every site: each database keeps its own "last run", and both move on', async () => {
    const first = await until('both sites to have been visited by the scheduler', async () => [await lastRun(t.a), await lastRun(t.b)], ([a, b]) => !!a && !!b, 10_000)
    const next = await until('both to move on', async () => [await lastRun(t.a), await lastRun(t.b)], ([a, b]) => a !== first[0] && b !== first[1], 10_000)
    expect(new Date(next[0]).getTime()).toBeGreaterThan(new Date(first[0]).getTime())
    expect(new Date(next[1]).getTime()).toBeGreaterThan(new Date(first[1]).getTime())
  })

  it('an entry scheduled on A goes live on A and is announced to A\'s receiver only; the same entry id on B stays a draft', async () => {
    await until('the scheduler\'s first run on both', async () => [await lastRun(t.a), await lastRun(t.b)], ([a, b]) => !!a && !!b, 10_000)
    const marks = { a: siteHooksMark(t.a), b: siteHooksMark(t.b) }
    // Saved 2 s before its time: not live at the save, so only the scheduler can announce it.
    expect((await adminA.patch(`/api/cms/post/${shared.later}`, { status: 'published', publishedAt: inSeconds(2) })).status).toBe(200)
    expect((await tenantGet(t.a.url, '/api/content/post/shared-later')).status).toBe(404)
    const published = about(shared.later, 'entry.published')
    const [hook] = published(await waitForSiteHooks(t.a, marks.a, (h) => published(h).length > 0, 12_000))
    expect(hook!.json).toMatchObject({ type: 'entry.published', public: true, paths: ['/blog/shared-later'] })
    expect([signedBy(hook!, t.a), signedBy(hook!, t.b)]).toEqual([true, false])
    expect((await tenantGet(t.a.url, '/api/content/post/shared-later')).status).toBe(200)
    // B: a few more scheduler rounds pass, and nothing about this entry (or anything) arrives; it is still a draft there.
    const seen = await lastRun(t.b)
    await until('two more scheduler runs on B', () => lastRun(t.b), (at) => at !== seen, 10_000)
    await settle()
    expect(siteHooks(t.b, marks.b)).toEqual([])
    expect((await tenantGet(t.b.url, '/api/content/post/shared-later')).status).toBe(404)
    expect((await siteQuery(t.b, 'select status from post where id = $1', [shared.later]))[0].status).toBe('draft')
    // Announced once on A, not once per site the task walked.
    expect(published(siteHooks(t.a, marks.a))).toHaveLength(1)
  }, 30_000)

  it('entries scheduled on both sites for the same moment: each site announces its own, to its own receiver', async () => {
    const marks = { a: siteHooksMark(t.a), b: siteHooksMark(t.b) }
    const at = inSeconds(2)
    const [a, b] = await Promise.all([
      createPost(adminA, { author: shared.author, title: 'Soon on A', slug: 'soon-on-a', status: 'published', publishedAt: at }),
      createPost(adminB, { author: shared.author, title: 'Soon on B', slug: 'soon-on-b', status: 'published', publishedAt: at }),
    ])
    const published = (id: string) => about(id, 'entry.published')
    const [toA, toB] = await Promise.all([
      waitForSiteHooks(t.a, marks.a, (h) => published(a.id)(h).length > 0, 12_000),
      waitForSiteHooks(t.b, marks.b, (h) => published(b.id)(h).length > 0, 12_000),
    ])
    expect(published(a.id)(toA)[0]!.json.paths).toEqual(['/blog/soon-on-a'])
    expect(published(b.id)(toB)[0]!.json.paths).toEqual(['/blog/soon-on-b'])
    await settle()
    expect(about(b.id)(siteHooks(t.a, marks.a))).toEqual([])
    expect(about(a.id)(siteHooks(t.b, marks.b))).toEqual([])
    expect((await tenantGet(t.a.url, '/api/content/post/soon-on-a')).status).toBe(200)
    expect((await tenantGet(t.b.url, '/api/content/post/soon-on-a')).status).toBe(404)
  }, 30_000)
})

describe('retention', () => {
  it('deletes each site\'s own old form messages and writes the record of it in that site\'s own audit log', async () => {
    const old = (name: string) => `insert into contact_form (name, email, message, consent, status, created_at, updated_at)
      values ('${name}', 'old@example.com', 'x', true, 'new', now() - interval '200 days', now() - interval '200 days')`
    // A has two messages past their half year, B one; each also has a recent one that stays.
    await siteQuery(t.a, old('Old A 1'))
    await siteQuery(t.a, old('Old A 2'))
    await siteQuery(t.b, old('Old B 1'))
    const good = { name: 'Recent', email: 'jana@example.com', message: 'x', consent: true, _t: 5000 }
    expect((await siteClient(t.a).post('/api/content/_form/contactForm', good)).status).toBe(201)
    expect((await siteClient(t.b).post('/api/content/_form/contactForm', good)).status).toBe(201)
    const names = (site: TenantSite) => siteQuery(site, 'select name from contact_form order by name').then((r) => r.map((x) => x.name))
    // The retention task runs every 3 s in the test build.
    expect(await until('A\'s old messages to go', () => names(t.a), (n) => n.length === 1, 20_000)).toEqual(['Recent'])
    expect(await until('B\'s old message to go', () => names(t.b), (n) => n.length === 1, 20_000)).toEqual(['Recent'])
    // The task writes one audit entry with the counts, with no request and so no session: into the site it was working in.
    const purges = (site: TenantSite) => siteQuery(site, `select meta from cms_audit where action = 'retention.purge' and (meta->'forms'->>'contactForm') is not null`).then((r) => r.map((x) => x.meta.forms.contactForm))
    expect(await until('A\'s record', () => purges(t.a), (r) => r.length > 0)).toEqual([2])
    expect(await until('B\'s record', () => purges(t.b), (r) => r.length > 0)).toEqual([1])
  }, 45_000)
})

describe('a site whose database cannot be reached', () => {
  it('answers for itself; the other site keeps serving, publishing on schedule and sending its webhooks, and the process stays up', async () => {
    // B's row with a wrong database password: a changed row, so B is loaded again and cannot connect.
    const broken = t.rows.map((r) => {
      if (r.id !== 'site-b') return r
      const url = new URL(r.databaseUrl)
      url.password = 'not-the-password'
      return { ...r, databaseUrl: url.toString() }
    })
    await t.writeDirectory(broken)
    try {
      const onB = await until('B to answer that it is not ready', () => tenantGet(t.b.url, '/api/health/ready'), (r) => r.status === 503, 20_000)
      expect(onB.body.ok).toBe(false)
      const list = await tenantGet(t.b.url, '/api/content/tag')
      expect(list.status).toBeGreaterThanOrEqual(500)
      // An error answer says nothing about the database or the other site.
      expect(list.text).not.toContain('not-the-password')
      expect(list.text).not.toContain(t.b.database)
      expect(list.text).not.toContain(t.a.host)

      // A meanwhile: reads, a write with its webhook, and a scheduled entry announced by the task that also walks B.
      const mark = siteHooksMark(t.a)
      expect((await tenantGet(t.a.url, '/api/content/tag')).status).toBe(200)
      const tag = await createTag(adminA, { name: 'While B is down', slug: 'while-b-is-down' })
      await waitForSiteHooks(t.a, mark, (h) => about(tag.id, 'entry.created')(h).length > 0)
      const soon = await createPost(adminA, { author: shared.author, title: 'On schedule', slug: 'on-schedule', status: 'published', publishedAt: new Date(Date.now() + 2000).toISOString() })
      await waitForSiteHooks(t.a, mark, (h) => about(soon.id, 'entry.published')(h).length > 0, 15_000)
      expect((await tenantGet(t.ipUrl, '/api/health/live')).status).toBe(200)
      // The log names the site that failed.
      await t.server.waitForLog(/site site-b: /)
    }
    finally {
      await t.writeDirectory(t.rows)
    }
    // Back with its right password: B serves again, with what it had.
    const back = await until('B to be ready again', () => tenantGet(t.b.url, '/api/health/ready'), (r) => r.status === 200, 30_000)
    expect(back.body).toMatchObject({ ok: true })
    expect((await tenantGet(t.b.url, '/api/content/tag')).status).toBe(200)
    expect((await adminB.get('/api/cms/_auth/me')).status).toBe(200)
    expect(JSON.stringify((await tenantGet(t.b.url, '/api/content/tag')).body)).not.toContain('while-b-is-down')
  }, 90_000)
})
