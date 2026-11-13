import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, hooksMark, receivedHooks, signIn, testDb, truncateAll, waitForHooks } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

const db = testDb()
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString()

describe('scheduled publishing', () => {
  it('keeps a scheduled entry off the website until its time, then shows and announces it', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, slug: 'brzy', status: 'published', publishedAt: inSeconds(40) })
    expect((await anonymous().get('/api/content/post/brzy')).status).toBe(404)
    expect((await admin.get('/api/cms/post?status=scheduled')).body.rows.map((r: any) => r.id)).toEqual([post.id])
    expect((await admin.get('/api/cms/post?status=published')).body.rows).toEqual([])

    // The scheduler's first run on a fresh database starts from "now"; wait for it.
    const deadline = Date.now() + 5000
    while (!(await db.query(`select 1 from cms_state where key = 'scheduler.lastRun'`)).rowCount && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
    // Bring the time forward (as if 40 s passed): no job is needed for it to appear…
    const mark = hooksMark()
    await db.query(`update post set published_at = now(), updated_at = now() - interval '1 minute' where id = $1`, [post.id])
    expect((await anonymous().get('/api/content/post/brzy')).status).toBe(200)
    // …and the scheduler announces it once.
    const hooks = await waitForHooks(mark, (h) => h.some((x) => x.path === '/ok' && x.json.id === post.id), 8000)
    expect(hooks.find((x) => x.path === '/ok' && x.json.id === post.id)!.json).toMatchObject({ type: 'entry.published', public: true, paths: ['/blog/brzy'] })
  }, 15_000)

  it('does not announce an ordinary publish twice', async () => {
    const a = await createAuthor(admin)
    const mark = hooksMark()
    const post = await createPost(admin, { author: a.id, status: 'published', publishedAt: new Date().toISOString() })
    await new Promise((r) => setTimeout(r, 5000)) // a couple of scheduler runs
    const mine = receivedHooks(mark).filter((h) => h.path === '/ok' && h.json.id === post.id)
    expect(mine.map((h) => h.json.type)).toEqual(['entry.created'])
  }, 10_000)
})

describe('publish dates', () => {
  it('are stamped by the server when publishing without one, and announced when saved seconds before', async () => {
    const a = await createAuthor(admin)
    const now = (await createPost(admin, { author: a.id, status: 'published' }))
    expect(Math.abs(new Date(now.publishedAt).getTime() - Date.now())).toBeLessThan(10_000)

    // Saved 2 s before its time (a minute-precision picker, a fast browser clock):
    // not live at the save, so the scheduler must announce it.
    const deadline = Date.now() + 5000
    while (!(await db.query(`select 1 from cms_state where key = 'scheduler.lastRun'`)).rowCount && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
    const mark = hooksMark()
    const soon = await createPost(admin, { author: a.id, status: 'published', publishedAt: new Date(Date.now() + 2000).toISOString() })
    const hooks = await waitForHooks(mark, (h) => h.some((x) => x.path === '/ok' && x.json.id === soon.id && x.json.type === 'entry.published'), 9000)
    expect(hooks.some((x) => x.json.id === soon.id)).toBe(true)
  }, 15_000)
})
